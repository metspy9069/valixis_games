import test from 'node:test';
import assert from 'node:assert/strict';

// Headless DOM mock for procedural canvas textures in Node test runner
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement: () => ({
      width: 64,
      height: 64,
      getContext: () => new Proxy({}, {
        get: (target, prop) => {
          if (prop in target) return target[prop];
          return (...args) => {};
        },
        set: (target, prop, val) => {
          target[prop] = val;
          return true;
        }
      }),
    }),
  };
}

import * as THREE from 'three';
import {
  NavGrid,
  isPointBlocked,
  probeWhiskerAvoidance,
  computeSwarmFlocking,
  computeFlankingVector,
  computeEncirclementVector,
  computeHordeSteering,
} from '../js/nav.js';
import { Zombie } from '../js/zombie.js';

test('NavGrid builds collision matrix and computes continuous flowfield around obstacles', () => {
  // A building collider at center (x: -5..5, z: -5..5)
  const colliders = [
    { minX: -5, maxX: 5, minZ: -5, maxZ: 5, height: 4 }
  ];
  const grid = new NavGrid(colliders, 2, 40, 36);

  // Rebuild flowfield with player at (0, 20)
  grid.rebuild(0, 20);

  // Check point on the other side of the building (0, -15)
  const dir = grid.direction(0, -15);
  assert.ok(dir, 'direction must exist');
  assert.ok(Number.isFinite(dir.x) && Number.isFinite(dir.z), 'direction coordinates must be finite');
  assert.ok(Math.abs(dir.length() - 1.0) < 1e-3, 'direction vector must be normalized');

  // Must steer toward the player (positive z)
  assert.ok(dir.z > 0, `Flowfield direction should advance toward target z (got z: ${dir.z})`);
});

test('Two-tier Boids swarm separation breaks single-file conga lines along broad avenues', () => {
  // Player is at (0, 0, 30)
  const playerPos = new THREE.Vector3(0, 0, 30);

  // Zombie A is ahead at (0, 0, 10) heading toward player along z
  const zombieLead = {
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(0, 0, 10) },
    moveDir: new THREE.Vector3(0, 0, 1),
  };

  // Zombie B is trailing directly behind Zombie A in a column at (0, 0, 8.2) - 1.8m behind (within 2.4m soft separation)
  const zombieTrailing = {
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(0, 0, 8.2) },
    moveDir: new THREE.Vector3(0, 0, 1),
  };

  const toPlayer = new THREE.Vector3(playerPos.x - zombieTrailing.group.position.x, 0, playerPos.z - zombieTrailing.group.position.z);
  const dist = toPlayer.length();

  const { separation, alignment } = computeSwarmFlocking(zombieTrailing, [zombieLead, zombieTrailing], toPlayer, dist);

  // Crucial test: Lateral separation force must be non-zero to fan out across the avenue!
  assert.ok(Math.abs(separation.x) > 0.05, `Trailing zombie must experience lateral fan-out push (got x: ${separation.x})`);
  assert.ok(Number.isFinite(separation.x) && Number.isFinite(separation.z), 'Separation must be finite');

  // Hard collision push test when within critical radius (< 0.98m)
  const zombieClose = {
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(0.2, 0, 9.6) }, // ~0.45m away from lead
    moveDir: new THREE.Vector3(0, 0, 1),
  };
  const toPlayerClose = new THREE.Vector3(playerPos.x - zombieClose.group.position.x, 0, playerPos.z - zombieClose.group.position.z);
  const closeRes = computeSwarmFlocking(zombieClose, [zombieLead, zombieClose], toPlayerClose, toPlayerClose.length());
  assert.ok(closeRes.separation.length() > 0.8, 'Critical radius must exert strong repulsive force');
});

test('Pack alignment synchronizes forward horde rush', () => {
  const zombieA = {
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(1, 0, 5) },
    moveDir: new THREE.Vector3(0.2, 0, 0.98).normalize(),
  };
  const zombieB = {
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(0, 0, 5) },
    moveDir: new THREE.Vector3(0, 0, 1),
  };

  const toPlayer = new THREE.Vector3(0, 0, 20);
  const { alignment } = computeSwarmFlocking(zombieB, [zombieA, zombieB], toPlayer, 20);
  assert.ok(alignment.length() > 0, 'Pack alignment should compute average neighbor velocity');
  assert.ok(alignment.z > 0.5, 'Alignment should reinforce forward momentum');
});

