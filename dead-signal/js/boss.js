// Multi-phase boss architecture, Gatekeeper encounter mechanics,
// ballistic concrete chunk throw, and weak point spine pustule targeting.
// Designed to run in both Node.js (unit tests) and browser (runtime WebGL).

export const GATEKEEPER_PHASES = {
  PHASE_1: 1, // 100% - 60% HP: Armored Titan, Heavy Club Swings, Ground Slam
  PHASE_2: 2, // 60% - 25% HP: Enraged Berserker, Armor Shatter, +35% Speed, Concrete Rock Throw
  PHASE_3: 3, // < 25% HP: Relentless Frenzy, Runner Swarm Escort, Fast Relentless Charges
};

export const GATEKEEPER_THRESHOLDS = {
  PHASE_2: 0.60,
  PHASE_3: 0.25,
};

/**
 * Pure ballistic trajectory calculation for thrown concrete chunks.
 * Solves for initial velocity vector (vx, vy, vz) given start point,
 * target point, horizontal speed, and gravity.
 */
export function calculateRockTrajectory({
  from,
  target,
  speed = 22.0,
  gravity = 14.0,
}) {
  const dx = target.x - from.x;
  const dy = (target.y !== undefined ? target.y : 0) - (from.y !== undefined ? from.y : 1.8);
  const dz = target.z - from.z;
  const distXZ = Math.hypot(dx, dz);

  // Time of flight clamped between 0.35s and 1.35s
  const flightTime = Math.min(1.35, Math.max(0.35, distXZ / Math.max(1, speed)));

  const vx = dx / flightTime;
  const vz = dz / flightTime;
  // dy = vy * t - 0.5 * g * t^2  =>  vy = (dy + 0.5 * g * t^2) / t
  const vy = (dy + 0.5 * gravity * flightTime * flightTime) / flightTime;

  return {
    vel: { x: vx, y: vy, z: vz },
    flightTime,
    distXZ,
    gravity,
  };
}

/**
 * Sample discrete points along the rock arc for trajectory visualization or ray collision.
 */
export function sampleRockTrajectoryPoints({
  from,
  vel,
  gravity = 14.0,
  flightTime,
  steps = 10,
}) {
  const points = [];
  const dt = flightTime / steps;
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    points.push({
      x: from.x + vel.x * t,
      y: from.y + vel.y * t - 0.5 * gravity * t * t,
      z: from.z + vel.z * t,
      t,
    });
  }
  return points;
}

/**
 * Factory for a live rock projectile.
 */
export function createRockProjectile({
  id = Math.random().toString(36).slice(2),
  from,
  target,
  damage = 38,
  aoeRadius = 3.2,
  speed = 22.0,
  gravity = 14.0,
  mesh = null,
}) {
  const traj = calculateRockTrajectory({ from, target, speed, gravity });
  return {
    id,
    pos: { x: from.x, y: from.y !== undefined ? from.y : 1.8, z: from.z },
    vel: { ...traj.vel },
    gravity,
    flightTime: traj.flightTime,
    timeAlive: 0,
    radius: 0.42,
    damage,
    aoeRadius,
    active: true,
    mesh,
  };
}

/**
 * Step rock physics, ground impact, and AoE player damage.
 */
