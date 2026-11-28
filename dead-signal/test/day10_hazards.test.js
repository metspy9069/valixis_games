import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  HAZARD_CONFIG,
  createAcidPuddle,
  updateAcidPuddle,
  createGasCloud,
  updateGasCloud,
  calculateBloaterBurstDamage,
  stepAcidProjectileCCD,
  evaluateChainReaction,
} from '../js/hazards.js';

test('Persistent Acid Puddle expands, corrodes armor first, then burns health, and slows player', () => {
  const pos = new THREE.Vector3(0, 0, 0);
  const puddle = createAcidPuddle(pos);

  assert.equal(puddle.duration, 6.0, 'Acid puddle must last 6.0 seconds');
  assert.equal(puddle.maxRadius, 2.2, 'Acid puddle max radius should be 2.2m');
  assert.ok(puddle.active, 'Acid puddle starts active');

  // Player with full armor standing inside puddle
  const player = {
    pos: new THREE.Vector3(0.5, 0.05, 0.5),
    armor: 50,
    maxArmor: 100,
    health: 100,
    maxHealth: 100,
    inAcidPuddle: false,
    hazardSpeedMul: 1.0,
  };

  const dt = 0.5;
  updateAcidPuddle(puddle, dt, player, [], {});

  assert.ok(player.inAcidPuddle, 'Player inside puddle radius must be flagged inAcidPuddle');
  assert.ok(player.hazardSpeedMul < 1.0, 'Acid puddle must slow player movement');
  assert.ok(player.armor < 50, `Armor must be corroded (got ${player.armor})`);
  assert.equal(player.health, 100, 'Health must be fully protected while armor is intact');

  // Strip armor and test health burn
  player.armor = 0;
  updateAcidPuddle(puddle, dt, player, [], {});
  assert.ok(player.health < 100, `Health must be damaged once armor is depleted (got ${player.health})`);

  // Fast forward past duration
  puddle.elapsed = 6.0;
  updateAcidPuddle(puddle, 0.1, player, [], {});
  assert.ok(!puddle.active, 'Acid puddle must deactivate after 6.0 seconds');
});

test('Toxic Gas Cloud expands, drains stamina, prevents sprint, slows player, and applies toxic DoT', () => {
  const pos = new THREE.Vector3(0, 1.1, 0);
  const cloud = createGasCloud(pos);

  assert.equal(cloud.duration, 5.0, 'Gas cloud must linger for 5.0 seconds');
  assert.equal(cloud.maxRadius, 4.8, 'Gas cloud max radius should expand to 4.8m');

  const player = {
    pos: new THREE.Vector3(1.0, 0, 1.0),
    stamina: 80,
    maxStamina: 100,
    health: 100,
    maxHealth: 100,
    sprinting: true,
    inToxicGas: false,
    hazardSpeedMul: 1.0,
  };

  let coughed = false;
  const ctx = {
    audio: {
      cough: () => { coughed = true; },
    },
  };

  const dt = 0.5;
  updateGasCloud(cloud, dt, player, ctx);

  assert.ok(player.inToxicGas, 'Player must be marked inToxicGas');
  assert.equal(player.sprinting, false, 'Toxic fumes must interrupt and suppress sprint');
  assert.ok(player.stamina < 80, `Stamina must be drained by toxic fumes (got ${player.stamina})`);
  assert.ok(player.hazardSpeedMul <= 0.65, `Movement must be slowed by ~35% (got speed multiplier ${player.hazardSpeedMul})`);
  assert.ok(player.health < 100, 'Toxic inhalation damage must apply DoT');
  assert.ok(coughed, 'Player must trigger coughing audio in toxic cloud');

  // Fast forward past duration
  cloud.elapsed = 5.0;
  updateGasCloud(cloud, 0.1, player, ctx);
  assert.ok(!cloud.active, 'Gas cloud must deactivate after 5.0 seconds');
});

