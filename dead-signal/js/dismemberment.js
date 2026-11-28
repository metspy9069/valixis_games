/**
 * Zombie Locational Dismemberment & Crawler System (Day 8)
 *
 * Implements:
 * 1. Modular Mesh Slicing & Decapitation:
 *    - Headshot kill: Detaches head mesh, spawns flying skull debris, arterial neck spray.
 *    - Arm dismemberment: Severing arms disables claw attacks, reducing damage output by 50% (or 85% for both).
 *    - Leg severing: Converts standing zombies into low-profile Crawlers that drag along the ground.
 * 2. Crawlers Archetype:
 *    - Slower movement (0.8 m/s), low-profile collision, attacks player ankles.
 * 3. Bug Fixes:
 *    - Ragdoll curb jitter fix: Non-penetrating death fall clamping & post-landing physics freeze.
 *    - Headshot particle fix: Ensures all headshot arterial blood fountains originate at neck/head height, never ground/feet.
 */

import * as THREE from 'three';

export const LIMB_TYPES = {
  HEAD: 'head',
  ARM_L: 'armL',
  ARM_R: 'armR',
  LEG_L: 'legL',
  LEG_R: 'legR',
};

export const LIMB_THRESHOLDS = {
  armL: 35,
  armR: 35,
  legL: 45,
  legR: 45,
};

/**
 * Procedural Gore Debris Pool: Reusable detached skulls, arms, and legs.
 */
export class GoreDebrisPool {
  constructor(scene, maxDebris = 36) {
    this.scene = scene;
    this.maxDebris = maxDebris;
    this.debris = [];
    this.initPool();
  }

  initPool() {
    if (!this.scene || typeof THREE === 'undefined') return;

    // Materials
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.65 });
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x5c151c, roughness: 0.8 });
    const darkClothMat = new THREE.MeshStandardMaterial({ color: 0x222622, roughness: 0.9 });

    // Geometries
    const skullGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const armGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.38, 6);
    const legGeo = new THREE.CylinderGeometry(0.06, 0.075, 0.44, 6);

    for (let i = 0; i < this.maxDebris; i++) {
      const type = i % 3 === 0 ? 'head' : i % 3 === 1 ? 'arm' : 'leg';
      const geo = type === 'head' ? skullGeo : type === 'arm' ? armGeo : legGeo;
      const mat = type === 'head' ? boneMat : type === 'arm' ? fleshMat : darkClothMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.scene.add(mesh);

      this.debris.push({
        mesh,
        type,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 6.0,
        grounded: false,
      });
    }
  }

  spawn(type, worldPos, direction, speed = 4.2) {
    const item = this.debris.find((d) => !d.active && d.type === (type === 'head' ? 'head' : type.startsWith('arm') ? 'arm' : 'leg'))
      || this.debris.find((d) => !d.active)
      || this.debris[0];

    if (!item || !item.mesh) return null;

    item.active = true;
    item.life = 0;
    item.grounded = false;
    item.mesh.visible = true;

    item.pos.copy(worldPos);
    item.mesh.position.copy(worldPos);

    // Ballistic trajectory with outward spread and upward impulse
    const spreadX = (Math.random() - 0.5) * 1.2;
    const spreadZ = (Math.random() - 0.5) * 1.2;
    const dir = direction ? direction.clone().normalize() : new THREE.Vector3(spreadX, 0.8, spreadZ).normalize();

    item.vel.set(
      dir.x * speed + spreadX,
      Math.max(1.8, dir.y * speed + 2.2 + Math.random() * 1.5),
      dir.z * speed + spreadZ
    );

    item.rotVel.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14
    );

    return item;
  }

  update(dt, colliders = []) {
    for (const d of this.debris) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life > d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      if (!d.grounded) {
        // Integrate gravity and velocity
        d.vel.y -= 17.5 * dt;
        d.pos.addScaledVector(d.vel, dt);

        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;
        d.mesh.rotation.z += d.rotVel.z * dt;

        // Ground collision plane at pavement height (y = 0.08)
        if (d.pos.y <= 0.08) {
          d.pos.y = 0.08;
          if (Math.abs(d.vel.y) > 1.2) {
            d.vel.y = -d.vel.y * 0.32; // Restitution bounce
            d.vel.x *= 0.65;          // Ground friction
            d.vel.z *= 0.65;
            d.rotVel.multiplyScalar(0.5);
          } else {
            d.vel.set(0, 0, 0);
            d.rotVel.set(0, 0, 0);
            d.grounded = true;
          }
        }
      }

      d.mesh.position.copy(d.pos);
    }
  }

  reset() {
    for (const d of this.debris) {
      d.active = false;
      if (d.mesh) d.mesh.visible = false;
    }
  }
}