export function stepRockProjectile(rock, dt, ctx = {}) {
  if (!rock.active) return { active: false };

  rock.timeAlive += dt;
  rock.vel.y -= rock.gravity * dt;
  rock.pos.x += rock.vel.x * dt;
  rock.pos.y += rock.vel.y * dt;
  rock.pos.z += rock.vel.z * dt;

  if (rock.mesh) {
    rock.mesh.position.set(rock.pos.x, rock.pos.y, rock.pos.z);
    rock.mesh.rotation.x += dt * 4.5;
    rock.mesh.rotation.y += dt * 3.2;
  }

  const playerPos = ctx.playerPos || { x: 0, y: 0, z: 0 };
  const distToPlayer = Math.hypot(
    rock.pos.x - playerPos.x,
    (rock.pos.y || 0) - (playerPos.y || 0),
    rock.pos.z - playerPos.z
  );

  let impact = false;
  let impactReason = null;

  // Direct hit on player body
  if (distToPlayer <= rock.radius + 0.55) {
    impact = true;
    impactReason = 'player_direct';
  } else if (rock.pos.y <= 0.22) {
    // Ground impact
    impact = true;
    impactReason = 'ground';
    rock.pos.y = 0.22;
  } else if (ctx.colliders && Array.isArray(ctx.colliders)) {
    // Building / obstacle collider check
    for (const c of ctx.colliders) {
      if (
        rock.pos.x >= c.minX && rock.pos.x <= c.maxX &&
        rock.pos.z >= c.minZ && rock.pos.z <= c.maxZ &&
        rock.pos.y < (c.height || 4)
      ) {
        impact = true;
        impactReason = 'obstacle';
        break;
      }
    }
  }

  if (impact) {
    rock.active = false;
    let playerDamageDealt = 0;

    // AoE damage check
    const aoeDist = Math.hypot(rock.pos.x - playerPos.x, rock.pos.z - playerPos.z);
    if (aoeDist <= rock.aoeRadius) {
      const falloff = 1 - Math.max(0, aoeDist / rock.aoeRadius);
      playerDamageDealt = Math.round(rock.damage * (0.45 + falloff * 0.55));
      if (ctx.damagePlayer && typeof ctx.damagePlayer === 'function') {
        ctx.damagePlayer(playerDamageDealt, { type: 'rock_throw', boss: true });
      }
      if (ctx.screenShake && typeof ctx.screenShake === 'function') {
        ctx.screenShake(0.65 * falloff);
      }
    }

    if (ctx.onImpact && typeof ctx.onImpact === 'function') {
      ctx.onImpact(rock, impactReason, playerDamageDealt);
    }

    return {
      active: false,
      impact: true,
      reason: impactReason,
      impactPos: { ...rock.pos },
      playerDamageDealt,
    };
  }

  return { active: true, pos: { ...rock.pos } };
}

/**
 * Initialize Gatekeeper multi-phase attributes and weakpoint hit volume.
 */
export function initGatekeeperBoss(boss, THREE = null) {
  boss.isGatekeeper = true;
  boss.phase = GATEKEEPER_PHASES.PHASE_1;
  boss.baseSpeed = boss.speed || 1.4;
  boss.armorPlatesBroken = false;
  boss.runnerEscortSummoned = false;
  boss.canThrowRock = false;
  boss.abilityCooldownScale = 1.0;
  boss.poiseActive = true; // High poise during abilities

  // Setup visual weakpoint pustule on upper spine/back
  if (THREE && boss.rig && boss.rig.hips) {
    const pustuleGeo = new THREE.SphereGeometry(0.19, 8, 8);
    // Non-uniform bulging shape
    pustuleGeo.scale(1.2, 1.5, 0.95);
    const pustuleMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3b00,
      emissiveIntensity: 1.4,
      roughness: 0.35,
    });
    const pustule = new THREE.Mesh(pustuleGeo, pustuleMat);
    // Positioned on upper spine / dorsal back: x=0, y=0.52, z=-0.17 (behind back)
    pustule.position.set(0, 0.52, -0.17);
    pustule.rotation.x = -0.12;
    pustule.userData.part = 'weakpoint';
    pustule.userData.isWeakpoint = true;
    pustule.userData.zombie = boss;
    boss.rig.hips.add(pustule);

    boss.spinePustule = pustule;
    if (boss.hitMeshes && !boss.hitMeshes.includes(pustule)) {
      boss.hitMeshes.push(pustule);
    }

    // Attach heavy armor plates on chest/shoulders
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x3d4349,
      metalness: 0.65,
      roughness: 0.45,
    });
    const plateGeo = new THREE.BoxGeometry(0.55, 0.42, 0.12);
    const chestPlate = new THREE.Mesh(plateGeo, plateMat);
    chestPlate.position.set(0, 0.48, 0.18); // Mounted over chest
    boss.rig.hips.add(chestPlate);
    boss.armorPlates = [chestPlate];
  }

  return boss;
}

/**
 * State machine: evaluate phase transitions based on current HP ratio.
 */
