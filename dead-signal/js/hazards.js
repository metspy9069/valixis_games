// Environmental Hazards Engine for Dead Signal (Day 10).
// Implements:
// 1. Persistent Bubbling Acid Puddles (from Spitter projectiles & spitter deaths).
// 2. Toxic Gas Clouds (from Bloater ruptures, obscuring vision, draining stamina, and causing coughing).
// 3. Catwalk & Elevation Occluded Bloater Blast Damage (3D Euclidean & vertical occlusion).
// 4. Continuous Swept CCD for Acid Projectiles (eliminating tunneling through thin depot metal shutters).
// 5. Chain Reaction Explosions for Bloaters & Explosive Fuel / Biohazard Barrels.

import * as THREE from 'three';
import { rayWorldAll } from './ballistics.js';

export const HAZARD_CONFIG = {
  acidPuddle: {
    duration: 6.0,
    maxRadius: 2.2,
    armorDps: 18.0,
    healthDps: 9.0,
    slowFactor: 0.85,
    growTime: 0.7,
  },
  gasCloud: {
    duration: 5.0,
    maxRadius: 4.8,
    staminaDrain: 28.0,
    dps: 5.5,
    slowFactor: 0.65,
    growTime: 1.2,
    coughInterval: 1.3,
  },
  barrels: {
    fuel: {
      blastRadius: 5.5,
      peakDamage: 140,
      fireRadius: 4.2,
      fireDuration: 6.0,
    },
    biohazard: {
      blastRadius: 5.0,
      peakDamage: 115,
      acidRadius: 2.4,
      gasRadius: 4.5,
    },
  },
};

/**
 * Creates a persistent acidic puddle on the ground.
 */
export function createAcidPuddle(pos, opts = {}) {
  const cfg = HAZARD_CONFIG.acidPuddle;
  return {
    id: 'acid_' + Math.random().toString(36).slice(2, 9),
    pos: new THREE.Vector3(pos.x, pos.y !== undefined ? pos.y : 0.025, pos.z),
    radius: 0.4,
    maxRadius: opts.maxRadius || cfg.maxRadius,
    duration: opts.duration || cfg.duration,
    elapsed: 0,
    active: true,
    armorDps: opts.armorDps || cfg.armorDps,
    healthDps: opts.healthDps || cfg.healthDps,
    slowFactor: opts.slowFactor || cfg.slowFactor,
    sizzleTimer: 0,
  };
}

/**
 * Updates an acid puddle, expanding its radius and corroding player armor / health.
 */
export function updateAcidPuddle(puddle, dt, player, zombies, ctx = {}) {
  if (!puddle || !puddle.active) return;

  puddle.elapsed += dt;
  if (puddle.elapsed >= puddle.duration) {
    puddle.active = false;
    return;
  }

  // Smooth radius expansion in the first 0.7s
  const growProgress = Math.min(1.0, puddle.elapsed / HAZARD_CONFIG.acidPuddle.growTime);
  puddle.radius = 0.4 + (puddle.maxRadius - 0.4) * growProgress;

  // Check player interaction
  if (player && player.pos) {
    const pPos = player.pos;
    const dist2D = Math.hypot(pPos.x - puddle.pos.x, pPos.z - puddle.pos.z);
    const vertDist = Math.abs(pPos.y - puddle.pos.y);

    // Player must be within puddle radius and near ground level (not high on a catwalk)
    if (dist2D <= puddle.radius && vertDist < 1.1) {
      player.inAcidPuddle = true;
      player.hazardSpeedMul = Math.min(player.hazardSpeedMul !== undefined ? player.hazardSpeedMul : 1.0, puddle.slowFactor);

      // Armor corrodes first, then health
      if (player.armor > 0) {
        const armorLoss = Math.min(player.armor, puddle.armorDps * dt);
        player.armor = Math.max(0, player.armor - armorLoss);
      } else {
        const hpLoss = puddle.healthDps * dt;
        if (ctx.damagePlayer) {
          ctx.damagePlayer(hpLoss, null);
        } else {
          player.health = Math.max(0, player.health - hpLoss);
        }
      }

      // Sizzle sound feedback
      puddle.sizzleTimer -= dt;
      if (puddle.sizzleTimer <= 0) {
        puddle.sizzleTimer = 0.45;
        if (ctx.audio && typeof ctx.audio.acidSizzle === 'function') {
          ctx.audio.acidSizzle();
        }
      }
    }
  }

  // Check zombies interaction (regular zombies take minor corrosion damage)
  if (zombies && zombies.length) {
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (!z.alive || z.type === 'spitter' || z.type === 'bloater') continue;
      const zPos = z.group ? z.group.position : (z.pos || null);
      if (!zPos) continue;
      const zd = Math.hypot(zPos.x - puddle.pos.x, zPos.z - puddle.pos.z);
      if (zd <= puddle.radius && Math.abs(zPos.y - puddle.pos.y) < 1.0) {
        if (typeof z.takeDamage === 'function') {
          z.takeDamage(7.0 * dt, 'body', ctx);
        }
      }
    }
  }
}

