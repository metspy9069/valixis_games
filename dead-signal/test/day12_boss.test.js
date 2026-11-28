import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  GATEKEEPER_PHASES,
  GATEKEEPER_THRESHOLDS,
  calculateRockTrajectory,
  sampleRockTrajectoryPoints,
  createRockProjectile,
  stepRockProjectile,
  initGatekeeperBoss,
  evaluateGatekeeperPhase,
  ruptureGatekeeperWeakpoint,
} from '../js/boss.js';
import { HIT_ZONES, hitZoneFor } from '../js/ballistics.js';
import { Zombie } from '../js/zombie.js';

test('Day 12: Ballistic math - HIT_ZONES defines weakpoint with 2.5x critical multiplier and 2.0s stagger', () => {
  const weakZone = hitZoneFor('weakpoint');
  assert.ok(weakZone, 'weakpoint zone must exist in HIT_ZONES');
  assert.equal(weakZone.multiplier, 2.5, 'weakpoint must have 2.5x damage multiplier');
  assert.equal(weakZone.crit, true, 'weakpoint must register as critical hit');
  assert.equal(weakZone.stagger, 2.0, 'weakpoint must have 2.0s stagger property');
  assert.ok(weakZone.priority >= 4, 'weakpoint must have higher priority than limbs/torso');
});

test('Day 12: Gatekeeper boss initialization sets up 3-phase state and spine weakpoint', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 1000;
  boss.hp = 1000;

  initGatekeeperBoss(boss, THREE);

  assert.equal(boss.isGatekeeper, true, 'isGatekeeper flag must be set');
  assert.equal(boss.phase, GATEKEEPER_PHASES.PHASE_1, 'Boss must start in Phase 1 (Armored Titan)');
  assert.equal(boss.armorPlatesBroken, false, 'Armor plates must be intact in Phase 1');
  assert.equal(boss.canThrowRock, false, 'Rock throw must be locked in Phase 1');
  assert.ok(boss.spinePustule, 'Spine pustule mesh must be created');
  assert.equal(boss.spinePustule.userData.part, 'weakpoint', 'Pustule part must be weakpoint');
  assert.ok(boss.hitMeshes.includes(boss.spinePustule), 'Pustule must be registered in boss hitMeshes');
});

test('Day 12: Phase 1 -> Phase 2 Transition at <= 60% HP breaks armor, grants +35% speed, and unlocks concrete throw', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 1000;
  boss.hp = 1000;
  boss.baseSpeed = 2.0;
  boss.speed = 2.0;

  initGatekeeperBoss(boss, THREE);

  // Damage to 65% HP (no transition)
  const res1 = evaluateGatekeeperPhase(boss, 1000, 650);
  assert.equal(res1, null, 'Should not transition at 65% HP');
  assert.equal(boss.phase, GATEKEEPER_PHASES.PHASE_1);
  assert.equal(boss.armorPlatesBroken, false);

  // Damage across 60% threshold to 580 HP
  let transitionEvent = null;
  const ctx = {
    onPhaseTransition: (b, toPhase, details) => {
      transitionEvent = { toPhase, details };
    },
  };
  const res2 = evaluateGatekeeperPhase(boss, 650, 580, ctx);

  assert.ok(res2 && res2.transition, 'Must trigger phase transition');
  assert.equal(boss.phase, GATEKEEPER_PHASES.PHASE_2, 'Must transition to Phase 2 (Enraged Berserker)');
  assert.equal(boss.armorPlatesBroken, true, 'Armor plates must break off in Phase 2');
  assert.equal(boss.canThrowRock, true, 'Rock throw ability must be unlocked in Phase 2');
  assert.ok(
    Math.abs(boss.speed - 2.0 * 1.35) < 1e-4,
    `Movement speed must increase by 35% (expected 2.7, got ${boss.speed})`
  );
  assert.ok(transitionEvent, 'Context callback onPhaseTransition must be invoked');
  assert.equal(transitionEvent.toPhase, GATEKEEPER_PHASES.PHASE_2);
});

