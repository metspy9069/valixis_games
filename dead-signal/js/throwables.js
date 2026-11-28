/**
 * Tactical Ordnance & Throwables Engine (Day 6)
 *
 * Implements:
 * - 3 distinct throwable tactical items:
 *   1. Frag Grenade (M67): High explosive blast with cookable fuse and airburst.
 *   2. Molotov Cocktail: Ground fire pool with expanding radius and 8s area denial DoT.
 *   3. Pipe Bomb / Siren Lure: High-pitched pulsing beeps drawing horde aggro before detonating.
 * - Continuous Collision Detection (CCD) preventing downward sidewalk tunneling.
 * - Solid barrier line-of-sight occlusion raycast preventing explosion blast penetration.
 * - Cookable fuse state machine with tactical airburst timing.
 * - Pre-computed ballistic trajectory arc preview points.
 */

export const THROWABLE_TYPES = {
  frag: {
    id: 'frag',
    name: 'M67 FRAG',
    shortName: 'FRAG',
    desc: 'High-explosive fragmentation grenade. Cookable fuse for tactical airbursts.',
    fuse: 2.2,
    minCookFuse: 0.2,
    radius: 5.8,
    damage: 320,
    minDamage: 55,
    throwSpeed: 17.5,
    upwardVel: 5.2,
    gravity: 20.0,
    bounciness: 0.36,
    friction: 0.68,
    shattersOnImpact: false,
    color: 0x39412c,
  },
  molotov: {
    id: 'molotov',
    name: 'MOLOTOV COCKTAIL',
    shortName: 'MOLOTOV',
    desc: 'Glass incendiary bottle. Spawns an expanding 8-second pool of fire with area denial DoT.',
    fuse: 6.0,
    minCookFuse: 0.4,
    radius: 4.5,
    poolDuration: 8.0,
    dps: 34,
    burnDuration: 2.8,
    burnDps: 15,
    throwSpeed: 16.0,
    upwardVel: 4.8,
    gravity: 20.0,
    bounciness: 0.05,
    friction: 0.88,
    shattersOnImpact: true,
    color: 0xc87533,
  },
  pipeBomb: {
    id: 'pipeBomb',
    name: 'PIPE BOMB LURE',
    shortName: 'PIPE BOMB',
    desc: 'Siren lure bomb. Pulses high-pitched beeps drawing all horde aggro for 3.5s before exploding.',
    fuse: 3.5,
    minCookFuse: 0.3,
    radius: 6.6,
    damage: 420,
    minDamage: 85,
    lureRadius: 22.0,
    lureDuration: 3.5,
    beepInterval: 0.26,
    throwSpeed: 15.0,
    upwardVel: 4.6,
    gravity: 20.0,
    bounciness: 0.24,
    friction: 0.72,
    shattersOnImpact: false,
    color: 0x828b8f,
  },
};

/**
 * Checks if a ray segment from `start` to `end` is occluded by any solid collider.
 * Fixes the bug where explosion damage penetrates solid concrete barrier walls.
 */
export function isExplosionOccluded(start, end, colliders) {
  if (!colliders || colliders.length === 0) return false;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq < 1e-6) return false;
  const dist = Math.sqrt(distSq);

  const invDx = Math.abs(dx) > 1e-8 ? 1.0 / dx : 1e8;
  const invDy = Math.abs(dy) > 1e-8 ? 1.0 / dy : 1e8;
  const invDz = Math.abs(dz) > 1e-8 ? 1.0 / dz : 1e8;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    // Solid barriers/buildings block blast pressure waves.
    // If penetrable is explicitly marked true and thin, partial shockwave could pass,
    // but concrete barriers (penetrable === false or default) completely occlude.
    if (c.penetrable === true) continue;

    const minX = c.minX;
    const maxX = c.maxX;
    const minY = c.minY !== undefined ? c.minY : 0.0;
    const maxY = c.maxY !== undefined ? c.maxY : (c.height !== undefined ? c.height : 4.0);
    const minZ = c.minZ;
    const maxZ = c.maxZ;

    // Ray-AABB slab intersection test
    const tx1 = (minX - start.x) * invDx;
    const tx2 = (maxX - start.x) * invDx;
    let tmin = Math.min(tx1, tx2);
    let tmax = Math.max(tx1, tx2);

    const ty1 = (minY - start.y) * invDy;
    const ty2 = (maxY - start.y) * invDy;
    tmin = Math.max(tmin, Math.min(ty1, ty2));
    tmax = Math.min(tmax, Math.max(ty1, ty2));

    const tz1 = (minZ - start.z) * invDz;
    const tz2 = (maxZ - start.z) * invDz;
    tmin = Math.max(tmin, Math.min(tz1, tz2));
    tmax = Math.min(tmax, Math.max(tz1, tz2));

    // Intersection occurred between start (t = 0.03) and end (t = 0.97)
    if (tmax >= tmin && tmax > 0.03 && tmin < 0.97) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates radial blast damage accounting for distance falloff and solid wall occlusion.
 */