/**
 * High-pressure Arterial Spray Fountain for Decapitations.
 * Guarantees blood arcs fountain upwards from neck height (~1.6m), not feet (y=0).
 */
export class ArterialSprayPool {
  constructor(scene, maxSprays = 40) {
    this.scene = scene;
    this.maxSprays = maxSprays;
    this.drops = [];
    this.initPool();
  }

  initPool() {
    if (!this.scene || typeof THREE === 'undefined') return;
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8a0b12 });
    const dropGeo = new THREE.BoxGeometry(0.045, 0.08, 0.045);

    for (let i = 0; i < this.maxSprays; i++) {
      const mesh = new THREE.Mesh(dropGeo, bloodMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.drops.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.65,
      });
    }
  }

  spawnSpray(neckWorldPos, count = 12) {
    // Enforce safety: Neck position cannot be on the ground (< 0.8m)
    const startY = Math.max(1.35, neckWorldPos.y || 1.6);
    const startX = neckWorldPos.x || 0;
    const startZ = neckWorldPos.z || 0;

    for (let i = 0; i < count; i++) {
      const drop = this.drops.find((d) => !d.active);
      if (!drop) break;

      drop.active = true;
      drop.life = 0;
      drop.mesh.visible = true;
      drop.pos.set(
        startX + (Math.random() - 0.5) * 0.08,
        startY + (Math.random() - 0.5) * 0.05,
        startZ + (Math.random() - 0.5) * 0.08
      );
      drop.mesh.position.copy(drop.pos);

      // High-pressure vertical fountain with arterial jitter
      const angle = Math.random() * Math.PI * 2;
      const horizSpeed = 0.5 + Math.random() * 1.4;
      drop.vel.set(
        Math.cos(angle) * horizSpeed,
        3.5 + Math.random() * 3.2, // Strong upward spurt
        Math.sin(angle) * horizSpeed
      );
    }
  }

  update(dt) {
    for (const d of this.drops) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life > d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      d.vel.y -= 18.0 * dt; // Rapid gravity pull
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y <= 0.02) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.mesh.position.copy(d.pos);
    }
  }

  reset() {
    for (const d of this.drops) {
      d.active = false;
      if (d.mesh) d.mesh.visible = false;
    }
  }
}

/**
 * Initializes dismemberment state on a Zombie instance.
 */
export function initZombieDismemberment(zombie) {
  zombie.dismembered = {
    head: false,
    armL: false,
    armR: false,
    legL: false,
    legR: false,
  };
  zombie.limbHealth = {
    armL: LIMB_THRESHOLDS.armL,
    armR: LIMB_THRESHOLDS.armR,
    legL: LIMB_THRESHOLDS.legL,
    legR: LIMB_THRESHOLDS.legR,
  };
  zombie.baseDamage = (zombie.damage !== undefined && zombie.damage !== null)
    ? zombie.damage
    : ((zombie.def && zombie.def.damage) || 20);
  zombie.isCrawler = false;
  zombie.crawlPhase = Math.random() * 6.28;
  zombie.ragdollSettled = false;
}

/**
 * Sever a specific limb on a zombie entity.
 * Handles mesh detachment, debris spawn, arterial spray, damage reduction, and crawler transitions.
 */