/**
 * Creates a lingering toxic gas cloud from a bloater rupture.
 */
export function createGasCloud(pos, opts = {}) {
  const cfg = HAZARD_CONFIG.gasCloud;
  return {
    id: 'gas_' + Math.random().toString(36).slice(2, 9),
    pos: new THREE.Vector3(pos.x, pos.y !== undefined ? pos.y : 1.1, pos.z),
    radius: 1.0,
    maxRadius: opts.maxRadius || cfg.maxRadius,
    duration: opts.duration || cfg.duration,
    elapsed: 0,
    active: true,
    staminaDrain: opts.staminaDrain || cfg.staminaDrain,
    dps: opts.dps || cfg.dps,
    slowFactor: opts.slowFactor || cfg.slowFactor,
    coughInterval: opts.coughInterval || cfg.coughInterval,
    coughTimer: 0,
  };
}

/**
 * Updates a toxic gas cloud: drains stamina, obscures vision, slows player, and causes coughing.
 */
export function updateGasCloud(cloud, dt, player, ctx = {}) {
  if (!cloud || !cloud.active) return;

  cloud.elapsed += dt;
  if (cloud.elapsed >= cloud.duration) {
    cloud.active = false;
    return;
  }

  // Expand outwards smoothly over 1.2s
  const growProgress = Math.min(1.0, cloud.elapsed / HAZARD_CONFIG.gasCloud.growTime);
  cloud.radius = 1.0 + (cloud.maxRadius - 1.0) * growProgress;

  if (player && player.pos) {
    const pPos = player.pos;
    // 3D ellipsoidal check (slightly flattened on Y axis)
    const dx = pPos.x - cloud.pos.x;
    const dy = (pPos.y + 0.95 - cloud.pos.y) * 1.2;
    const dz = pPos.z - cloud.pos.z;
    const dist3D = Math.hypot(dx, dy, dz);

    if (dist3D <= cloud.radius) {
      player.inToxicGas = true;
      player.sprinting = false; // Inhaling toxic gas prevents sustained sprinting
      player.stamina = Math.max(0, player.stamina - cloud.staminaDrain * dt);
      player.hazardSpeedMul = Math.min(player.hazardSpeedMul !== undefined ? player.hazardSpeedMul : 1.0, cloud.slowFactor);

      // Light toxic inhalation damage
      const dmg = cloud.dps * dt;
      if (ctx.damagePlayer) {
        ctx.damagePlayer(dmg, null);
      } else {
        player.health = Math.max(0, player.health - dmg);
      }

      // Coughing audio & chest rattle
      cloud.coughTimer -= dt;
      if (cloud.coughTimer <= 0) {
        cloud.coughTimer = cloud.coughInterval;
        if (ctx.audio && typeof ctx.audio.cough === 'function') {
          ctx.audio.cough();
        }
      }
    }
  }
}

/**
 * Calculates Bloater explosion damage using 3D Euclidean distance and true line-of-sight occlusion.
 * Solves the bug where a player on a raised catwalk or sniper roof took full damage from a street-level burst.
 */
export function calculateBloaterBurstDamage({
  bloaterPos,
  targetPos,
  blastRadius = 4.6,
  peakDamage = 95,
  colliders = [],
}) {
  const b = bloaterPos;
  const t = targetPos;
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const dz = t.z - b.z;
  const dist3D = Math.hypot(dx, dy, dz);

  // If outside spherical 3D blast radius: 0 damage
  if (dist3D >= blastRadius || dist3D < 1e-4) {
    return { damage: 0, inRange: false, occluded: false, dist3D };
  }

  // 3D Line-of-sight raycast from bloater burst origin to target
  const dir = new THREE.Vector3(dx / dist3D, dy / dist3D, dz / dist3D);
  const hits = rayWorldAll(new THREE.Vector3(b.x, b.y, b.z), dir, colliders, dist3D);

  // Find if any solid structure (catwalk deck, floor, container, or wall) occludes the blast
  const occluder = hits.find((h) => !h.penetrable && h.distance < dist3D - 0.22);
  if (occluder) {
    return { damage: 0, inRange: true, occluded: true, dist3D, occluder };
  }

  // Falloff linearly from peak * 0.75 at center down to 0 at perimeter
  const falloff = 1 - dist3D / blastRadius;
  const damage = Math.round(peakDamage * 0.75 * falloff);
  return { damage, inRange: true, occluded: false, dist3D };
}