export function calculateExplosionDamage(blastPos, targetPos, baseDamage, minDamage, radius, isOccluded = false) {
  if (isOccluded) {
    return { damage: 0, distance: 0, falloff: 0, occluded: true };
  }

  const dx = targetPos.x - blastPos.x;
  const dy = targetPos.y - blastPos.y;
  const dz = targetPos.z - blastPos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist > radius) {
    return { damage: 0, distance: dist, falloff: 0, occluded: false };
  }

  const falloff = 1.0 - (dist / radius);
  const rawDamage = minDamage + (baseDamage - minDamage) * falloff;

  return {
    damage: Math.round(rawDamage),
    distance: dist,
    falloff,
    occluded: false,
  };
}

/**
 * Continuous Collision Detection (CCD) integration step for throwables.
 * Prevents projectiles from tunneling through sidewalk seams or floor planes
 * when thrown at steep downward angles or at high velocities.
 */
export function stepThrowablePhysics(proj, dt, colliders, groundY = 0.08) {
  const gravity = proj.def.gravity || 20.0;
  const bounciness = proj.def.bounciness !== undefined ? proj.def.bounciness : 0.35;
  const friction = proj.def.friction !== undefined ? proj.def.friction : 0.68;
  const radius = proj.radius || 0.1;

  // Apply gravity
  proj.vel.y -= gravity * dt;

  // Check sub-stepped trajectory for continuous collision resolution
  const startX = proj.pos.x;
  const startY = proj.pos.y;
  const startZ = proj.pos.z;

  const targetX = startX + proj.vel.x * dt;
  const targetY = startY + proj.vel.y * dt;
  const targetZ = startZ + proj.vel.z * dt;

  let groundHit = false;
  let wallHit = false;
  let normal = null;
  let impactSpeed = 0;

  // 1. Continuous Ground/Sidewalk Collision:
  // If moving downward and target position penetrates below ground plane
  if (proj.vel.y < 0 && targetY < groundY + radius) {
    groundHit = true;
    impactSpeed = Math.abs(proj.vel.y);
    const dy = startY - (groundY + radius);
    const frac = proj.vel.y !== 0 ? Math.max(0, Math.min(1, dy / -proj.vel.y / dt)) : 0;

    proj.pos.x = startX + proj.vel.x * dt * frac;
    proj.pos.y = groundY + radius;
    proj.pos.z = startZ + proj.vel.z * dt * frac;

    // Bounce restitution
    proj.vel.y = Math.abs(proj.vel.y) * bounciness;
    proj.vel.x *= friction;
    proj.vel.z *= friction;
    normal = { x: 0, y: 1, z: 0 };
  } else {
    proj.pos.x = targetX;
    proj.pos.y = targetY;
    proj.pos.z = targetZ;
  }

  // 2. Obstacle & Wall AABB Collision Resolution
  if (colliders && colliders.length > 0) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const h = c.height !== undefined ? c.height : (c.maxY !== undefined ? c.maxY : 4.0);
      if (proj.pos.y > h + radius) continue;

      const minX = c.minX - radius;
      const maxX = c.maxX + radius;
      const minZ = c.minZ - radius;
      const maxZ = c.maxZ + radius;

      if (proj.pos.x > minX && proj.pos.x < maxX && proj.pos.z > minZ && proj.pos.z < maxZ) {
        wallHit = true;
        // Determine closest face to push out
        const dLeft = Math.abs(proj.pos.x - minX);
        const dRight = Math.abs(maxX - proj.pos.x);
        const dTop = Math.abs(proj.pos.z - minZ);
        const dBottom = Math.abs(maxZ - proj.pos.z);
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) {
          proj.pos.x = minX;
          proj.vel.x = -Math.abs(proj.vel.x) * bounciness;
          normal = { x: -1, y: 0, z: 0 };
        } else if (minD === dRight) {
          proj.pos.x = maxX;
          proj.vel.x = Math.abs(proj.vel.x) * bounciness;
          normal = { x: 1, y: 0, z: 0 };
        } else if (minD === dTop) {
          proj.pos.z = minZ;
          proj.vel.z = -Math.abs(proj.vel.z) * bounciness;
          normal = { x: 0, y: 0, z: -1 };
        } else {
          proj.pos.z = maxZ;
          proj.vel.z = Math.abs(proj.vel.z) * bounciness;
          normal = { x: 0, y: 0, z: 1 };
        }

        proj.vel.y *= friction;
        break;
      }
    }
  }

  // Update spin / rotation
  if (proj.spin && proj.rot) {
    proj.rot.x += proj.spin.x * dt;
    proj.rot.y += proj.spin.y * dt;
    proj.rot.z += proj.spin.z * dt;
    if (groundHit) {
      proj.spin.x *= 0.7;
      proj.spin.y *= 0.7;
      proj.spin.z *= 0.7;
    }
  }

  return { groundHit, wallHit, normal, impactSpeed };
}

