import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THROWABLE_TYPES,
  isExplosionOccluded,
  calculateExplosionDamage,
  stepThrowablePhysics,
  createCookState,
  updateCookState,
  releaseCookState,
  computeTrajectoryArc,
  createFirePool,
  updateFirePool,
  createPipeBombLure,
  updatePipeBombLure,
  findActiveLureTarget,
} from '../js/throwables.js';

test('THROWABLE_TYPES defines 3 distinct tactical throwables with complete specifications', () => {
  const { frag, molotov, pipeBomb } = THROWABLE_TYPES;
  assert.ok(frag, 'frag definition exists');
  assert.ok(molotov, 'molotov definition exists');
  assert.ok(pipeBomb, 'pipeBomb definition exists');

  // Frag
  assert.equal(frag.id, 'frag');
  assert.equal(frag.damage, 320);
  assert.equal(frag.radius, 5.8);
  assert.equal(frag.shattersOnImpact, false);

  // Molotov
  assert.equal(molotov.id, 'molotov');
  assert.equal(molotov.shattersOnImpact, true);
  assert.equal(molotov.poolDuration, 8.0);
  assert.equal(molotov.dps, 34);

  // Pipe Bomb
  assert.equal(pipeBomb.id, 'pipeBomb');
  assert.equal(pipeBomb.shattersOnImpact, false);
  assert.equal(pipeBomb.lureRadius, 22.0);
  assert.equal(pipeBomb.lureDuration, 3.5);
  assert.equal(pipeBomb.damage, 420);
});