export function severZombieLimb(zombie, limbId, hitPoint = null, shotDir = null, ctx = null) {
  if (!zombie || !zombie.dismembered) return null;
  if (zombie.dismembered[limbId]) return null; // Already severed

  zombie.dismembered[limbId] = true;
  const rig = zombie.rig;
  const pos = zombie.group ? zombie.group.position : new THREE.Vector3();

  // 1. HEAD DECAPITATION
  if (limbId === 'head') {
    if (rig) {
      if (rig.head) rig.head.visible = false;
      if (rig.jaw) rig.jaw.visible = false;
      if (rig.facialDetail) {
        for (const part of rig.facialDetail) {
          if (part) part.visible = false;
        }
      }
    }

    // World position of neck stump (guaranteed >= 1.4m height, never ground)
    const neckPos = pos.clone();
    neckPos.y += zombie.isCrawler ? 0.38 : (1.62 * (zombie.def ? zombie.def.scale : 1.0));

    if (ctx && ctx.debrisPool) {
      ctx.debrisPool.spawn('head', neckPos, shotDir, 4.8);
    }
    if (ctx && ctx.arterialPool) {
      ctx.arterialPool.spawnSpray(neckPos, 16);
    }
    if (ctx && ctx.audio && ctx.audio.headshotCrunch) {
      ctx.audio.headshotCrunch();
    }

    // Fatal blow
    if (zombie.alive) {
      zombie.die(ctx, 'head');
    }

    return { limbId, severed: true, fatal: true, crawler: false };
  }

  // 2. ARM DISMEMBERMENT (Left or Right)
  if (limbId === 'armL' || limbId === 'armR') {
    if (rig && rig[limbId] && rig[limbId].shoulder) {
      rig[limbId].shoulder.visible = false;
    }

    const shoulderPos = pos.clone();
    const side = limbId === 'armL' ? -0.28 : 0.28;
    shoulderPos.x += side;
    shoulderPos.y += zombie.isCrawler ? 0.28 : 1.42;

    if (ctx && ctx.debrisPool) {
      ctx.debrisPool.spawn(limbId, shoulderPos, shotDir, 3.8);
    }
    if (ctx && ctx.spawnBlood) {
      ctx.spawnBlood(shoulderPos, 9, 'blood');
    }

    // Claw attack damage reduction: 50% for 1 arm, 85% for both arms
    const lostBoth = zombie.dismembered.armL && zombie.dismembered.armR;
    zombie.damage = Math.round(zombie.baseDamage * (lostBoth ? 0.15 : 0.5));

    return { limbId, severed: true, fatal: false, crawler: false, damageReducedTo: zombie.damage };
  }

  // 3. LEG DISMEMBERMENT & CRAWLER CONVERSION
  if (limbId === 'legL' || limbId === 'legR') {
    if (rig && rig[limbId]) {
      // Hide lower leg and foot, keeping thigh stump visible
      if (rig[limbId].knee) rig[limbId].knee.visible = false;
      else if (rig[limbId].hip) rig[limbId].hip.visible = false;
    }

    const hipPos = pos.clone();
    hipPos.y += 0.85;

    if (ctx && ctx.debrisPool) {
      ctx.debrisPool.spawn(limbId, hipPos, shotDir, 3.5);
    }
    if (ctx && ctx.spawnBlood) {
      ctx.spawnBlood(hipPos, 10, 'blood');
    }

    // Convert to Crawler Archetype (Non-boss, non-brute)
    if (!zombie.isBoss && zombie.type !== 'brute' && !zombie.isCrawler) {
      convertToCrawler(zombie);
      return { limbId, severed: true, fatal: false, crawler: true };
    }

    return { limbId, severed: true, fatal: false, crawler: false };
  }

  return null;
}

/**
 * Converts a standard standing zombie into a low-profile crawling predator.
 */
export function convertToCrawler(zombie) {
  zombie.isCrawler = true;
  zombie.speed = 0.8; // Crawlers move at 0.8 m/s
  zombie.radius = 0.38; // Narrower profile
  zombie.reach = 0.95;  // Low ankle bite reach
  zombie.flinch = 1.3;  // Collapse flinch impact

  // Drop hitboxes to ground level
  if (zombie.hitMeshes) {
    for (const mesh of zombie.hitMeshes) {
      if (mesh.userData) mesh.userData.crawler = true;
    }
  }
}

/**
 * Ragdoll curb collision settlement.
 * Clamps death roll/pitch to prevent street curb clipping and freezes physics upon landing.
 */
export function settleRagdollDeath(zombie, dt, colliders = []) {
  if (zombie.alive) return;

  zombie.deadTimer += dt;
  const fallProgress = Math.min(1.0, zombie.deadTimer / 0.55);

  // Once the body has fallen (t >= 0.55s), freeze orientation to prevent jitter
  if (fallProgress >= 1.0) {
    zombie.ragdollSettled = true;
    // Sinking through the road after 2.4 seconds
    zombie.group.position.y = -Math.max(0, zombie.deadTimer - 2.4) * 0.45;
    return;
  }

  // Smooth ease-out fall
  const t = 1 - Math.pow(1 - fallProgress, 3);
  zombie.group.rotation.x = zombie.deathPitch * t;
  zombie.group.rotation.z = zombie.deathRoll * t;

  // Ensure body position does not penetrate colliders
  if (colliders && colliders.length) {
    const pos = zombie.group.position;
    for (const c of colliders) {
      const minX = c.x - c.hx;
      const maxX = c.x + c.hx;
      const minZ = c.z - c.hz;
      const maxZ = c.z + c.hz;

      // Distance to box
      const cx = Math.max(minX, Math.min(maxX, pos.x));
      const cz = Math.max(minZ, Math.min(maxZ, pos.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      const r = zombie.radius || 0.4;

      if (d2 < r * r && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = r - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
        // Dampen death roll away from collider normal
        zombie.deathRoll *= 0.5;
      }
    }
  }
}