/**
 * Fuse cooking state machine.
 * Allows player to hold the throw key to cook the fuse down for precision airbursts.
 */
export function createCookState(typeId = 'frag') {
  const def = THROWABLE_TYPES[typeId] || THROWABLE_TYPES.frag;
  return {
    typeId,
    def,
    isCooking: true,
    totalFuse: def.fuse,
    fuseRemaining: def.fuse,
    cookingDuration: 0,
    detonatedInHand: false,
  };
}

export function updateCookState(cookState, dt) {
  if (!cookState || !cookState.isCooking || cookState.detonatedInHand) {
    return cookState;
  }

  cookState.cookingDuration += dt;
  cookState.fuseRemaining -= dt;

  if (cookState.fuseRemaining <= 0) {
    cookState.fuseRemaining = 0;
    cookState.detonatedInHand = true;
    cookState.isCooking = false;
  }

  return cookState;
}

export function releaseCookState(cookState) {
  if (!cookState) return { fuse: 2.0, detonatedInHand: false };
  cookState.isCooking = false;

  if (cookState.detonatedInHand) {
    return { fuse: 0, detonatedInHand: true };
  }

  const minFuse = cookState.def.minCookFuse || 0.2;
  const finalFuse = Math.max(minFuse, cookState.fuseRemaining);

  return {
    fuse: finalFuse,
    detonatedInHand: false,
    cookedDuration: cookState.cookingDuration,
  };
}

/**
 * Computes ballistic trajectory arc points for visual HUD arc aiming preview.
 */
export function computeTrajectoryArc(origin, dir, throwSpeed, upwardVel, gravity, colliders, groundY = 0.08, maxSteps = 24, stepDt = 0.045) {
  const points = [];
  const currentPos = { x: origin.x, y: origin.y, z: origin.z };
  const currentVel = {
    x: dir.x * throwSpeed,
    y: dir.y * throwSpeed + upwardVel,
    z: dir.z * throwSpeed,
  };

  points.push({ x: currentPos.x, y: currentPos.y, z: currentPos.z });

  for (let s = 0; s < maxSteps; s++) {
    currentVel.y -= gravity * stepDt;
    currentPos.x += currentVel.x * stepDt;
    currentPos.y += currentVel.y * stepDt;
    currentPos.z += currentVel.z * stepDt;

    // Ground intersection
    if (currentPos.y <= groundY) {
      currentPos.y = groundY;
      points.push({ x: currentPos.x, y: currentPos.y, z: currentPos.z });
      break;
    }

    // Collider obstruction
    let hitCollider = false;
    if (colliders) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const h = c.height !== undefined ? c.height : 4.0;
        if (currentPos.y < h && currentPos.x > c.minX && currentPos.x < c.maxX && currentPos.z > c.minZ && currentPos.z < c.maxZ) {
          hitCollider = true;
          break;
        }
      }
    }

    points.push({ x: currentPos.x, y: currentPos.y, z: currentPos.z });
    if (hitCollider) break;
  }

  return points;
}

