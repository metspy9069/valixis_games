// Zombies: hand-built skeletal hierarchy plus procedural animation and a
// simple state machine (wander -> chase -> attack -> die).
import * as THREE from 'three';
import { resolveCircle } from './world.js';

export const TYPES = {
  walker: {
    hp: 100, speed: 2.05, damage: 11, reach: 1.9, scale: 1, score: 100,
    skin: 0x6f8a5a, shirt: 0x33382c, pants: 0x262a22, eye: 0xd6ff5c,
  },
  runner: {
    hp: 58, speed: 4.2, damage: 7, reach: 1.75, scale: 0.93, score: 160,
    skin: 0xa88a68, shirt: 0x48282a, pants: 0x2a2020, eye: 0xff7a3d,
  },
  brute: {
    hp: 430, speed: 1.4, damage: 30, reach: 2.3, scale: 1.6, score: 450,
    skin: 0x7d7452, shirt: 0x2c2822, pants: 0x1f1c18, eye: 0xff2f2f,
  },
};

// Shared geometry so thirty zombies cost a handful of buffers, not hundreds.
const G = {
  torso: new THREE.BoxGeometry(0.52, 0.62, 0.3),
  chest: new THREE.BoxGeometry(0.58, 0.24, 0.34),
  head: new THREE.BoxGeometry(0.27, 0.29, 0.27),
  jaw: new THREE.BoxGeometry(0.2, 0.09, 0.1),
  eye: new THREE.BoxGeometry(0.038, 0.026, 0.03),
  upperArm: new THREE.BoxGeometry(0.13, 0.42, 0.14),
  foreArm: new THREE.BoxGeometry(0.11, 0.38, 0.12),
  hand: new THREE.BoxGeometry(0.13, 0.16, 0.09),
  thigh: new THREE.BoxGeometry(0.17, 0.46, 0.18),
  shin: new THREE.BoxGeometry(0.14, 0.44, 0.15),
  foot: new THREE.BoxGeometry(0.17, 0.1, 0.28),
};

const materials = {};
function matFor(type) {
  if (materials[type]) return materials[type];
  const def = TYPES[type];
  materials[type] = {
    skin: new THREE.MeshStandardMaterial({ color: def.skin, roughness: 0.92, metalness: 0.02, flatShading: true }),
    shirt: new THREE.MeshStandardMaterial({ color: def.shirt, roughness: 0.95, flatShading: true }),
    pants: new THREE.MeshStandardMaterial({ color: def.pants, roughness: 0.95, flatShading: true }),
    eye: new THREE.MeshStandardMaterial({ color: def.eye, emissive: def.eye, emissiveIntensity: 3.4 }),
  };
  return materials[type];
}