test('Bloater Burst 3D Euclidean & vertical catwalk occlusion protects elevated sniper player', () => {
  // Ground-level bloater bursting on street at (0, 0.9, 0)
  const bloaterPos = new THREE.Vector3(0, 0.9, 0);

  // Catwalk structure / floor at z: 0.5..3.5, height: 3.5
  const colliders = [
    { minX: -5, maxX: 5, minZ: 0.5, maxZ: 3.5, height: 3.5, penetrable: false }
  ];

  // Case 1: Player on street (0, 1.0, -2.5) with direct line-of-sight (dist3D = 2.5m < 4.6m)
  const streetPlayerPos = new THREE.Vector3(0, 1.0, -2.5);
  const streetRes = calculateBloaterBurstDamage({
    bloaterPos,
    targetPos: streetPlayerPos,
    blastRadius: 4.6,
    peakDamage: 95,
    colliders,
  });
  assert.ok(streetRes.inRange, 'Street player within radius must be in range');
  assert.ok(!streetRes.occluded, 'Street player has clear line-of-sight');
  assert.ok(streetRes.damage > 20, `Street player must take blast damage (got ${streetRes.damage})`);

  // Case 2: Player standing on raised sniper catwalk at (0, 4.0, 2.5).
  // Catwalk floor/deck blocks direct 3D raycast from street below!
  const catwalkPlayerPos = new THREE.Vector3(0, 4.0, 2.5);
  const catwalkRes = calculateBloaterBurstDamage({
    bloaterPos,
    targetPos: catwalkPlayerPos,
    blastRadius: 4.6,
    peakDamage: 95,
    colliders,
  });
  assert.equal(catwalkRes.damage, 0, 'Catwalk player must take ZERO damage when occluded by platform floor');
  assert.ok(catwalkRes.occluded, 'Raycast must identify catwalk occlusion');

  // Case 3: Player high above on rooftop at (0, 7.5, 0.5) (dist3D = 6.6m > 4.6m blast radius)
  const rooftopPlayerPos = new THREE.Vector3(0, 7.5, 0.5);
  const rooftopRes = calculateBloaterBurstDamage({
    bloaterPos,
    targetPos: rooftopPlayerPos,
    blastRadius: 4.6,
    peakDamage: 95,
    colliders: [],
  });
  assert.equal(rooftopRes.damage, 0, 'Rooftop player outside 3D blast radius must take ZERO damage');
  assert.ok(!rooftopRes.inRange, 'Rooftop player must be out of range');
});

test('Spitter acid projectile swept CCD prevents tunneling through thin depot metal shutters', () => {
  // A thin closed depot metal shutter at z = 10.0 (thickness = 0.1m, width = 6.0m, height = 3.5m)
  const colliders = [
    { minX: -3.0, maxX: 3.0, minZ: 9.95, maxZ: 10.05, height: 3.5, penetrable: false }
  ];

  // Acid projectile is at z = 9.8 heading along +Z at 22 m/s.
  // In one frame dt = 0.02s, step = 0.44m, which would jump past z = 10.05 to z = 10.24 with discrete checks!
  const from = new THREE.Vector3(0, 1.5, 9.8);
  const vel = new THREE.Vector3(0, 0, 22);
  const dt = 0.02;

  const ccd = stepAcidProjectileCCD({
    from,
    vel,
    dt,
    gravity: 0,
    colliders,
  });

  assert.ok(ccd.hit, 'Swept CCD must detect collision with thin shutter');
  assert.equal(ccd.hitType, 'obstacle', 'Hit type must be obstacle');
  assert.ok(ccd.point.z <= 10.05, `Impact point must be on shutter surface (got z: ${ccd.point.z})`);
  assert.ok(ccd.nextPos.z < 10.06, 'Projectile must not tunnel through the shutter into the depot');
});

test('Chain reaction detonations propagate through adjacent explosive barrels and bloaters', () => {
  const origin = new THREE.Vector3(0, 0.5, 0);
  const barrels = [
    { id: 'b1', type: 'fuel', pos: new THREE.Vector3(2.0, 0.5, 0), hp: 20, active: true },
    { id: 'b2', type: 'biohazard', pos: new THREE.Vector3(3.2, 0.5, 1.0), hp: 25, active: true },
    { id: 'b3', type: 'fuel', pos: new THREE.Vector3(12.0, 0.5, 0), hp: 30, active: true }, // distant
  ];

  const zombies = [
    { alive: true, type: 'bloater', pos: new THREE.Vector3(1.8, 0.9, -1.0), hp: 35 },
    { alive: true, type: 'bloater', pos: new THREE.Vector3(15.0, 0.9, 0), hp: 100 }, // distant
  ];

  const result = evaluateChainReaction({
    origin,
    blastRadius: 4.8,
    blastDamage: 100,
    barrels,
    zombies,
    colliders: [],
  });

  // b1 and b2 are within blast radius and should be triggered
  assert.ok(result.triggeredBarrels.some((b) => b.id === 'b1'), 'Fuel barrel 1 must detonate');
  assert.ok(result.triggeredBarrels.some((b) => b.id === 'b2'), 'Biohazard barrel 2 must detonate');
  assert.ok(!result.triggeredBarrels.some((b) => b.id === 'b3'), 'Distant barrel 3 must NOT detonate');

  // Nearby bloater took lethal damage and should be triggered for secondary burst
  assert.ok(result.triggeredBloaters.length >= 1, 'Nearby bloater must be triggered for cascading rupture');
});