/**
 * Creates an incendiary ground fire pool (Molotov).
 */
export function createFirePool(pos, def = THROWABLE_TYPES.molotov) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    pos: { x: pos.x, y: pos.y || 0.05, z: pos.z },
    radius: 0.6,
    maxRadius: def.radius || 4.5,
    duration: def.poolDuration || 8.0,
    elapsed: 0,
    dps: def.dps || 34,
    burnDuration: def.burnDuration || 2.8,
    burnDps: def.burnDps || 15,
    active: true,
  };
}

/**
 * Updates an incendiary fire pool and processes damage-over-time.
 */
export function updateFirePool(pool, dt, zombies, playerPos, onDamageZombie, onDamagePlayer) {
  if (!pool || !pool.active) return;

  pool.elapsed += dt;
  // Radius expands outwards smoothly over 1.2s
  const growProgress = Math.min(1.0, pool.elapsed / 1.2);
  pool.radius = 0.6 + (pool.maxRadius - 0.6) * growProgress;

  if (pool.elapsed >= pool.duration) {
    pool.active = false;
    return;
  }

  // Damage zombies inside fire pool
  if (zombies && onDamageZombie) {
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (!z.alive) continue;
      const zPos = z.group ? z.group.position : z.pos;
      if (!zPos) continue;

      const dx = zPos.x - pool.pos.x;
      const dz = zPos.z - pool.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= pool.radius) {
        const stepDamage = pool.dps * dt;
        onDamageZombie(z, stepDamage, pool.burnDuration, pool.burnDps);
      }
    }
  }

  // Damage player if caught in fire pool
  if (playerPos && onDamagePlayer) {
    const px = playerPos.x - pool.pos.x;
    const pz = playerPos.z - pool.pos.z;
    const pDist = Math.sqrt(px * px + pz * pz);
    if (pDist <= pool.radius) {
      onDamagePlayer(18 * dt);
    }
  }
}

/**
 * Creates a Siren Lure (Pipe Bomb).
 */
export function createPipeBombLure(pos, def = THROWABLE_TYPES.pipeBomb) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    pos: { x: pos.x, y: pos.y || 0.1, z: pos.z },
    lureRadius: def.lureRadius || 22.0,
    duration: def.lureDuration || 3.5,
    elapsed: 0,
    beepInterval: def.beepInterval || 0.26,
    beepTimer: 0,
    active: true,
    detonated: false,
    def,
  };
}

/**
 * Updates a Siren Lure and determines audio beep cadence.
 */
export function updatePipeBombLure(lure, dt, onBeep) {
  if (!lure || !lure.active) return;

  lure.elapsed += dt;
  lure.beepTimer -= dt;

  if (lure.beepTimer <= 0) {
    lure.beepTimer = lure.beepInterval;
    if (onBeep) onBeep(lure.pos, lure.elapsed);
  }

  if (lure.elapsed >= lure.duration) {
    lure.active = false;
    lure.detonated = true;
  }
}

/**
 * Finds the closest active siren lure within detection radius for a zombie.
 * Overrides zombie aggro to draw the horde toward the lure!
 */
export function findActiveLureTarget(lures, zombiePos) {
  if (!lures || lures.length === 0 || !zombiePos) return null;

  let closestLure = null;
  let closestDistSq = Infinity;

  for (let i = 0; i < lures.length; i++) {
    const lure = lures[i];
    if (!lure.active) continue;

    const dx = lure.pos.x - zombiePos.x;
    const dz = lure.pos.z - zombiePos.z;
    const distSq = dx * dx + dz * dz;
    const lureRadSq = lure.lureRadius * lure.lureRadius;

    if (distSq <= lureRadSq && distSq < closestDistSq) {
      closestDistSq = distSq;
      closestLure = lure;
    }
  }

  return closestLure ? closestLure.pos : null;
}
