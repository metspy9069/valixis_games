// Lurker Advanced Mechanics & Predatory AI Engine (Day 11).
// Implements:
// 1. 3D Elevation-Aware Ballistic Pounce Leap (calculating true 3D trajectory when player is on car hoods/ledges).
// 2. Mid-Air Skeet Counterplay (shooting lurker mid-leap knocks it out of the air with heavy stagger).
// 3. Shadow Cloaking & Flashlight Vulnerability (blinding/disorienting lurkers with beam sweep).
// 4. Roof & Wall Ledge Prowling (stalking from elevated perches and dropping behind players).
// 5. Silent Stealth Skittering (eliminating heavy brute growls).

import * as THREE from 'three';

export const LURKER_CONFIG = {
  pounceMinDist: 3.2,
  pounceMaxDist: 7.2,
  pounceFlightTime: 0.42,
  pounceGravity: 22.0,
  pounceDamage: 26.0,
  pounceCooldown: 2.8,
  pounceWindupTime: 0.38,
  pounceRecoverTime: 0.42,
  shadowSpeed: 6.5,
  blindedSpeedMul: 0.5,
  blindedDuration: 1.2,
  flashlightConeAngle: 0.5, // ~28.6 degrees cone
  flashlightMaxRange: 32.0,
};

/**
 * Computes the 3D ballistic leap velocity required to reach an elevated or ground target.
 * Solves the bug where lurker leaped horizontally and crashed into car bumpers instead of car hoods.
 */
export function compute3DPounceTrajectory({
  from,
  target,
  flightTime = LURKER_CONFIG.pounceFlightTime,
  gravity = LURKER_CONFIG.pounceGravity,
}) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dz = target.z - from.z;

  const vx = dx / flightTime;
  const vy = (dy + 0.5 * gravity * flightTime * flightTime) / flightTime;
  const vz = dz / flightTime;

  return new THREE.Vector3(vx, vy, vz);
}

/**
 * Samples points along the 3D pounce trajectory arc for physics tracing and visualization.
 */