function part(geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export class Zombie {
  constructor(typeKey, position, rng = Math.random) {
    this.type = typeKey;
    this.def = TYPES[typeKey];
    this.rng = rng;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    // Per-instance so the wave director can scale threat without mutating the
    // shared type table (or the TTK of every other zombie on screen).
    this.damage = this.def.damage;
    this.alive = true;
    this.removed = false;
    this.state = 'idle';
    this.speed = this.def.speed * (0.9 + rng() * 0.2);
    this.radius = 0.4 * this.def.scale;
    this.phase = rng() * Math.PI * 2;
    this.growlTimer = 1 + rng() * 4;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.windup = 0;
    this.flinch = 0;
    this.hitTimer = 0;
    this.deadTimer = 0;
    this.wanderDir = new THREE.Vector3(0, 0, 1);
    this.wanderTimer = 0;
    this.avoidDir = new THREE.Vector3();
    this.avoidTime = 0;
    this.stuckTime = 0;
    this.home = position.clone();
    this.build();
    this.group.position.copy(position);
  }

  build() {
    const m = matFor(this.type);
    const g = new THREE.Group();
    g.scale.setScalar(this.def.scale);

    // Root sits at the feet so the physics position is the ground point.
    const hips = new THREE.Group();
    hips.position.y = 0.9;
    g.add(hips);

    const torso = part(G.torso, m.shirt, 0, 0.3, 0);
    hips.add(torso);

    const chest = part(G.chest, m.shirt, 0, 0.52, 0);
    hips.add(chest);

    // Neck + head.
    const neck = new THREE.Group();
    neck.position.set(0, 0.62, 0);
    hips.add(neck);
    const head = part(G.head, m.skin, 0, 0.16, 0);
    neck.add(head);
    const jaw = part(G.jaw, m.skin, 0, 0.05, 0.09);
    neck.add(jaw);
    const eyeL = part(G.eye, m.eye, -0.062, 0.2, 0.137);
    const eyeR = part(G.eye, m.eye, 0.062, 0.2, 0.137);
    neck.add(eyeL, eyeR);

    // Arms: shoulder pivot -> forearm pivot -> hand.
    const arm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.33, 0.56, 0);
      hips.add(shoulder);
      shoulder.add(part(G.upperArm, m.skin, 0, -0.2, 0));

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.4, 0);
      shoulder.add(elbow);
      elbow.add(part(G.foreArm, m.skin, 0, -0.18, 0));
      elbow.add(part(G.hand, m.skin, 0, -0.4, 0.02));
      return { shoulder, elbow };
    };
    const armL = arm(-1);
    const armR = arm(1);

    // Legs: hip pivot -> knee pivot -> foot.
    const leg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.14, 0.02, 0);
      hips.add(hip);
      hip.add(part(G.thigh, m.pants, 0, -0.23, 0));

      const knee = new THREE.Group();
      knee.position.set(0, -0.45, 0);
      hip.add(knee);
      knee.add(part(G.shin, m.pants, 0, -0.22, 0));
      knee.add(part(G.foot, m.skin, 0, -0.45, 0.06));
      return { hip, knee };
    };
    const legL = leg(-1);
    const legR = leg(1);

    this.rig = { hips, torso, neck, head, jaw, armL, armR, legL, legR };
    this.group = g;

    // Hit volumes: headshots are a separate, smaller target.
    this.hitMeshes = [head, torso, chest];
    head.userData.part = 'head';
    torso.userData.part = 'body';
    chest.userData.part = 'body';
    for (const mesh of this.hitMeshes) {
      mesh.userData.zombie = this;
    }
  }

  alert() {
    if (this.state === 'idle') this.state = 'chase';
  }

  takeDamage(amount, part, ctx) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flinch = 1;
    this.hitTimer = 0.12;
    if (this.state === 'idle') this.state = 'chase';
    if (ctx && ctx.audio) ctx.audio.hit(part === 'head');
    if (this.hp <= 0) {
      this.die(ctx, part);
      return true;
    }
    // Stagger on heavy hits.
    if (amount > 60) this.attackTimer = Math.max(this.attackTimer, 0.25);
    return false;
  }

  die(ctx, part = 'body') {
    this.alive = false;
    this.state = 'dead';
    this.deadTimer = 0;
    if (ctx && ctx.audio) ctx.audio.zombieDeath();
    if (ctx && ctx.onDeath) ctx.onDeath(this, part);
  }

  faceTowards(target, dt, rate = 9) {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    const want = Math.atan2(dx, dz);
    let diff = want - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, rate * dt);
  }

  update(dt, ctx) {
    if (this.removed) return;

    if (!this.alive) {
      this.deadTimer += dt;
      // Fall forward, then sink through the road.
      const fall = Math.min(1, this.deadTimer / 0.55);
      this.group.rotation.x = -Math.PI / 2 * easeOut(fall);
      this.group.position.y = -Math.max(0, this.deadTimer - 2.4) * 0.45;
      if (this.deadTimer > 3.6) {
        this.removed = true;
        ctx.scene.remove(this.group);
      }
      return;
    }

    const { playerPos, colliders, zombies, audio } = ctx;
    const pos = this.group.position;
    const toPlayer = new THREE.Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z);
    const dist = toPlayer.length();

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.hitTimer = Math.max(0, this.hitTimer - dt);

    // The relay is loud: anything reasonably close homes in on it.
    if (this.state === 'idle' && dist < 38) this.state = 'chase';

    // Occasional growl, more often when close.
    this.growlTimer -= dt;
    if (this.growlTimer <= 0) {
      this.growlTimer = 2.5 + this.rng() * 5;
      if (dist < 30 && audio) audio.growl(dist);
    }

    const move = new THREE.Vector3();
    let targetSpeed = 0;

    if (this.state === 'chase' || this.state === 'idle') {
      if (this.state === 'idle') {
        // Shuffle around the spawn point.
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2.5 + this.rng() * 3.5;
          const a = this.rng() * Math.PI * 2;
          this.wanderDir.set(Math.cos(a), 0, Math.sin(a));
        }
        const homeDist = Math.hypot(pos.x - this.home.x, pos.z - this.home.z);
        if (homeDist > 12) this.wanderDir.copy(this.home).sub(pos).setY(0).normalize();
        // Even unaware, the horde drifts toward the player's side of the map so
        // waves never stall at the spawn ring.
        if (dist > 15) this.wanderDir.copy(toPlayer).normalize();
        move.copy(this.wanderDir);
        targetSpeed = dist > 15 ? this.speed * 0.6 : this.speed * 0.32;
      } else {
        move.copy(toPlayer).normalize();
        targetSpeed = this.speed;
        // Keep a body's width of space: they claw at you, they do not stand
        // inside the camera.
        if (dist < 1.55) targetSpeed = 0;
        // Follow the flow field around buildings; close in straight when near.
        if (ctx.nav && dist > 2.6) {
          const navDir = ctx.nav.direction(pos.x, pos.z);
          if (navDir) move.copy(navDir);
        }
      }

      // Separation: zombies shoulder past each other instead of stacking.
      for (let i = 0; i < zombies.length; i++) {
        const other = zombies[i];
        if (other === this || !other.alive) continue;
        const dx = pos.x - other.group.position.x;
        const dz = pos.z - other.group.position.z;
        const d2 = dx * dx + dz * dz;
        const minD = this.radius + other.radius + 0.15;
        if (d2 > 1e-5 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / minD;
          move.x += (dx / d) * push * 1.4;
          move.z += (dz / d) * push * 1.4;
        }
      }
      if (move.lengthSq() > 1e-4) move.normalize();

      // Attack when in reach.
      if (dist < this.def.reach && this.attackCooldown <= 0) {
        this.state = 'attack';
        this.windup = 0;
        this.attackTimer = 0;
      }
    }

    if (this.state === 'attack') {
      this.windup += dt;
      targetSpeed = 0;
      if (this.windup > 0.42 && !this.struck) {
        this.struck = true;
        if (dist < this.def.reach + 0.55) {
          ctx.damage(this.damage, this);
        }
        this.attackCooldown = this.type === 'brute' ? 1.7 : 1.05;
      }
      if (this.windup > 0.85) {
        this.state = 'chase';
        this.struck = false;
        this.windup = 0;
      }
    }

    // Sidestep a wall instead of grinding into it forever.
    if (this.avoidTime > 0) {
      this.avoidTime -= dt;
      move.copy(this.avoidDir);
    }

    if (targetSpeed > 0) {
      const prevX = pos.x;
      const prevZ = pos.z;
      pos.x += move.x * targetSpeed * dt;
      pos.z += move.z * targetSpeed * dt;
      resolveCircle(colliders, pos, this.radius);

      const moved = Math.hypot(pos.x - prevX, pos.z - prevZ);
      const expected = targetSpeed * dt;
      if (moved < expected * 0.4) {
        this.stuckTime += dt;
        if (this.stuckTime > 0.3 && this.avoidTime <= 0) {
          this.stuckTime = 0;
          const side = this.rng() > 0.5 ? 1 : -1;
          this.avoidDir.set(-move.z * side, 0, move.x * side).normalize();
          this.avoidTime = 0.85;
        }
      } else {
        this.stuckTime = Math.max(0, this.stuckTime - dt * 0.6);
      }

      this.phase += dt * (targetSpeed * 1.9 + 1.2);
    } else {
      this.phase += dt * 1.6;
    }

    if (dist > 0.2) this.faceTowards(playerPos, dt, this.state === 'attack' ? 5 : 8);

    this.animate(dt, targetSpeed, dist);
  }

  animate(dt, speed, dist) {
    const r = this.rig;
    const walking = speed > 0.05;
    const stride = walking ? Math.sin(this.phase) : Math.sin(this.phase) * 0.12;
    const strideOpp = walking ? Math.sin(this.phase + Math.PI) : -Math.sin(this.phase) * 0.12;
    const lean = this.type === 'runner' ? 0.34 : this.type === 'brute' ? 0.22 : 0.16;

    // Legs.
    r.legL.hip.rotation.x = stride * 0.62;
    r.legR.hip.rotation.x = strideOpp * 0.62;
    r.legL.knee.rotation.x = Math.max(0, -stride) * 0.85;
    r.legR.knee.rotation.x = Math.max(0, -strideOpp) * 0.85;

    // Arms: the classic outstretched shamble, swinging a little with the gait.
    const armOut = this.type === 'runner' ? -0.55 : -1.35;
    const swing = walking ? Math.sin(this.phase + Math.PI) * 0.18 : Math.sin(this.phase * 0.7) * 0.05;

    let attackOverlay = 0;
    if (this.state === 'attack') {
      attackOverlay = Math.min(1, this.windup / 0.42);
    }
    const slam = attackOverlay * attackOverlay;

    r.armL.shoulder.rotation.x = armOut + swing - slam * 1.15;
    r.armR.shoulder.rotation.x = armOut - swing - slam * 1.15;
    r.armL.shoulder.rotation.z = 0.22 + slam * 0.1;
    r.armR.shoulder.rotation.z = -0.22 - slam * 0.1;
    r.armL.elbow.rotation.x = -0.5 + slam * 0.35;
    r.armR.elbow.rotation.x = -0.5 + slam * 0.35;

    // Body: lean into the run, bounce with the stride, flinch when shot.
    r.hips.rotation.x = lean + slam * 0.18 + this.flinch * 0.18;
    r.hips.position.y = 0.9 + Math.abs(Math.sin(this.phase)) * (walking ? 0.045 : 0.012);
    r.hips.rotation.z = Math.sin(this.phase) * 0.05;

    // Head tracks the player a little; jaw hangs open.
    const headTrack = Math.max(-0.5, Math.min(0.5, -dist * 0.02));
    r.neck.rotation.x = headTrack + Math.sin(this.phase * 0.5) * 0.06 - this.flinch * 0.35;
    r.neck.rotation.z = Math.sin(this.phase * 0.4) * 0.08;
    r.jaw.rotation.x = 0.25 + Math.sin(this.phase * 0.8) * 0.12 + slam * 0.4;
    r.jaw.position.y = 0.05;

    // Hit reaction: brief recoil of the whole upper body.
    if (this.hitTimer > 0) {
      r.hips.rotation.x -= 0.12;
      r.neck.rotation.x -= 0.2;
    }
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
