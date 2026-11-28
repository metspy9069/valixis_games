import { assets } from './loader.js';
// Zombies: hand-built skeletal hierarchy plus procedural animation and a
// simple state machine (wander -> chase -> attack -> die).
import * as THREE from 'three';
import { resolveCircle } from './world.js';
import { buildZombieModel } from './models.js';
import { initZombieDismemberment, severZombieLimb, settleRagdollDeath } from './dismemberment.js';
import { computeHordeSteering } from './nav.js';
import { stepLurkerAI, LURKER_CONFIG } from './lurker.js';
import {
  evaluateGatekeeperPhase,
  ruptureGatekeeperWeakpoint,
  GATEKEEPER_PHASES,
  GATEKEEPER_THRESHOLDS,
} from './boss.js';

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
    this.staggerTimer = 0;
    this.burningTimer = 0;
    this.burningDps = 0;
    this.deadTimer = 0;
    this.wanderDir = new THREE.Vector3(0, 0, 1);
    this.wanderTimer = 0;
    this.avoidDir = new THREE.Vector3();
    this.avoidTime = 0;
    this.stuckTime = 0;
    this.flankSign = rng() > 0.5 ? 1 : -1;
    this.encirclementOffset = (rng() - 0.5) * 1.6;
    this.moveDir = new THREE.Vector3(0, 0, 1);
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
    // Day 12: Gatekeeper multi-phase encounter attributes
    this.isGatekeeper = false;
    this.phase = GATEKEEPER_PHASES.PHASE_1;
    this.armorPlatesBroken = false;
    this.canThrowRock = false;
    this.abilityCooldownScale = 1.0;
    this.phase2SpeedApplied = false;
    this.runnerEscortSummoned = false;
    this.currentAbility = null;
    this.spinePustule = null;
    this.armorPlates = [];
    this.home = position.clone();
    this.build();
    this.group.position.copy(position);
    initZombieDismemberment(this);
  }

  build() {
    let model = (typeof assets !== 'undefined' && assets && assets.has(this.type)) ? assets.instantiate(this.type) : null;
    if (!model) {
      model = buildZombieModel(this.type, this.def);
    }
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

  takeDamage(amount, part, ctx, limbId = null, hitPoint = null, shotDir = null) {
    if (!this.alive) return false;
    let effAmount = amount;

    // Glowing Spine Pustule Weak Point Targeting (Day 12)
    // 2.5x critical damage, poise break, and 2.0s vulnerable stun
    if (part === 'weakpoint' || (this.isBoss && part === 'weakpoint')) {
      if (!shotDir) effAmount *= 2.5;
      ruptureGatekeeperWeakpoint(this, ctx);
      if (ctx && ctx.audio && typeof ctx.audio.weakpointHit === 'function') {
        ctx.audio.weakpointHit();
      }
    }

    // Mid-air lurker pounce counterplay (Day 11)
    // Shooting lurker mid-leap interrupts the jump with a 25% vulnerability bonus and heavy stagger
    if (this.type === 'lurker' && this.state === 'pounce_leap') {
      effAmount *= 1.25;
      this.state = 'pounce_recover';
      this.staggerTimer = 1.2;
      this.flinch = 1.5;
      if (this.group && this.group.position.y > 0) {
        this.group.position.y = 0;
      }
      if (ctx && ctx.audio && typeof ctx.audio.lurkerHiss === 'function') {
        const pPos = ctx.playerPos;
        ctx.audio.lurkerHiss(pPos ? Math.hypot(this.group.position.x - pPos.x, this.group.position.z - pPos.z) : 5);
      }
    }

    const prevHp = this.hp;
    this.hp -= effAmount;
    this.hitTimer = 0.12;
    if (this.state === 'idle') this.state = 'chase';
    if (ctx && ctx.audio && typeof ctx.audio.hit === 'function') ctx.audio.hit(part === 'head' || part === 'weakpoint');

    // Boss Phase Transitions (Day 12 Gatekeeper)
    if (this.isBoss) {
      evaluateGatekeeperPhase(this, prevHp, this.hp, ctx);
    }

    // Locational dismemberment evaluation (Day 8)
    if (part === 'head' && (this.hp <= 0 || amount >= 65)) {
      severZombieLimb(this, 'head', hitPoint, shotDir, ctx);
      return true;
    } else if (limbId && this.limbHealth && this.limbHealth[limbId] !== undefined) {
      this.limbHealth[limbId] -= amount;
      if (this.limbHealth[limbId] <= 0 && !this.dismembered[limbId]) {
        severZombieLimb(this, limbId, hitPoint, shotDir, ctx);
      }
    }

    if (this.hp <= 0) {
      this.die(ctx, part);
      return true;
    }

    // Poise and Stagger:
    // Regular enemies stagger on limb impacts or heavy calibre hits.
    // Bosses possess unstoppable poise during ability windup unless their spine pustule weakpoint was ruptured.
    if (this.isBoss) {
      if (part === 'weakpoint') {
        this.staggerTimer = 2.0;
        this.flinch = 2.0;
      } else if (this.abilityState !== 'windup') {
        this.flinch = Math.max(this.flinch || 0, 0.4);
      }
    } else {
      this.flinch = Math.max(this.flinch || 0, 1);
      if (part === 'limb') {
        this.flinch = Math.max(this.flinch, 1.15);
        this.attackTimer = Math.max(this.attackTimer, 0.36);
        this.staggerTimer = Math.max(this.staggerTimer, 0.42);
      } else if (amount > 60) {
        this.attackTimer = Math.max(this.attackTimer, 0.25);
      }
    }
    return false;
  }

  ignite(duration = 2.8, dps = 15) {
    if (!this.alive) return;
    this.burningTimer = Math.max(this.burningTimer, duration);
    this.burningDps = Math.max(this.burningDps, dps);
  }

  die(ctx, part = 'body') {
    this.alive = false;
    this.state = 'dead';
    this.deadTimer = 0;
    // Bodies drop the way they were pushed, not always face-first.
    this.deathRoll = (Math.random() - 0.5) * 0.8;
    this.deathPitch = -Math.PI / 2 * (0.85 + Math.random() * 0.2);
    if (part === 'head' && (!this.dismembered || !this.dismembered.head)) {
      severZombieLimb(this, 'head', null, null, ctx);
    }
    if (ctx && ctx.audio) ctx.audio.zombieDeath();
    // Immediately hide boss bar and clear reference on boss death (Bug 2 fix)
    if (this.isBoss) {
      if (typeof document !== 'undefined') {
        const bar = document.getElementById('bossBar');
        if (bar) {
          bar.classList.remove('show');
          bar.style.opacity = '0';
        }
      }
      if (ctx && ctx.hud && ctx.hud.boss) {
        ctx.hud.boss.classList.remove('show');
        ctx.hud.boss.style.opacity = '0';
      }
      if (ctx && ctx.clearBoss) ctx.clearBoss(this);
    }
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
      settleRagdollDeath(this, dt, ctx.colliders || []);
      if (this.deadTimer > 3.6) {
        this.removed = true;
        if (ctx.scene) ctx.scene.remove(this.group);
      }
      return;
    }

    const { playerPos, colliders, zombies, audio, lurePos } = ctx;
    const pos = this.group.position;
    const toPlayer = new THREE.Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z);
    const playerDist = toPlayer.length();

    // Burning DoT from Molotov fire pool
    if (this.burningTimer > 0) {
      this.burningTimer -= dt;
      this.hp -= this.burningDps * dt;
      this.flinch = Math.max(this.flinch, 0.35);
      if (this.hp <= 0) {
        this.die(ctx, 'body');
        return;
      }
    }

    // Siren / Pipe Bomb lure overrides tracking
    const isLured = !!lurePos;
    const toTarget = isLured
      ? new THREE.Vector3(lurePos.x - pos.x, 0, lurePos.z - pos.z)
      : toPlayer;
    const dist = toTarget.length();

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);

    // The relay is loud: anything reasonably close homes in on it.
    if (this.state === 'idle' && dist < 38) this.state = 'chase';

    // Occasional growl, more often when close.
    // Lurkers emit silent skittering / claw clicks instead of heavy brute growls
    this.growlTimer -= dt;
    if (this.growlTimer <= 0) {
      this.growlTimer = 2.5 + this.rng() * 5;
      if (dist < 30 && audio) {
        if (this.type === 'lurker') {
          if (typeof audio.lurkerSkitter === 'function') {
            audio.lurkerSkitter(dist, ctx.panOf ? ctx.panOf(pos) : 0);
          }
        } else {
          audio.growl(dist, ctx.panOf ? ctx.panOf(pos) : 0);
        }
      }
    }

    // A body that is standing still still twitches.
    this.twitchTimer -= dt;
    if (this.twitchTimer <= 0) {
      this.twitchTimer = 1.4 + this.rng() * 4;
      this.twitch = 0.32;
    }
    this.twitch = Math.max(0, this.twitch - dt);

    // Lurker Predatory AI & Ambush Ballistic Pounces (Day 11)
    if (this.type === 'lurker') {
      const lurkerAction = stepLurkerAI(this, dt, ctx);
      if (lurkerAction && lurkerAction.handled) {
        if (dist > 0.2) this.faceTowards(playerPos, dt, 8);
        this.updateLod(dist, dt);
        this.animate(dt, (this.state === 'pounce_leap' ? 8 : (this.state === 'pounce_recover' ? 0 : 2)), dist);
        return;
      }
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
        // Lurkers are the fast low shape: at night or in shadows they sprint at 6.5 m/s.
        // Direct flashlight beam disorients and slows them.
        if (this.type === 'lurker') {
          if (this.blindedTimer > 0) {
            targetSpeed = this.speed * LURKER_CONFIG.blindedSpeedMul;
          } else if (ctx.blackout && dist > this.def.reach) {
            targetSpeed = LURKER_CONFIG.shadowSpeed;
          }
        }
        // Keep a body's width of space: they claw at you, they do not stand inside the camera.
        const stopDist = Math.max(0.65, this.radius + 0.35);
        if (dist < stopDist) targetSpeed = 0;

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
        // Horde steering integration (Day 9):
        // Combines flowfield navigation, runner/lurker perimeter flanking,
        // encirclement ring distribution, 2-tier Boids swarm separation (avenue fan-out),
        // and tactile whisker obstacle avoidance.
        if (!this.ranged || dist >= 6) {
          const steer = computeHordeSteering({
            zombie: this,
            zombies,
            playerPos: isLured ? lurePos : playerPos,
            colliders,
            nav: ctx.nav,
            dt
          });
          move.copy(steer.move);
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

      // If idle, apply basic separation so idle packs don't collapse:
      if (this.state === 'idle') {
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
      }
      if (move.lengthSq() > 1e-4) move.normalize();
      this.moveDir.copy(move);

      // Attack when in reach of player (unless lured by siren).
      if (!isLured && playerDist < this.def.reach && this.attackCooldown <= 0 && this.abilityState === 'idle') {
        this.state = 'attack';
        this.windup = 0;
        this.attackTimer = 0;
        if (audio) audio.snarl(playerDist, ctx.panOf ? ctx.panOf(pos) : 0);
      }
    }

    if (this.state === 'attack') {
      this.windup += dt;
      // Maintain forward lunge momentum during early windup so backpedaling players cannot trivially evade all melee strikes
      targetSpeed = this.windup < 0.42 ? this.speed * 0.65 : 0;
      if (this.windup > 0.42 && !this.struck) {
        this.struck = true;
        // Connect if player is within reach + lunge margin
        if (playerDist < this.def.reach + 0.95) {
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

    if (this.staggerTimer > 0) {
      targetSpeed *= 0.45;
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
          this.avoidTime = 0.5;
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
    const cdSpeed = 1 / (this.abilityCooldownScale || 1.0);
    this.abilityCd = Math.max(0, this.abilityCd - dt * cdSpeed);

    if (this.abilityState === 'idle') {
      if (this.abilityCd > 0) return null;

      // Dynamic ability selection for Gatekeeper (Day 12 Multi-Phase)
      let kind = this.bossAbility;
      if (this.bossAbility === 'slam' || this.isGatekeeper) {
        if (this.phase >= 2 && this.canThrowRock && dist > 6.5 && dist < 26) {
          kind = 'rock_throw';
        } else if (this.phase >= 3 && dist > 6.0 && (this.rng ? this.rng() : Math.random()) < 0.55) {
          kind = 'charge';
        } else {
          kind = 'slam';
        }
      }
      this.currentAbility = kind;

      const inRange = kind === 'slam' ? dist < 9
        : kind === 'rock_throw' ? dist > 5 && dist < 26
          : kind === 'cleave' ? dist < this.def.reach * 2
            : dist > 5 && dist < 16;
      if (!inRange) return null;

      this.abilityState = 'windup';
      this.abilityWindup = 0;
      this.abilityHits = false;
      // The charge is aimed as the windup starts, not on release: stepping
      // aside is the counter-play, and standing still is the mistake.
      if (kind === 'charge') {
        this.chargeDir.copy(toPlayer).normalize();
        this.chargeSpeed = Math.min(this.speed * 7, Math.max(this.speed * 2.2, (dist - 1) / 0.75));
      }
      if (ctx.abilityCry) ctx.abilityCry(this, 'windup');
      return { dir: zero, speed: 0 };
    }

    this.abilityWindup += dt;
    const currentKind = this.currentAbility || this.bossAbility;

    if (this.abilityState === 'windup') {
      const warn = currentKind === 'charge' ? 0.7
        : currentKind === 'rock_throw' ? 0.75
          : 0.85;

      if (this.abilityWindup >= warn) {
        this.abilityState = 'active';
        this.abilityWindup = 0;
        this.chargeMark.copy(pos);
        if (ctx.abilityCry) ctx.abilityCry(this, 'release');
        if (currentKind === 'slam' && ctx.shockwave) {
          ctx.shockwave(this);
        } else if (currentKind === 'rock_throw' && ctx.throwRock) {
          ctx.throwRock(this, ctx.playerPos);
        }
      }
      return { dir: zero, speed: 0 };
    }

    if (this.abilityState === 'active') {
      if (currentKind === 'charge') {
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

      if (currentKind === 'cleave') {
        if (!this.abilityHits) {
          this.abilityHits = true;
          if (dist < this.def.reach * 1.7) ctx.damage(this.damage * 1.55, this);
          if (ctx.abilityCry) ctx.abilityCry(this, 'hit');
        }
        if (this.abilityWindup > 0.42) this.finishAbility();
        return { dir: zero, speed: 0 };
      }

      if (currentKind === 'rock_throw') {
        // Recovery window after concrete chunk heave
        if (this.abilityWindup > 0.38) this.finishAbility();
        return { dir: zero, speed: 0 };
      }

      // Slam: hold the crouch for a beat, then recover.
      if (this.abilityWindup > 0.5) this.finishAbility();
      return { dir: zero, speed: 0 };
    }

    return null;
  }

  finishAbility() {
    const kind = this.currentAbility || this.bossAbility;
    this.abilityState = 'idle';
    this.abilityWindup = 0;
    this.abilityHits = false;
    const baseCd = kind === 'charge' ? 5.5
      : kind === 'rock_throw' ? 4.2
        : kind === 'cleave' ? 5.0
          : 6.8;
    this.abilityCd = baseCd * (this.abilityCooldownScale || 1.0);
    this.currentAbility = null;
  }

  animate(dt, speed, dist) {
    const r = this.rig;
    if (!r || !r.hips) return;

    const walking = speed > 0.05;
    const isLurker = this.type === 'lurker';
    const isRunner = this.type === 'runner';
    const isBrute = this.type === 'brute';
    const isBloater = this.type === 'bloater';
    const isSpitter = this.type === 'spitter';

    // Stride cadence & phase
    const stride = walking ? Math.sin(this.phase) : Math.sin(this.phase) * 0.12;
    const strideOpp = walking ? Math.sin(this.phase + Math.PI) : -Math.sin(this.phase) * 0.12;

    // Crawler Animation Override (Day 8)
    if (this.isCrawler) {
      this.crawlPhase = (this.crawlPhase || 0) + dt * 4.8;
      r.hips.position.y = 0.22;
      r.hips.rotation.x = 1.35; // Dropped flat onto street
      r.hips.rotation.z = Math.sin(this.crawlPhase) * 0.08;
      r.hips.rotation.y = Math.sin(this.crawlPhase * 0.5) * 0.12;

      // Neck cranes up to look at player ankles
      r.neck.rotation.x = -0.72;
      r.neck.rotation.z = 0;

      // Crawling arm reach / alternate drag pulls forward
      if (r.armL && r.armL.shoulder && !this.dismembered.armL) {
        r.armL.shoulder.rotation.x = Math.sin(this.crawlPhase) * 0.85 - 0.5;
        r.armL.shoulder.rotation.z = 0.35;
        r.armL.elbow.rotation.x = -0.8;
      }
      if (r.armR && r.armR.shoulder && !this.dismembered.armR) {
        r.armR.shoulder.rotation.x = -Math.sin(this.crawlPhase) * 0.85 - 0.5;
        r.armR.shoulder.rotation.z = -0.35;
        r.armR.elbow.rotation.x = -0.8;
      }

      // Dragging trailing legs along asphalt
      if (r.legL && r.legL.hip) {
        r.legL.hip.rotation.x = -0.25 + Math.sin(this.crawlPhase) * 0.08;
        if (r.legL.knee) r.legL.knee.rotation.x = 0.1;
      }
      if (r.legR && r.legR.hip) {
        r.legR.hip.rotation.x = -0.25 - Math.sin(this.crawlPhase) * 0.08;
        if (r.legR.knee) r.legR.knee.rotation.x = 0.1;
      }
      return;
    }

    // Lean: Forward cant based on archetype and speed
    let baseLean = isRunner ? 0.44 : isBrute ? 0.26 : isLurker ? 0.52 : isBloater ? 0.18 : 0.16;
    let lean = baseLean + this.hunch;

    // 1. Legs: Authentic locomotion with foot planting and knee bending
    if (r.legL && r.legR) {
      if (isLurker) {
        // Lurker low scuttling gait: wide crawling splay
        r.legL.hip.rotation.x = stride * 0.72;
        r.legR.hip.rotation.x = strideOpp * 0.72;
        r.legL.hip.rotation.z = 0.22;
        r.legR.hip.rotation.z = -0.22;
        r.legL.knee.rotation.x = Math.max(0, -stride) * 0.95 + 0.35;
        r.legR.knee.rotation.x = Math.max(0, -strideOpp) * 0.95 + 0.35;
      } else if (isRunner) {
        // Runner: High knees, aggressive forward sprint drive
        r.legL.hip.rotation.x = stride * 0.88;
        r.legR.hip.rotation.x = strideOpp * 0.88;
        r.legL.knee.rotation.x = Math.max(0, -stride) * 1.25;
        r.legR.knee.rotation.x = Math.max(0, -strideOpp) * 1.25;
      } else {
        // Walker / Brute / Bloater: Heavy asymmetric shamble with limp
        r.legL.hip.rotation.x = stride * 0.62;
        r.legR.hip.rotation.x = strideOpp * 0.62 * this.limp;
        r.legL.knee.rotation.x = Math.max(0, -stride) * 0.85;
        r.legR.knee.rotation.x = Math.max(0, -strideOpp) * 0.85 * this.limp;
      }
    }

    // 2. Arms: Counterbalance, reaching claws, and archetype postures
    let armOut = isRunner ? -0.45 : isLurker ? 0.55 : isSpitter ? -0.85 : isBloater ? -1.1 : -1.35;
    let armSwing = walking ? Math.sin(this.phase + Math.PI) * (isRunner ? 0.48 : 0.2) : Math.sin(this.phase * 0.7) * 0.05;

    let attackOverlay = 0;
    if (this.state === 'attack') {
      attackOverlay = Math.min(1, this.windup / 0.42);
    } else if (this.state === 'spit') {
      attackOverlay = Math.min(1, this.windup / 0.62) * 0.5;
    } else if (this.state === 'pounce_windup') {
      attackOverlay = Math.min(1, this.windup / 0.38) * 0.8;
    } else if (this.state === 'pounce_leap') {
      attackOverlay = 1.0;
    }
    const attackCurve = attackOverlay * attackOverlay;

    if (r.armL && r.armR) {
      if (isLurker) {
        if (this.state === 'pounce_leap') {
          // Mid-air ballistic reach with claws extended forward
          r.armL.shoulder.rotation.x = -1.35;
          r.armR.shoulder.rotation.x = -1.35;
          r.armL.shoulder.rotation.z = 0.28;
          r.armR.shoulder.rotation.z = -0.28;
          r.armL.elbow.rotation.x = -0.25;
          r.armR.elbow.rotation.x = -0.25;
        } else if (this.state === 'pounce_windup') {
          // Coiled predator ready to spring
          r.armL.shoulder.rotation.x = 0.85;
          r.armR.shoulder.rotation.x = 0.85;
          r.armL.shoulder.rotation.z = 0.45;
          r.armR.shoulder.rotation.z = -0.45;
          r.armL.elbow.rotation.x = -1.1;
          r.armR.elbow.rotation.x = -1.1;
        } else {
          // Lurker arms reach low to the ground for predatory scuttle
          r.armL.shoulder.rotation.x = 0.55 + armSwing - attackCurve * 1.6;
          r.armR.shoulder.rotation.x = 0.55 - armSwing - attackCurve * 1.6;
          r.armL.shoulder.rotation.z = 0.32;
          r.armR.shoulder.rotation.z = -0.32;
          r.armL.elbow.rotation.x = -0.65 + attackCurve * 0.4;
          r.armR.elbow.rotation.x = -0.65 + attackCurve * 0.4;
        }
      } else if (isBloater) {
        // Bloater arms held wide around massive belly
        r.armL.shoulder.rotation.x = armOut + armSwing - attackCurve * 1.2;
        r.armR.shoulder.rotation.x = armOut - armSwing - attackCurve * 1.2;
        r.armL.shoulder.rotation.z = 0.55 + attackCurve * 0.15;
        r.armR.shoulder.rotation.z = -0.55 - attackCurve * 0.15;
        r.armL.elbow.rotation.x = -0.45 + attackCurve * 0.35;
        r.armR.elbow.rotation.x = -0.45 + attackCurve * 0.35;
      } else {
        r.armL.shoulder.rotation.x = armOut + armSwing - attackCurve * 1.25;
        // Asymmetric hang on right arm
        r.armR.shoulder.rotation.x = armOut * 0.78 - armSwing - attackCurve * 1.25;
        r.armL.shoulder.rotation.z = 0.22 + attackCurve * 0.12;
        r.armR.shoulder.rotation.z = -0.22 - attackCurve * 0.12;
        r.armL.elbow.rotation.x = -0.48 + attackCurve * 0.38;
        r.armR.elbow.rotation.x = -0.48 + attackCurve * 0.38;
      }
    }

    // 3. Torso / Hips: Realistic weight bob, side-to-side sway, and damage flinch
    let hipBaseY = isLurker ? 0.38 : 0.9;
    let bobAmp = (walking ? 0.05 : 0.012) * (isBrute ? 1.4 : isRunner ? 1.2 : 1.0);
    r.hips.position.y = hipBaseY + Math.abs(Math.sin(this.phase)) * bobAmp
      + Math.sin(this.phase) * (1 - this.limp) * 0.012;

    // Torso pitch & roll
    let rollAmp = isBloater ? 0.16 : isBrute ? 0.09 : 0.05;
    r.hips.rotation.x = lean + attackCurve * 0.2 + this.flinch * 0.22;
    r.hips.rotation.z = Math.sin(this.phase) * rollAmp + (1 - this.limp) * 0.04;
    r.hips.rotation.y = Math.sin(this.phase * 0.5) * (walking ? 0.08 : 0.02);

    // 4. Head & Jaw tracking
    const headTrack = Math.max(-0.5, Math.min(0.5, -dist * 0.02));
    r.neck.rotation.x = headTrack + Math.sin(this.phase * 0.5) * 0.06 - this.flinch * 0.4 + this.twitch * 0.25;
    r.neck.rotation.z = Math.sin(this.phase * 0.4) * 0.08 + this.headTilt + this.twitch * 0.18;
    r.neck.rotation.y = Math.sin(this.phase * 0.23) * 0.12 + this.twitch * 0.2;

    if (r.jaw) {
      r.jaw.rotation.x = 0.25 + Math.sin(this.phase * 0.8) * 0.12 + attackCurve * 0.45;
      r.jaw.position.y = 0.05;
    }

    // 5. Boss signature move telegraphs & visual tell states
    if (this.isBoss) {
      const currentKind = this.currentAbility || this.bossAbility;
      if (this.abilityState === 'windup') {
        const t = Math.min(1, this.abilityWindup / 0.65);
        if (currentKind === 'slam') {
          // Both arms hoisted high overhead, spine arched backward in ominous tell
          r.armL.shoulder.rotation.x = -2.5 * t;
          r.armR.shoulder.rotation.x = -2.5 * t;
          r.armL.shoulder.rotation.z = 0.35 * t;
          r.armR.shoulder.rotation.z = -0.35 * t;
          r.armL.elbow.rotation.x = -0.4;
          r.armR.elbow.rotation.x = -0.4;
          r.hips.rotation.x = lean - 0.35 * t;
          r.neck.rotation.x = -0.45 * t;
        } else if (currentKind === 'rock_throw') {
          // Crouches down to rip concrete chunk from street
          r.hips.position.y = hipBaseY - 0.38 * t;
          r.hips.rotation.x = lean + 0.65 * t;
          r.armL.shoulder.rotation.x = 1.25 * t;
          r.armR.shoulder.rotation.x = 1.25 * t;
          r.armL.elbow.rotation.x = -0.5 * t;
          r.armR.elbow.rotation.x = -0.5 * t;
        } else if (currentKind === 'charge') {
          // Low 4-point sprinter crouch, jaws gaping
          r.hips.position.y = hipBaseY - 0.28 * t;
          r.hips.rotation.x = lean + 0.65 * t;
          r.armL.shoulder.rotation.x = 0.7 * t;
          r.armR.shoulder.rotation.x = 0.7 * t;
          if (r.jaw) r.jaw.rotation.x = 0.75 * t;
        } else if (currentKind === 'cleave') {
          // Torso coiled right, right arm cocked behind back
          r.hips.rotation.y = -0.85 * t;
          r.armR.shoulder.rotation.x = -1.2 * t;
          r.armR.shoulder.rotation.y = 1.1 * t;
          r.armL.shoulder.rotation.x = 0.4 * t;
        }
      } else if (this.abilityState === 'active') {
        if (currentKind === 'charge') {
          // Aerodynamic torpedo rush forward
          r.hips.rotation.x = lean + 0.65;
          r.armL.shoulder.rotation.x = 1.25;
          r.armR.shoulder.rotation.x = 1.25;
        } else if (currentKind === 'cleave') {
          // Explosive horizontal 160-degree slash across front
          r.hips.rotation.y = 0.85;
          r.armR.shoulder.rotation.x = 0.3;
          r.armR.shoulder.rotation.y = -1.4;
        } else if (currentKind === 'slam') {
          // Fists driven into ground
          r.armL.shoulder.rotation.x = 0.95;
          r.armR.shoulder.rotation.x = 0.95;
          r.hips.position.y = hipBaseY - 0.35;
        } else if (currentKind === 'rock_throw') {
          // Powerful overhead forward heave
          r.armL.shoulder.rotation.x = -1.35;
          r.armR.shoulder.rotation.x = -1.35;
          r.hips.position.y = hipBaseY + 0.12;
          r.hips.rotation.x = lean - 0.25;
        }
      }

      // Pulsating glowing spine pustule animation
      if (this.spinePustule) {
        const pulse = 1.0 + Math.sin(this.phase * 4.2) * 0.1;
        this.spinePustule.scale.set(1.2 * pulse, 1.5 * pulse, 0.95 * pulse);
      }
    }

    // 6. Hit reaction: upper torso and head snap back
    if (this.hitTimer > 0) {
      r.hips.rotation.x -= 0.16;
      r.neck.rotation.x -= 0.28;
    }
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