test('Day 12: Phase 2 -> Phase 3 Transition at <= 25% HP activates frenzy, summons 3 runner escorts', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 1000;
  boss.hp = 500;
  boss.phase = GATEKEEPER_PHASES.PHASE_2;

  initGatekeeperBoss(boss, THREE);
  boss.phase = GATEKEEPER_PHASES.PHASE_2; // Ensure in phase 2

  let spawnedRunners = 0;
  const ctx = {
    spawnRunnerEscort: (b, count) => {
      spawnedRunners = count;
    },
  };

  // Damage across 25% threshold to 220 HP
  const res = evaluateGatekeeperPhase(boss, 300, 220, ctx);

  assert.ok(res && res.transition, 'Must trigger phase 3 transition');
  assert.equal(boss.phase, GATEKEEPER_PHASES.PHASE_3, 'Must transition to Phase 3 (Relentless Frenzy)');
  assert.equal(boss.abilityCooldownScale, 0.55, 'Ability cooldowns must be scaled to 0.55 for relentless rhythm');
  assert.equal(spawnedRunners, 3, 'Must summon an escort swarm of 3 runners');
  assert.equal(boss.runnerEscortSummoned, true, 'Runner escort summoned flag must be true');

  // Further damage in phase 3 does not duplicate runner summons
  spawnedRunners = 0;
  evaluateGatekeeperPhase(boss, 220, 150, ctx);
  assert.equal(spawnedRunners, 0, 'Must not re-summon runners once already triggered');
});

test('Day 12: Weak Point Spine Pustule Targeting ruptures poise and stuns boss for 2.0s', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 1000;
  boss.hp = 1000;
  boss.bossAbility = 'slam';
  boss.abilityState = 'windup';
  boss.abilityWindup = 0.45;

  initGatekeeperBoss(boss, THREE);

  let weakpointEventTriggered = false;
  const ctx = {
    audio: {
      weakpointHit: () => { weakpointEventTriggered = true; },
      hit: () => {},
    },
  };

  // Shoot weak point pustule
  boss.takeDamage(100, 'weakpoint', ctx);

  // Weakpoint deals 2.5x damage = 250 dmg => hp = 750
  assert.equal(boss.hp, 750, 'Weakpoint hit should deal 2.5x damage (250 dmg)');
  assert.equal(boss.staggerTimer, 2.0, 'Weakpoint hit must inflict 2.0s vulnerable stun');
  assert.equal(boss.flinch, 2.0, 'Weakpoint hit must apply 2.0 flinch');
  assert.equal(boss.abilityState, 'idle', 'Weakpoint rupture must cleanly interrupt active windup');
  assert.equal(boss.abilityWindup, 0, 'Windup timer must reset to 0');
  assert.equal(weakpointEventTriggered, true, 'Audio weakpointHit cue must play');
});

test('Day 12: Bug 1 Fix - Poise prevents slam windup from getting trapped in infinite stagger loop', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 1000;
  boss.hp = 1000;
  boss.bossAbility = 'slam';
  boss.abilityState = 'windup';
  boss.abilityWindup = 0.50;

  let shockwaveTriggered = false;
  const ctx = {
    shockwave: () => { shockwaveTriggered = true; },
    abilityCry: () => {},
    audio: { hit: () => {} },
  };

  // Normal limb hit (> 60 dmg) arrives during slam windup
  boss.takeDamage(85, 'limb', ctx);

  // With unstoppable poise, windup is NOT reset to 0 and staggerTimer is NOT set
  assert.equal(boss.abilityState, 'windup', 'Boss must remain in windup (unstoppable poise)');
  assert.equal(boss.abilityWindup, 0.50, 'abilityWindup must NOT be reset by normal limb hits');
  assert.equal(boss.staggerTimer, 0, 'Boss poise must resist stagger during ability windup');

  // Step boss ability forward past warn threshold (0.85s)
  boss.stepAbility(0.40, ctx, 4.0, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0));

  assert.equal(boss.abilityState, 'active', 'Boss must cleanly transition to active state');
  assert.equal(shockwaveTriggered, true, 'Shockwave must execute cleanly without looping');

  // Step forward to complete recovery
  boss.stepAbility(0.60, ctx, 4.0, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0));
  assert.equal(boss.abilityState, 'idle', 'Boss must return to idle state after slam');
  assert.ok(boss.abilityCd > 0, 'Boss ability must pay cooldown');
});

