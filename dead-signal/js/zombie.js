// Zombies: hand-built skeletal hierarchy plus procedural animation and a
// simple state machine (wander -> chase -> attack -> die).
import * as THREE from 'three';
import { resolveCircle } from './world.js';
import { buildZombieModel } from './models.js';

import { TYPES } from './data.js';
export { TYPES };


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
    this.lodTimer = 0;
    this.detailOn = true;
    // Per-body asymmetry. No two bodies walk the same way: one leg drags, the
    // back is bent a little differently, the head hangs at its own angle.
    this.limp = 0.6 + rng() * 0.72;
    this.hunch = 0.08 + rng() * 0.18;
    this.headTilt = (rng() - 0.5) * 0.28;
    this.twitchTimer = 1.2 + rng() * 3.4;
    this.twitch = 0;
    this.deathRoll = 0;
    this.deathPitch = -Math.PI / 2;
    this.ranged = !!this.def.ranged;
    this.isBoss = false;
    this.bossName = '';
    // Boss signature move. The wave director names the ability; the state
    // machine below telegraphs it before anything lands.
    this.bossAbility = '';
    this.abilityState = 'idle';
    this.abilityWindup = 0;
    this.abilityCd = 2.6;
    this.abilityHits = false;
    this.chargeDir = new THREE.Vector3();
    this.chargeMark = new THREE.Vector3();
    this.chargeSpeed = 0;
    this.home = position.clone();
    this.build();
    this.group.position.copy(position);
  }

  build() {
    const model = buildZombieModel(this.type, this.def);
    this.group = model.group;
    this.rig = model.rig;
    this.hitMeshes = model.hitMeshes;
    this.detail = model.detail || [];
    // Hit volumes: the head is a separate, smaller target.
    for (const mesh of this.hitMeshes) mesh.userData.zombie = this;
  }

  // Facial, finger and cloth detail only reads inside ~24 m, and that is what
  // keeps a forty-body wave inside the frame budget: at forty bodies this is
  // the difference between roughly 350 and 1200 extra draw calls.
  updateLod(dist, dt) {
    this.lodTimer -= dt;
    if (this.lodTimer > 0) return;
    this.lodTimer = 0.35;
    const on = dist < 24;
    if (on === this.detailOn) return;
    this.detailOn = on;
    for (const mesh of this.detail) mesh.visible = on;
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
    // Bodies drop the way they were pushed, not always face-first.
    this.deathRoll = (Math.random() - 0.5) * 1.1;
    this.deathPitch = -Math.PI / 2 * (0.78 + Math.random() * 0.4);
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
      this.group.rotation.x = this.deathPitch * easeOut(fall);
      this.group.rotation.z = this.deathRoll * easeOut(fall);
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
      if (dist < 30 && audio) audio.growl(dist, ctx.panOf ? ctx.panOf(pos) : 0);
    }

    // A body that is standing still still twitches.
    this.twitchTimer -= dt;
    if (this.twitchTimer <= 0) {
      this.twitchTimer = 1.4 + this.rng() * 4;
      this.twitch = 0.32;
    }
    this.twitch = Math.max(0, this.twitch - dt);

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
        // Lurkers are the fast low shape: at night they do not just close, they
        // sprint until they are in reach, which is what makes darkness feel new.
        if (this.type === 'lurker' && world && world.blackout && dist > this.def.reach) {
          targetSpeed = this.def.speed * (this.def.nightSpeed / this.def.speed);
        }
        // Keep a body's width of space: they claw at you, they do not stand
        // inside the camera.
        if (dist < 1.55) targetSpeed = 0;

        // Spitters work the middle distance. They stop, rear back and lob acid
        // rather than closing to bite, and shuffle backwards if you rush them.
        if (this.ranged) {
          const spitRange = this.def.spitRange || 24;
          if (dist > 6 && dist < spitRange && this.attackCooldown <= 0) {
            this.state = 'spit';
            this.windup = 0;
            this.struck = false;
            targetSpeed = 0;
          } else if (dist < 6) {
            targetSpeed = this.speed * 0.45;
            move.set(-toPlayer.x, 0, -toPlayer.z).normalize();
          }
        }
        // Follow the flow field around buildings; close in straight when near.
        if (ctx.nav && dist > 2.6) {
          const navDir = ctx.nav.direction(pos.x, pos.z);
          if (navDir) move.copy(navDir);
        }

        // A boss signature move owns the approach while it commits.
        if (this.isBoss && this.bossAbility) {
          const act = this.stepAbility(dt, ctx, dist, toPlayer, pos);
          if (act) {
            move.copy(act.dir);
            targetSpeed = act.speed;
          }
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
      if (dist < this.def.reach && this.attackCooldown <= 0 && this.abilityState === 'idle') {
        this.state = 'attack';
        this.windup = 0;
        this.attackTimer = 0;
        if (audio) audio.snarl(dist, ctx.panOf ? ctx.panOf(pos) : 0);
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
        const cd = this.type === 'brute' ? 1.7 : this.type === 'lurker' ? 0.46 : 1.05;
        this.attackCooldown = cd;
        if (audio && this.type === 'lurker') audio.lurkerCry(dist, ctx.panOf ? ctx.panOf(pos) : 0);
      }
      if (this.windup > 0.85) {
        this.state = 'chase';
        this.struck = false;
        this.windup = 0;
      }
    }

    if (this.state === 'spit') {
      this.windup += dt;
      targetSpeed = 0;
      if (this.windup > 0.62 && !this.struck) {
        this.struck = true;
        if (ctx.spit && dist < (this.def.spitRange || 24) + 4) ctx.spit(this);
        this.attackCooldown = this.def.spitCooldown || 2.7;
      }
      if (this.windup > 1.1) {
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

    this.updateLod(dist, dt);
    this.animate(dt, targetSpeed, dist);
  }

  /**
   * Boss signature moves. Each one telegraphs, commits for a fixed window and
   * then pays a cooldown, so a boss fight is a rhythm to learn rather than the
   * same bite behind a bigger health bar.
   */
  stepAbility(dt, ctx, dist, toPlayer, pos) {
    const zero = new THREE.Vector3();
    this.abilityCd = Math.max(0, this.abilityCd - dt);

    if (this.abilityState === 'idle') {
      if (this.abilityCd > 0) return null;
      const kind = this.bossAbility;
      const inRange = kind === 'slam' ? dist < 9
        : kind === 'cleave' ? dist < this.def.reach * 2
          : dist > 5 && dist < 15;
      if (!inRange) return null;
      this.abilityState = 'windup';
      this.abilityWindup = 0;
      this.abilityHits = false;
      // The charge is aimed as the windup starts, not on release: stepping
      // aside is the counter-play, and standing still is the mistake.
      if (kind === 'charge') {
        this.chargeDir.copy(toPlayer).normalize();
        // Cover the gap in roughly three quarters of a second, with a hard cap
        // so it lunges rather than teleporting onto the player.
        this.chargeSpeed = Math.min(this.speed * 7, Math.max(this.speed * 2.2, (dist - 1) / 0.75));
      }
      if (ctx.abilityCry) ctx.abilityCry(this, 'windup');
      return { dir: zero, speed: 0 };
    }

    this.abilityWindup += dt;

    if (this.abilityState === 'windup') {
      const warn = this.bossAbility === 'charge' ? 0.7 : 0.85;
      if (this.abilityWindup >= warn) {
        this.abilityState = 'active';
        this.abilityWindup = 0;
        this.chargeMark.copy(pos);
        if (ctx.abilityCry) ctx.abilityCry(this, 'release');
        if (this.bossAbility === 'slam' && ctx.shockwave) ctx.shockwave(this);
      }
      return { dir: zero, speed: 0 };
    }

    if (this.abilityState === 'active') {
      if (this.bossAbility === 'charge') {
        // A building stops the charge; the boss eats the recovery instead of
        // grinding straight through a wall.
        const moved = Math.hypot(pos.x - this.chargeMark.x, pos.z - this.chargeMark.z);
        this.chargeMark.copy(pos);
        if (this.abilityWindup > 0.1 && moved < 0.4 * dt) {
          this.finishAbility();
          return { dir: zero, speed: 0 };
        }
        if (!this.abilityHits && dist < this.radius + 1.4) {
          this.abilityHits = true;
          ctx.damage(this.damage * 1.4, this);
          // Plant on impact: a charge that carries on through the player reads
          // as the boss teleporting behind you.
          this.finishAbility();
          return { dir: zero, speed: 0 };
        }
        if (this.abilityWindup > 1.1) {
          this.finishAbility();
          return { dir: zero, speed: 0 };
        }
        return { dir: this.chargeDir, speed: this.chargeSpeed || this.speed * 4.6 };
      }

      if (this.bossAbility === 'cleave') {
        if (!this.abilityHits) {
          this.abilityHits = true;
          if (dist < this.def.reach * 1.7) ctx.damage(this.damage * 1.55, this);
          if (ctx.abilityCry) ctx.abilityCry(this, 'hit');
        }
        if (this.abilityWindup > 0.42) this.finishAbility();
        return { dir: zero, speed: 0 };
      }

      // Slam: hold the crouch for a beat, then recover.
      if (this.abilityWindup > 0.5) this.finishAbility();
      return { dir: zero, speed: 0 };
    }

    return null;
  }

  finishAbility() {
    this.abilityState = 'idle';
    this.abilityWindup = 0;
    this.abilityHits = false;
    this.abilityCd = this.bossAbility === 'charge' ? 6.5
      : this.bossAbility === 'cleave' ? 5 : 7.5;
  }

  animate(dt, speed, dist) {
    const r = this.rig;
    const walking = speed > 0.05;
    const stride = walking ? Math.sin(this.phase) : Math.sin(this.phase) * 0.12;
    const strideOpp = walking ? Math.sin(this.phase + Math.PI) : -Math.sin(this.phase) * 0.12;
    const lean = (this.type === 'runner' ? 0.34 : this.type === 'brute' ? 0.22 : 0.16) + this.hunch;

    // Legs. The trailing leg swings less and the hips hitch, which reads as a
    // limp without needing a second animation state.
    r.legL.hip.rotation.x = stride * 0.62;
    r.legR.hip.rotation.x = strideOpp * 0.62 * this.limp;
    r.legL.knee.rotation.x = Math.max(0, -stride) * 0.85;
    r.legR.knee.rotation.x = Math.max(0, -strideOpp) * 0.85 * this.limp;

    // Arms: the classic outstretched shamble, swinging a little with the gait.
    const armOut = this.type === 'runner' ? -0.55 : this.ranged ? -0.9 : -1.35;
    const swing = walking ? Math.sin(this.phase + Math.PI) * 0.18 : Math.sin(this.phase * 0.7) * 0.05;

    let attackOverlay = 0;
    if (this.state === 'attack') {
      attackOverlay = Math.min(1, this.windup / 0.42);
    } else if (this.state === 'spit') {
      attackOverlay = Math.min(1, this.windup / 0.62) * 0.45;
    }
    const slam = attackOverlay * attackOverlay;

    r.armL.shoulder.rotation.x = armOut + swing - slam * 1.15;
    // One arm always hangs lower: the classic uneven reach.
    r.armR.shoulder.rotation.x = armOut * 0.78 - swing - slam * 1.15;
    r.armL.shoulder.rotation.z = 0.22 + slam * 0.1;
    r.armR.shoulder.rotation.z = -0.22 - slam * 0.1;
    r.armL.elbow.rotation.x = -0.5 + slam * 0.35;
    r.armR.elbow.rotation.x = -0.5 + slam * 0.35;

    // Body: lean into the run, bounce with the stride, flinch when shot.
    r.hips.rotation.x = lean + slam * 0.18 + this.flinch * 0.18;
    r.hips.position.y = 0.9 + Math.abs(Math.sin(this.phase)) * (walking ? 0.045 : 0.012)
      + Math.sin(this.phase) * (1 - this.limp) * 0.012;
    r.hips.rotation.z = Math.sin(this.phase) * 0.05 + Math.sin(this.phase * 0.5) * (1 - this.limp) * 0.06;

    // Head tracks the player a little; jaw hangs open.
    const headTrack = Math.max(-0.5, Math.min(0.5, -dist * 0.02));
    r.neck.rotation.x = headTrack + Math.sin(this.phase * 0.5) * 0.06 - this.flinch * 0.35 + this.twitch * 0.25;
    r.neck.rotation.z = Math.sin(this.phase * 0.4) * 0.08 + this.headTilt + this.twitch * 0.18;
    r.neck.rotation.y = Math.sin(this.phase * 0.23) * 0.12 + this.twitch * 0.2;
    r.jaw.rotation.x = 0.25 + Math.sin(this.phase * 0.8) * 0.12 + slam * 0.4;
    r.jaw.position.y = 0.05;

    // Boss tells. Both arms overhead read as a slam or a cleave from across
    // the street; a charge drops the whole body forward.
    if (this.isBoss) {
      if (this.abilityState === 'windup') {
        const t = Math.min(1, this.abilityWindup / 0.6);
        r.armL.shoulder.rotation.x = -2.3 * t;
        r.armR.shoulder.rotation.x = -2.3 * t;
        r.armL.elbow.rotation.x = -0.35;
        r.armR.elbow.rotation.x = -0.35;
        r.hips.rotation.x = lean - 0.24 * t;
        r.neck.rotation.x = -0.34 * t;
      } else if (this.abilityState === 'active') {
        if (this.bossAbility === 'charge') {
          r.hips.rotation.x = lean + 0.55;
          r.armL.shoulder.rotation.x = -1.75;
          r.armR.shoulder.rotation.x = -1.75;
        } else if (this.bossAbility === 'cleave') {
          r.armL.shoulder.rotation.x = 0.95;
          r.armR.shoulder.rotation.x = 0.95;
          r.hips.rotation.x = lean + 0.3;
        }
      }
    }

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
