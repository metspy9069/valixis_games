// Pure ballistic math, penetration resolution, circular Gaussian spread,
// and locational damage multipliers. Free of DOM and Three.js so unit tests
// verify the exact browser shooting math directly.

export const HIT_ZONES = {
  head:       { multiplier: 3.0,  priority: 4, penCost: 0.45, crit: true,  stagger: 0.35 },
  upperTorso: { multiplier: 1.25, priority: 3, penCost: 0.55, crit: false, stagger: 0.16 },
  lowerTorso: { multiplier: 1.0,  priority: 2, penCost: 0.50, crit: false, stagger: 0.10 },
  body:       { multiplier: 1.0,  priority: 2, penCost: 0.50, crit: false, stagger: 0.10 },
  limb:       { multiplier: 0.75, priority: 1, penCost: 0.25, crit: false, stagger: 0.48 },
};

/** Resolve multiplier, priority, and penetration cost for a hit part tag. */
export function hitZoneFor(part) {
  return HIT_ZONES[part] || HIT_ZONES.body;
}

/**
 * Circular Gaussian + stratified Golden-Angle spread sampling.
 * Eliminates rectangular clamping and multi-pellet shotgun clumping while
 * weighting single-round scatter smoothly toward the sight center.
 */
export function sampleCircularSpread(radius, pelletIndex = 0, totalPellets = 1, rng = Math.random) {
  if (radius <= 1e-5) return { dx: 0, dy: 0, rNorm: 0 };

  if (totalPellets > 1) {
    // Vogel / Golden-Angle disk stratification keeps pellets distributed cleanly
    // across the circular pattern without quadrant clumping, while Box-Muller
    // gaussian density biases the core slightly tighter than outer fringes.
    const goldenAngle = 2.399963229728653; // pi * (3 - sqrt(5))
    const baseAngle = pelletIndex * goldenAngle + (rng() - 0.5) * 0.42;
    const radialSlot = (pelletIndex + 0.35 + rng() * 0.65) / totalPellets;
    // Slight inward Gaussian concentration (sqrt gives uniform; ^0.62 weights core)
    const rNorm = Math.min(1, Math.pow(Math.max(0.01, radialSlot), 0.58));
    const r = rNorm * radius;
    return {
      dx: Math.cos(baseAngle) * r,
      dy: Math.sin(baseAngle) * r,
      rNorm,
    };
  }

  // Single projectile: Polar Box-Muller Gaussian clamped to cone radius (3 sigma)
  const u1 = Math.max(1e-6, 1 - rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) / 2.6; // ~99% within 1.0 radius
  const rNorm = Math.min(1, z);
  const angle = u2 * Math.PI * 2;
  const r = rNorm * radius;
  return {
    dx: Math.cos(angle) * r,
    dy: Math.sin(angle) * r,
    rNorm,
  };
}

/**
 * Ray vs axis-aligned collider intersection returning distance, exact entry face
 * normal, surface material, and penetrability metadata.
 */
export function intersectColliderRay(origin, dir, c, maxDist) {
  const h = c.height === undefined ? 4 : c.height;
  const invX = Math.abs(dir.x) > 1e-8 ? 1 / dir.x : (dir.x >= 0 ? 1e8 : -1e8);
  const invY = Math.abs(dir.y) > 1e-8 ? 1 / dir.y : (dir.y >= 0 ? 1e8 : -1e8);
  const invZ = Math.abs(dir.z) > 1e-8 ? 1 / dir.z : (dir.z >= 0 ? 1e8 : -1e8);

  const tx1 = (c.minX - origin.x) * invX;
  const tx2 = (c.maxX - origin.x) * invX;
  let tmin = Math.min(tx1, tx2);
  let tmax = Math.max(tx1, tx2);
  let nx = tx1 < tx2 ? -1 : 1;
  let ny = 0;
  let nz = 0;

  const ty1 = (0 - origin.y) * invY;
  const ty2 = (h - origin.y) * invY;
  const tyMin = Math.min(ty1, ty2);
  const tyMax = Math.max(ty1, ty2);
  if (tyMin > tmin) {
    tmin = tyMin;
    nx = 0;
    ny = ty1 < ty2 ? -1 : 1;
    nz = 0;
  }
  tmax = Math.min(tmax, tyMax);

  const tz1 = (c.minZ - origin.z) * invZ;
  const tz2 = (c.maxZ - origin.z) * invZ;
  const tzMin = Math.min(tz1, tz2);
  const tzMax = Math.max(tz1, tz2);
  if (tzMin > tmin) {
    tmin = tzMin;
    nx = 0;
    ny = 0;
    nz = tz1 < tz2 ? -1 : 1;
  }
  tmax = Math.min(tmax, tzMax);

  if (tmax < 0.05) return null;
  const t = tmin > 0.05 ? tmin : (tmax > 0.05 ? tmax : -1);
  if (t <= 0.05 || t > maxDist) return null;

  return {
    distance: t,
    point: {
      x: origin.x + dir.x * t,
      y: origin.y + dir.y * t,
      z: origin.z + dir.z * t,
    },
    normal: { x: nx, y: ny, z: nz },
    collider: c,
    material: c.material || 'concrete',
    penetrable: !!c.penetrable,
    penCost: c.penCost !== undefined ? c.penCost : (c.penetrable ? 0.35 : 99),
  };
}