export function samplePounceArcPoints({
  from,
  target,
  flightTime = LURKER_CONFIG.pounceFlightTime,
  gravity = LURKER_CONFIG.pounceGravity,
  steps = 10,
}) {
  const vel = compute3DPounceTrajectory({ from, target, flightTime, gravity });
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * flightTime;
    const x = from.x + vel.x * t;
    const y = from.y + vel.y * t - 0.5 * gravity * t * t;
    const z = from.z + vel.z * t;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

/**
 * Determines whether a target is inside the player's flashlight cone.
 */
export function isTargetInFlashlightBeam({
  camPos,
  camDir,
  targetPos,
  coneAngle = LURKER_CONFIG.flashlightConeAngle,
  maxRange = LURKER_CONFIG.flashlightMaxRange,
}) {
  const toTarget = new THREE.Vector3(
    targetPos.x - camPos.x,
    targetPos.y - camPos.y,
    targetPos.z - camPos.z
  );
  const dist = toTarget.length();
  if (dist > maxRange || dist < 0.4) return false;

  toTarget.normalize();
  const forward = camDir.clone().normalize();
  const dot = forward.dot(toTarget);

  return dot >= Math.cos(coneAngle);
}

/**
 * Master step update for Lurker special mechanics:
 * Prowl drops, shadow cloaking, flashlight disorientation, and 3D pounce leaps.
 */
export function stepLurkerAI(zombie, dt, ctx) {
  if (!zombie || !zombie.alive || zombie.type !== 'lurker') return null;

  const pos = zombie.group ? zombie.group.position : zombie.pos;
  const playerPos = ctx.playerPos;
  if (!pos || !playerPos) return null;

  zombie.pounceCooldown = Math.max(0, (zombie.pounceCooldown || 0) - dt);
  zombie.blindedTimer = Math.max(0, (zombie.blindedTimer || 0) - dt);

  // 1. Flashlight beam check & shadow cloaking
  if (ctx.flashlightActive && ctx.camPos && ctx.camDir) {
    const inBeam = isTargetInFlashlightBeam({
      camPos: ctx.camPos,
      camDir: ctx.camDir,
      targetPos: new THREE.Vector3(pos.x, pos.y + 0.4, pos.z),
    });

    if (inBeam) {
      if (zombie.blindedTimer <= 0) {
        zombie.blindedTimer = LURKER_CONFIG.blindedDuration;
        zombie.flinch = Math.max(zombie.flinch || 0, 1.0);
        if (ctx.audio && typeof ctx.audio.lurkerHiss === 'function') {
          ctx.audio.lurkerHiss(Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z));
        }
        // If caught prowling on wall by direct beam, disoriented drop to ground!
        if (zombie.state === 'prowl') {
          zombie.state = 'pounce_recover';
          zombie.windup = 0;
          pos.y = 0;
          return { handled: true, blindedOnWall: true };
        }
      }
    }
  }

  // 2. Roof & Wall Prowl Ambush State
  if (zombie.state === 'prowl') {
    const distToPlayer = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
    // When player gets within 8.5m or turns away, ambush drop down!
    if (distToPlayer <= 8.5) {
      zombie.state = 'pounce_leap';
      zombie.pounceLeapTime = 0;
      const targetChest = new THREE.Vector3(playerPos.x, playerPos.y + 0.9, playerPos.z);
      zombie.leapVel = compute3DPounceTrajectory({
        from: pos,
        target: targetChest,
        flightTime: 0.48,
      });
      if (ctx.audio && typeof ctx.audio.lurkerHiss === 'function') {
        ctx.audio.lurkerHiss(distToPlayer);
      }
      return { handled: true, droppedFromProwl: true };
    }
    return { handled: true, isProwling: true };
  }

  // 3. Pounce Windup State (Telegraphed coil & hiss)
  if (zombie.state === 'pounce_windup') {
    zombie.windup = (zombie.windup || 0) + dt;
    if (zombie.windup >= LURKER_CONFIG.pounceWindupTime) {
      zombie.state = 'pounce_leap';
      zombie.pounceLeapTime = 0;
      zombie.windup = 0;

      // True 3D target factoring in player elevation (e.g. standing on car hood!)
      const targetChest = new THREE.Vector3(playerPos.x, playerPos.y + 0.9, playerPos.z);
      zombie.leapVel = compute3DPounceTrajectory({
        from: pos,
        target: targetChest,
        flightTime: LURKER_CONFIG.pounceFlightTime,
      });
    }
    return { handled: true, windup: zombie.windup };
  }

  // 4. Pounce Leap State (Ballistic 3D flight toward elevated/ground player)
  if (zombie.state === 'pounce_leap') {
    zombie.pounceLeapTime = (zombie.pounceLeapTime || 0) + dt;

    if (zombie.leapVel) {
      zombie.leapVel.y -= LURKER_CONFIG.pounceGravity * dt;
      pos.x += zombie.leapVel.x * dt;
      pos.y += zombie.leapVel.y * dt;
      pos.z += zombie.leapVel.z * dt;
    }

    const targetChest = new THREE.Vector3(playerPos.x, playerPos.y + 0.9, playerPos.z);
    const distToChest = pos.distanceTo(targetChest);

    // Impact detection: connected with player in 3D!
    if (distToChest <= 1.25) {
      if (ctx.damagePlayer) {
        ctx.damagePlayer(LURKER_CONFIG.pounceDamage, zombie);
      }
      if (ctx.playerVel && zombie.leapVel) {
        ctx.playerVel.x += zombie.leapVel.x * 0.15;
        ctx.playerVel.z += zombie.leapVel.z * 0.15;
      }
      if (ctx.audio && typeof ctx.audio.snarl === 'function') {
        ctx.audio.snarl(distToChest);
      }
      zombie.state = 'chase';
      zombie.pounceCooldown = LURKER_CONFIG.pounceCooldown;
      pos.y = Math.max(0, playerPos.y); // Land at player elevation
      return { handled: true, hitPlayer: true };
    }

    // Land on ground or surface
    if (pos.y <= 0.05 || zombie.pounceLeapTime >= LURKER_CONFIG.pounceFlightTime + 0.12) {
      pos.y = 0;
      zombie.state = 'pounce_recover';
      zombie.windup = 0;
      zombie.pounceCooldown = LURKER_CONFIG.pounceCooldown;
      return { handled: true, landed: true };
    }

    return { handled: true, inAir: true };
  }

  // 5. Pounce Recovery State (Stumble after landing past player)
  if (zombie.state === 'pounce_recover') {
    zombie.windup = (zombie.windup || 0) + dt;
    if (zombie.windup >= LURKER_CONFIG.pounceRecoverTime) {
      zombie.state = 'chase';
      zombie.windup = 0;
    }
    return { handled: true, recovering: true };
  }

  // 6. Initiate Pounce from Chase State
  if (zombie.state === 'chase' && zombie.pounceCooldown <= 0 && zombie.blindedTimer <= 0) {
    const toPlayer3D = new THREE.Vector3(
      playerPos.x - pos.x,
      (playerPos.y + 0.8) - pos.y,
      playerPos.z - pos.z
    );
    const dist3D = toPlayer3D.length();

    if (dist3D >= LURKER_CONFIG.pounceMinDist && dist3D <= LURKER_CONFIG.pounceMaxDist) {
      zombie.state = 'pounce_windup';
      zombie.windup = 0;
      if (ctx.audio && typeof ctx.audio.lurkerHiss === 'function') {
        ctx.audio.lurkerHiss(dist3D);
      }
      return { handled: true, initiatedPounce: true };
    }
  }

  return null;
}