test('Runner & Lurker archetypes execute lateral perimeter flanking pincers', () => {
  const runnerLeft = {
    type: 'runner',
    flankSign: 1,
  };
  const runnerRight = {
    type: 'runner',
    flankSign: -1,
  };
  const walker = {
    type: 'walker',
    flankSign: 1,
  };

  // Approach vector along +Z (dist = 14m, prime flanking range)
  const toPlayer = new THREE.Vector3(0, 0, 14);

  const flankL = computeFlankingVector(runnerLeft, toPlayer, 14);
  const flankR = computeFlankingVector(runnerRight, toPlayer, 14);
  const flankWalker = computeFlankingVector(walker, toPlayer, 14);

  // Walker should not flank
  assert.strictEqual(flankWalker, null, 'Walkers must not flank (they charge direct)');

  // Runners must flank with opposing lateral vectors
  assert.ok(flankL !== null, 'Runner Left must produce flank vector');
  assert.ok(flankR !== null, 'Runner Right must produce flank vector');
  assert.ok(flankL.x < 0, `Runner Left flank vector should have negative X (got ${flankL.x})`);
  assert.ok(flankR.x > 0, `Runner Right flank vector should have positive X (got ${flankR.x})`);
  assert.ok(Math.abs(flankL.x + flankR.x) < 1e-4, 'Left and right flank vectors should be symmetric');

  // Verify flank angle deflection > 20 degrees
  const combinedL = toPlayer.clone().normalize().add(flankL).normalize();
  const angleDeg = Math.acos(combinedL.dot(toPlayer.clone().normalize())) * (180 / Math.PI);
  assert.ok(angleDeg > 20, `Runner approach angle must be deflected > 20 deg for flanking (got ${angleDeg.toFixed(1)} deg)`);
});

test('Horde encirclement ring distributes zombies around player perimeter', () => {
  const zombieA = { encirclementOffset: 0.8 };
  const zombieB = { encirclementOffset: -0.8 };
  const toPlayer = new THREE.Vector3(0, 0, 6); // 6m distance (inside 2m..12m window)

  const encA = computeEncirclementVector(zombieA, toPlayer, 6);
  const encB = computeEncirclementVector(zombieB, toPlayer, 6);

  assert.ok(encA !== null && encB !== null, 'Encirclement vectors must be generated');
  assert.ok(encA.x < 0 && encB.x > 0, 'Opposing encirclement offsets must steer to opposite sides');
});

test('Tactile whiskers detect obstacles and deflect steering before corner collision', () => {
  // A building corner at x: 2..10, z: 2..10
  const colliders = [
    { minX: 2, maxX: 10, minZ: 2, maxZ: 10, height: 4 }
  ];

  // Zombie is at (1.5, 0, 1.0) heading along (0.5, 0, 0.866) directly toward the corner
  const pos = new THREE.Vector3(1.5, 0, 1.0);
  const moveDir = new THREE.Vector3(0.5, 0, 0.866).normalize();

  const avoidance = probeWhiskerAvoidance(pos, moveDir, colliders, 1.4);
  assert.ok(avoidance !== null, 'Whiskers should detect corner collision within lookahead');
  assert.ok(avoidance.length() > 0.1, 'Avoidance vector should be non-trivial');
  assert.ok(avoidance.x < 0 || avoidance.z < 0, 'Avoidance must push away from corner collider');
});

test('computeHordeSteering synthesizes complete steering pipeline into unit vector', () => {
  const colliders = [{ minX: 10, maxX: 20, minZ: 10, maxZ: 20, height: 4 }];
  const zombie = {
    type: 'runner',
    radius: 0.4,
    flankSign: 1,
    encirclementOffset: 0.5,
    group: { position: new THREE.Vector3(0, 0, 0) },
    moveDir: new THREE.Vector3(0, 0, 1),
  };
  const otherZombie = {
    type: 'walker',
    radius: 0.4,
    alive: true,
    group: { position: new THREE.Vector3(0.2, 0, 1.2) },
    moveDir: new THREE.Vector3(0, 0, 1),
  };

  const playerPos = new THREE.Vector3(0, 0, 15);
  const result = computeHordeSteering({
    zombie,
    zombies: [zombie, otherZombie],
    playerPos,
    colliders,
    nav: null,
    dt: 0.016,
  });

  assert.ok(result.move, 'Result must contain move vector');
  assert.ok(Math.abs(result.move.length() - 1.0) < 1e-3, 'Steering move vector must be normalized');
  assert.ok(Number.isFinite(result.move.x) && Number.isFinite(result.move.z), 'Coordinates must be finite');
});

test('Zombie instance integrates computeHordeSteering during chase state', () => {
  const pos = new THREE.Vector3(0, 0, 10);
  const zombie = new Zombie('runner', pos);
  zombie.state = 'chase';

  assert.ok(zombie.flankSign === 1 || zombie.flankSign === -1, 'Zombie must initialize flankSign');
  assert.ok(Number.isFinite(zombie.encirclementOffset), 'Zombie must initialize encirclementOffset');
  assert.ok(zombie.moveDir instanceof THREE.Vector3, 'Zombie must have moveDir vector');

  const colliders = [];
  const playerPos = new THREE.Vector3(0, 0, 0);
  const ctx = {
    playerPos,
    colliders,
    zombies: [zombie],
    audio: null,
    nav: null,
  };

  zombie.update(0.016, ctx);
  assert.ok(zombie.moveDir.length() > 0, 'moveDir must be updated after step');
  assert.ok(Number.isFinite(zombie.group.position.x) && Number.isFinite(zombie.group.position.z), 'Position must remain finite');
});