/**
 * Continuous Collision Detection (CCD) for spitter acid projectiles.
 * Traces the flight segment between frames, preventing tunneling through thin depot shutters or walls.
 */
export function stepAcidProjectileCCD({
  from,
  vel,
  dt,
  gravity = 22,
  colliders = [],
  playerPos = null,
  playerChestHeight = 0.95,
  playerRadius = 0.45,
}) {
  const nextVel = vel.clone();
  nextVel.y -= gravity * dt;

  const step = nextVel.clone().multiplyScalar(dt);
  const stepDist = step.length();
  if (stepDist < 1e-5) {
    return { hit: false, nextPos: from.clone(), nextVel };
  }

  const dir = step.clone().normalize();

  // 1. Check solid obstacles along the segment
  const hits = rayWorldAll(from, dir, colliders, stepDist + 0.04);
  const solidHit = hits.find((h) => !h.penetrable && h.distance <= stepDist);

  // 2. Check player hit along segment (if provided)
  let hitPlayer = false;
  let playerDist = Infinity;
  let playerImpactPoint = null;

  if (playerPos) {
    const chest = new THREE.Vector3(playerPos.x, playerPos.y + playerChestHeight, playerPos.z);
    // Project chest onto ray segment
    const vToChest = chest.clone().sub(from);
    const proj = vToChest.dot(dir);
    if (proj >= 0 && proj <= stepDist + playerRadius) {
      const closestPoint = from.clone().addScaledVector(dir, proj);
      if (closestPoint.distanceTo(chest) <= playerRadius + 0.16) {
        hitPlayer = true;
        playerDist = Math.max(0, proj);
        playerImpactPoint = closestPoint;
      }
    }
  }

  // Player hit takes priority if closer than wall
  if (hitPlayer && (!solidHit || playerDist < solidHit.distance)) {
    return {
      hit: true,
      hitType: 'player',
      point: playerImpactPoint,
      nextPos: playerImpactPoint,
      nextVel,
    };
  }

  // Obstacle hit (e.g. closed metal shutter)
  if (solidHit) {
    const impactPoint = from.clone().addScaledVector(dir, solidHit.distance);
    return {
      hit: true,
      hitType: 'obstacle',
      point: impactPoint,
      normal: solidHit.normal,
      nextPos: impactPoint,
      nextVel,
    };
  }

  // Ground check
  const nextPos = from.clone().add(step);
  if (nextPos.y <= 0.12) {
    nextPos.y = 0.025;
    return {
      hit: true,
      hitType: 'ground',
      point: nextPos,
      nextPos,
      nextVel,
    };
  }

  return {
    hit: false,
    hitType: null,
    nextPos,
    nextVel,
  };
}

/**
 * Tactical Chain Reaction Detonations.
 * When a bloater or explosive barrel detonates, checks nearby barrels and bloaters,
 * triggering cascading chain reactions.
 */
export function evaluateChainReaction({
  origin,
  blastRadius,
  blastDamage,
  barrels = [],
  zombies = [],
  colliders = [],
  ctx = {},
}) {
  const triggeredBarrels = [];
  const triggeredBloaters = [];

  // 1. Check nearby explosive barrels
  for (let i = 0; i < barrels.length; i++) {
    const b = barrels[i];
    if (!b.active) continue;
    const dist = Math.hypot(b.pos.x - origin.x, b.pos.z - origin.z);
    if (dist <= blastRadius) {
      b.hp -= blastDamage * (1 - dist / blastRadius);
      if (b.hp <= 0) {
        b.active = false;
        triggeredBarrels.push(b);
      }
    }
  }

  // 2. Check nearby bloaters
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i];
    if (!z.alive || z.type !== 'bloater') continue;
    const zPos = z.group ? z.group.position : z.pos;
    if (!zPos) continue;
    const res = calculateBloaterBurstDamage({
      bloaterPos: origin,
      targetPos: zPos,
      blastRadius,
      peakDamage: blastDamage,
      colliders,
    });
    if (res.inRange && !res.occluded && res.damage > 0) {
      z.hp -= res.damage;
      if (z.hp <= 0) {
        triggeredBloaters.push(z);
      }
    }
  }

  return { triggeredBarrels, triggeredBloaters };
}