test('stepThrowablePhysics prevents sidewalk and ground tunneling at extreme downward velocity (CCD)', () => {
  const groundY = 0.08;
  const radius = 0.1;

  // Projectile moving downwards at extreme speed: 28 m/s downward, 0.02s step = 0.56m drop
  // Starting from y = 0.2m, an unconstrained step would reach y = -0.36m (tunneling completely below sidewalk)
  const proj = {
    pos: { x: 0, y: 0.2, z: 0 },
    vel: { x: 4.0, y: -28.0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    spin: { x: 5, y: 5, z: 5 },
    radius,
    def: { gravity: 20.0, bounciness: 0.35, friction: 0.68 },
  };

  const colliders = [];
  const result = stepThrowablePhysics(proj, 0.02, colliders, groundY);

  assert.equal(result.groundHit, true, 'Continuous collision detection correctly detected ground intersection');
  assert.ok(proj.pos.y >= groundY + radius - 1e-4, `Position y (${proj.pos.y}) was clamped above ground plane (${groundY + radius})`);
  assert.ok(proj.vel.y > 0, `Vertical velocity was reflected upward on bounce (${proj.vel.y})`);
  assert.ok(Math.abs(proj.vel.x) < 4.0, 'Friction dampened horizontal velocity');
});

test('isExplosionOccluded blocks blast damage through 2-meter solid concrete barrier walls', () => {
  // Solid concrete barrier between x = 4 and x = 6 (thickness 2m, height 4m)
  const colliders = [
    {
      minX: 4.0,
      maxX: 6.0,
      minZ: -8.0,
      maxZ: 8.0,
      height: 4.0,
      penetrable: false,
    },
  ];

  const blastPos = { x: 2.0, y: 0.5, z: 0.0 };
  const targetBehindWall = { x: 8.0, y: 1.0, z: 0.0 };
  const targetClearSight = { x: 2.0, y: 1.0, z: 3.5 };

  // 1. Target behind solid concrete barrier
  const isOccluded = isExplosionOccluded(blastPos, targetBehindWall, colliders);
  assert.equal(isOccluded, true, 'Explosion shockwave must be occluded by solid concrete wall');

  const damageBehind = calculateExplosionDamage(blastPos, targetBehindWall, 320, 50, 8.0, isOccluded);
  assert.equal(damageBehind.damage, 0, 'Target behind solid concrete barrier takes 0 direct blast damage');
  assert.equal(damageBehind.occluded, true);

  // 2. Target with direct line of sight
  const isClear = isExplosionOccluded(blastPos, targetClearSight, colliders);
  assert.equal(isClear, false, 'Explosion shockwave has unobstructed line of sight');

  const damageClear = calculateExplosionDamage(blastPos, targetClearSight, 320, 50, 8.0, isClear);
  assert.ok(damageClear.damage > 100, `Target with line of sight takes blast damage (${damageClear.damage})`);
  assert.equal(damageClear.occluded, false);
});

test('createCookState and updateCookState enable precision fuse cooking and airburst timing', () => {
  const cook = createCookState('frag');
  assert.equal(cook.isCooking, true);
  assert.equal(cook.fuseRemaining, THROWABLE_TYPES.frag.fuse);

  // Cook for 1.2 seconds
  updateCookState(cook, 1.2);
  assert.ok(Math.abs(cook.fuseRemaining - (THROWABLE_TYPES.frag.fuse - 1.2)) < 1e-4);
  assert.equal(cook.detonatedInHand, false);

  // Release throw
  const released = releaseCookState(cook);
  assert.equal(released.detonatedInHand, false);
  assert.ok(released.fuse < THROWABLE_TYPES.frag.fuse, 'Airborne fuse is reduced by cooking duration');
  assert.ok(released.fuse >= THROWABLE_TYPES.frag.minCookFuse, 'Fuse respects minimum release threshold');

  // Overcooked in hand until expiration
  const overcook = createCookState('frag');
  updateCookState(overcook, 3.0);
  assert.equal(overcook.detonatedInHand, true, 'Fuse expiring in hand marks detonatedInHand');
  const overcookedRelease = releaseCookState(overcook);
  assert.equal(overcookedRelease.detonatedInHand, true);
});

test('computeTrajectoryArc simulates ballistic path points ending at ground or obstacle impact', () => {
  const origin = { x: 0, y: 1.5, z: 0 };
  const dir = { x: 0, y: 0.2, z: -1.0 }; // Throwing forward and slightly up
  const points = computeTrajectoryArc(origin, dir, 17.5, 5.2, 20.0, []);

  assert.ok(points.length > 5, 'Generated realistic trajectory trajectory points');
  assert.equal(points[0].x, origin.x);
  assert.equal(points[0].y, origin.y);
  assert.equal(points[0].z, origin.z);

  // Points should advance forward (-Z) and eventually touch ground
  const lastPoint = points[points.length - 1];
  assert.ok(lastPoint.z < -5.0, 'Trajectory arc traveled forward');
  assert.ok(Math.abs(lastPoint.y - 0.08) < 1e-3, 'Trajectory arc terminated at ground level');
});

test('createFirePool and updateFirePool expand ground flames and apply area denial DoT', () => {
  const pool = createFirePool({ x: 10, y: 0, z: 10 }, THROWABLE_TYPES.molotov);
  assert.equal(pool.active, true);
  assert.equal(pool.radius, 0.6);
  assert.equal(pool.duration, 8.0);

  const zombieInside = {
    alive: true,
    pos: { x: 10.5, y: 0, z: 10.5 },
  };
  const zombieOutside = {
    alive: true,
    pos: { x: 25.0, y: 0, z: 25.0 },
  };

  let burnedZombie = null;
  let damageDealt = 0;
  let ignitedDuration = 0;

  // Step 1.5s: pool expands to full radius
  updateFirePool(
    pool,
    1.5,
    [zombieInside, zombieOutside],
    { x: 0, y: 0, z: 0 },
    (z, dmg, burnDur, burnDps) => {
      burnedZombie = z;
      damageDealt += dmg;
      ignitedDuration = burnDur;
    },
    null
  );

  assert.ok(pool.radius > 3.0, `Fire pool expanded outwards over time (${pool.radius}m)`);
  assert.equal(burnedZombie, zombieInside, 'Zombie standing inside fire pool took damage');
  assert.ok(damageDealt > 0, `Damage over time was applied (${damageDealt})`);
  assert.equal(ignitedDuration, 2.8, 'Applied lingering 2.8s ignited burn duration');

  // Step past 8.0s duration: fire pool extinguishes
  updateFirePool(pool, 7.0, [zombieInside], null, null, null);
  assert.equal(pool.active, false, 'Fire pool naturally extinguished after 8.0 seconds');
});

test('createPipeBombLure and findActiveLureTarget override horde aggro within 22 meters', () => {
  const lure = createPipeBombLure({ x: 0, y: 0.1, z: 0 }, THROWABLE_TYPES.pipeBomb);
  assert.equal(lure.active, true);
  assert.equal(lure.lureRadius, 22.0);

  // 1. Zombie within 15 meters is drawn to the siren lure
  const zombieNear = { x: 10.0, y: 0, z: 5.0 };
  const targetNear = findActiveLureTarget([lure], zombieNear);
  assert.ok(targetNear, 'Zombie within 22m successfully locked onto siren lure');
  assert.equal(targetNear.x, 0);
  assert.equal(targetNear.z, 0);

  // 2. Zombie far beyond 22 meters does not hear the lure
  const zombieFar = { x: 35.0, y: 0, z: 0.0 };
  const targetFar = findActiveLureTarget([lure], zombieFar);
  assert.equal(targetFar, null, 'Zombie outside 22m radius does not detect siren lure');

  // 3. Siren emits beeps at cadence
  let beepCount = 0;
  for (let t = 0; t < 1.0; t += 0.05) {
    updatePipeBombLure(lure, 0.05, () => {
      beepCount++;
    });
  }
  assert.ok(beepCount >= 3, `Siren lure pulsed electronic beeps (${beepCount})`);
});