export function evaluateGatekeeperPhase(boss, prevHp, curHp, ctx = {}) {
  if (!boss || !boss.isBoss) return null;
  const maxHp = boss.maxHp || 1000;
  const ratio = Math.max(0, curHp / maxHp);

  // Phase 1 -> Phase 2 Transition (HP <= 60%)
  if (boss.phase === GATEKEEPER_PHASES.PHASE_1 && ratio <= GATEKEEPER_THRESHOLDS.PHASE_2) {
    boss.phase = GATEKEEPER_PHASES.PHASE_2;
    boss.armorPlatesBroken = true;

    // Break armor plates: hide meshes and trigger debris
    if (boss.armorPlates && Array.isArray(boss.armorPlates)) {
      for (const plate of boss.armorPlates) {
        plate.visible = false;
      }
    }

    // 35% movement speed enrage boost
    if (!boss.phase2SpeedApplied) {
      boss.speed = (boss.baseSpeed || boss.speed) * 1.35;
      boss.phase2SpeedApplied = true;
    }

    // Unlock concrete chunk throw at range
    boss.canThrowRock = true;

    // Trigger visual and audio cues
    if (ctx.onPhaseTransition && typeof ctx.onPhaseTransition === 'function') {
      ctx.onPhaseTransition(boss, GATEKEEPER_PHASES.PHASE_2, {
        name: 'ENRAGED_BERSERKER',
        speedIncrease: 0.35,
      });
    }

    return {
      transition: true,
      fromPhase: GATEKEEPER_PHASES.PHASE_1,
      toPhase: GATEKEEPER_PHASES.PHASE_2,
      name: 'ENRAGED_BERSERKER',
    };
  }

  // Phase 2 -> Phase 3 Transition (HP <= 25%)
  if (boss.phase === GATEKEEPER_PHASES.PHASE_2 && ratio <= GATEKEEPER_THRESHOLDS.PHASE_3) {
    boss.phase = GATEKEEPER_PHASES.PHASE_3;
    boss.abilityCooldownScale = 0.55; // 45% faster ability cycles

    // Blazing crimson eye glow in Phase 3
    if (boss.spinePustule && boss.spinePustule.material) {
      boss.spinePustule.material.emissive.setHex(0xff0022);
      boss.spinePustule.material.emissiveIntensity = 2.4;
    }

    // Spawn runner swarm escort (3 fast runner zombies)
    let summonedCount = 0;
    if (!boss.runnerEscortSummoned) {
      boss.runnerEscortSummoned = true;
      summonedCount = 3;
      if (ctx.spawnRunnerEscort && typeof ctx.spawnRunnerEscort === 'function') {
        ctx.spawnRunnerEscort(boss, 3);
      }
    }

    if (ctx.onPhaseTransition && typeof ctx.onPhaseTransition === 'function') {
      ctx.onPhaseTransition(boss, GATEKEEPER_PHASES.PHASE_3, {
        name: 'RELENTLESS_FRENZY',
        summonedCount,
      });
    }

    return {
      transition: true,
      fromPhase: GATEKEEPER_PHASES.PHASE_2,
      toPhase: GATEKEEPER_PHASES.PHASE_3,
      name: 'RELENTLESS_FRENZY',
      summonedCount,
    };
  }

  return null;
}

/**
 * Handle weak point spine pustule rupture:
 * - Deals 2.5x critical damage
 * - Ruptures poise and inflicts 2.0s vulnerable stun
 * - Cleanly terminates any active windup (preventing animation lock)
 */
export function ruptureGatekeeperWeakpoint(boss, ctx = {}) {
  boss.staggerTimer = 2.0;
  boss.flinch = 2.0;

  // Cleanly reset any ability windup or active state
  if (typeof boss.finishAbility === 'function') {
    boss.finishAbility();
  } else {
    boss.abilityState = 'idle';
    boss.abilityWindup = 0;
    boss.abilityHits = false;
  }

  if (ctx.onWeakpointRuptured && typeof ctx.onWeakpointRuptured === 'function') {
    ctx.onWeakpointRuptured(boss);
  }

  return {
    ruptured: true,
    damageMultiplier: 2.5,
    stunDuration: 2.0,
  };
}