test('Day 12: Bug 2 Fix - Boss health bar immediately hides and clears game.boss on defeat', () => {
  const boss = new Zombie('brute', new THREE.Vector3(0, 0, 0));
  boss.isBoss = true;
  boss.maxHp = 500;
  boss.hp = 40;

  let hudHidden = false;
  let bossCleared = false;
  const fakeHud = {
    boss: {
      classList: {
        remove: (cls) => { if (cls === 'show') hudHidden = true; },
        add: () => {},
      },
      style: { opacity: '1' },
    },
  };

  const ctx = {
    hud: fakeHud,
    clearBoss: () => { bossCleared = true; },
    audio: { hit: () => {}, kill: () => {}, zombieDeath: () => {} },
    onDeath: () => {},
  };

  // Lethal hit
  boss.takeDamage(100, 'body', ctx);

  assert.equal(boss.alive, false, 'Boss must be marked dead');
  assert.equal(hudHidden, true, 'hud.boss must immediately have .show class removed');
  assert.equal(fakeHud.boss.style.opacity, '0', 'hud.boss opacity must be set to 0');
  assert.equal(bossCleared, true, 'ctx.clearBoss must be called to nullify game.boss');
});

test('Day 12: Concrete Rock Throw Ballistics calculates true 3D trajectory and AoE impact', () => {
  const from = { x: 0, y: 2.0, z: 0 };
  const playerTarget = { x: 0, y: 0, z: 15.0 };

  const traj = calculateRockTrajectory({
    from,
    target: playerTarget,
    speed: 22.0,
    gravity: 14.0,
  });

  assert.ok(traj.flightTime > 0.4 && traj.flightTime < 1.0, 'Flight time should be reasonable');
  assert.ok(traj.vel.z > 15, 'Horizontal velocity must project toward target');
  assert.ok(traj.vel.y > 0, 'Vertical velocity must loft upward under gravity');

  // Sample arc points
  const points = sampleRockTrajectoryPoints({
    from,
    vel: traj.vel,
    gravity: traj.gravity,
    flightTime: traj.flightTime,
    steps: 10,
  });

  assert.equal(points.length, 11, 'Must sample 11 points along arc');
  const terminalPoint = points[points.length - 1];
  assert.ok(
    Math.abs(terminalPoint.z - 15.0) < 1e-3,
    `Terminal z must match player position (got ${terminalPoint.z})`
  );
  assert.ok(
    Math.abs(terminalPoint.y - 0.0) < 1e-3,
    `Terminal y must reach player ground elevation (got ${terminalPoint.y})`
  );

  // Test live rock projectile simulation & AoE impact
  const rock = createRockProjectile({
    from,
    target: playerTarget,
    damage: 40,
    aoeRadius: 3.0,
    speed: 22.0,
    gravity: 14.0,
  });

  assert.equal(rock.active, true);

  let playerDamagedAmount = 0;
  const simCtx = {
    playerPos: { x: 0, y: 0, z: 15.0 },
    damagePlayer: (dmg) => { playerDamagedAmount = dmg; },
    colliders: [],
  };

  // Step projectile through flight until landing
  let impactReport = null;
  for (let step = 0; step < 20; step++) {
    const res = stepRockProjectile(rock, 0.05, simCtx);
    if (res.impact) {
      impactReport = res;
      break;
    }
  }

  assert.ok(impactReport && impactReport.impact, 'Rock must impact on arrival');
  assert.equal(rock.active, false, 'Rock must deactivate upon impact');
  assert.ok(playerDamagedAmount > 0, 'Player within AoE radius must take blast damage');
  assert.ok(playerDamagedAmount >= 30, `Direct/close impact should deal near full damage (got ${playerDamagedAmount})`);
});