/**
 * Raycast against all world colliders and ground plane, returning sorted list of
 * barrier impacts up to the first solid impenetrable barrier.
 */
export function rayWorldAll(origin, dir, colliders, maxDist) {
  const hits = [];

  if (dir.y < -0.0001) {
    const tGround = -origin.y / dir.y;
    if (tGround > 0.05 && tGround < maxDist) {
      hits.push({
        distance: tGround,
        point: {
          x: origin.x + dir.x * tGround,
          y: 0,
          z: origin.z + dir.z * tGround,
        },
        normal: { x: 0, y: 1, z: 0 },
        collider: null,
        material: 'concrete',
        penetrable: false,
        penCost: 99,
      });
    }
  }

  for (let i = 0; i < colliders.length; i++) {
    const hit = intersectColliderRay(origin, dir, colliders[i], maxDist);
    if (hit) hits.push(hit);
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}

/**
 * Deduplicate raw raycaster hits against overlapping zombie hitboxes.
 * Ensures:
 *  1) Each unique live zombie is struck at most once per bullet ray.
 *  2) If overlapping parts on the SAME zombie sit within `overlapWindow` (e.g. an
 *     outstretched arm or collar crossing head/chest), the higher-priority anatomical
 *     zone wins (head > upperTorso > lowerTorso > limb).
 *  3) Hits closer than 0.05 m (inside muzzle/camera) are rejected.
 */
export function resolveZombieRayHits(rawHits, overlapWindow = 0.14) {
  const perZombie = new Map();
  const ordered = [];

  for (let i = 0; i < rawHits.length; i++) {
    const hit = rawHits[i];
    if (!hit || hit.distance < 0.05) continue;
    const obj = hit.object || hit.mesh;
    const zombie = hit.zombie || (obj && obj.userData && obj.userData.zombie);
    if (!zombie || !zombie.alive) continue;

    const part = hit.part || (obj && obj.userData && obj.userData.part) || 'body';
    const limbId = hit.limbId || (obj && obj.userData && obj.userData.limbId) || (part === 'head' ? 'head' : null);
    const zone = hitZoneFor(part);
    const existing = perZombie.get(zombie);

    if (!existing) {
      const entry = { zombie, mesh: obj, point: hit.point, distance: hit.distance, part, zone, limbId };
      perZombie.set(zombie, entry);
      ordered.push(entry);
    } else if (
      hit.distance - existing.distance <= overlapWindow &&
      zone.priority > existing.zone.priority
    ) {
      // Same body overlap: promote to higher-priority zone (e.g. chest/head behind forearm)
      existing.mesh = obj;
      existing.point = hit.point;
      existing.part = part;
      existing.zone = zone;
      existing.limbId = limbId;
    }
  }

  ordered.sort((a, b) => a.distance - b.distance);
  return ordered;
}

/**
 * Walk sorted zombie hits and sorted barrier hits in ascending distance to
 * produce an ordered sequence of penetration events for a single projectile.
 */
export function resolveBallisticPath(zombieHits, worldHits, opts = {}) {
  const penPower = opts.penPower !== undefined ? opts.penPower : 0.7;
  const maxTargets = opts.maxTargets !== undefined ? opts.maxTargets : 1;

  const events = [];
  let energy = penPower;
  let targetsHit = 0;
  let zi = 0;
  let wi = 0;

  while ((zi < zombieHits.length || wi < worldHits.length) && energy > 0.12) {
    const zNext = zi < zombieHits.length ? zombieHits[zi] : null;
    const wNext = wi < worldHits.length ? worldHits[wi] : null;

    if (wNext && (!zNext || wNext.distance <= zNext.distance)) {
      wi++;
      events.push({
        kind: 'world',
        distance: wNext.distance,
        point: wNext.point,
        normal: wNext.normal,
        material: wNext.material,
        penetrable: wNext.penetrable,
        penetrated: wNext.penetrable && energy > wNext.penCost + 0.12,
      });

      if (!wNext.penetrable || energy <= wNext.penCost + 0.12) {
        break;
      }
      energy -= wNext.penCost;
    } else if (zNext) {
      zi++;
      if (targetsHit >= maxTargets) break;
      const damageScale = Math.max(0.28, Math.min(1, energy / Math.max(0.4, penPower)));
      const cost = zNext.zone.penCost;
      const willPenetrate = targetsHit + 1 < maxTargets && energy - cost > 0.12;
      events.push({
        kind: 'zombie',
        zombie: zNext.zombie,
        mesh: zNext.mesh,
        point: zNext.point,
        distance: zNext.distance,
        part: zNext.part,
        zone: zNext.zone,
        damageScale,
        penetrated: willPenetrate,
        limbId: zNext.limbId || (zNext.mesh && zNext.mesh.userData && zNext.mesh.userData.limbId) || (zNext.part === 'head' ? 'head' : null),
      });
      targetsHit++;
      energy -= cost;
      if (!willPenetrate) break;
    }
  }

  return events;
}
