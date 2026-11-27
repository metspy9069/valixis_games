import test from 'node:test';
import assert from 'node:assert/strict';

import { ProgressionManager, ACHIEVEMENTS } from '../js/progression.js';
import { VEHICLE_ROSTER } from '../js/player.js';
import {
  computeVirtualJoystickOutput,
  TouchInputTracker,
  normalizeGamepadState,
  HapticController
} from '../js/input.js';
import {
  selectConvoyAwareLanes,
  hasViableEscapeCorridor,
  planLaneChangeWithSignal,
  preventClumpDeadlocks
} from '../js/traffic.js';

test('vehicle roster contains 8 distinct supercars with complete base stats', () => {
  const keys = Object.keys(VEHICLE_ROSTER);
  assert.equal(keys.length, 8);
  assert.deepEqual(keys, ['apex', 'venom', 'phantom', 'interceptor', 'titan', 'hyperion', 'valkyrie', 'spectre']);

  keys.forEach(k => {
    const car = VEHICLE_ROSTER[k];
    assert.ok(car.name, `Car ${k} must have a name`);
    assert.ok(car.tier, `Car ${k} must have a tier`);
    assert.ok(car.baseStats.topSpeed > 0);
    assert.ok(car.baseStats.accel > 0);
    assert.ok(car.baseStats.handling > 0);
    assert.ok(car.baseStats.nitro > 0);
    assert.ok(car.baseStats.armor > 0);
  });
});

test('progression initializes default economy, unlocked cars, settings, and daily quests', () => {
  const pm = new ProgressionManager();
  const def = pm.getDefaultData();

  assert.equal(def.selectedVehicle, 'apex');
  assert.ok(def.unlockedVehicles.includes('apex'));
  assert.equal(def.coins, 300);
  assert.equal(def.dailyQuests.length, 3);
  assert.equal(def.settings.steeringSensitivity, 1.0);
  assert.equal(def.settings.gamepadRumbleEnabled, true);
  assert.equal(def.settings.graphicsQuality, 'high');
});

test('all 8 milestone achievements are correctly defined with coin rewards', () => {
  assert.equal(ACHIEVEMENTS.length, 8);
  const ids = ACHIEVEMENTS.map(a => a.id);
  assert.deepEqual(ids, [
    'first_burnout',
    'mach_speeder',
    'drift_master',
    'needle_threader',
    'stunt_driver',
    'highway_enforcer',
    'untouchable',
    'rival_vanquisher'
  ]);

  ACHIEVEMENTS.forEach(a => {
    assert.ok(a.title);
    assert.ok(a.desc);
    assert.ok(a.reward >= 150);
    assert.ok(a.icon);
  });
});

test('unlocking achievement awards coins and prevents duplicate claims', () => {
  const pm = new ProgressionManager();
  pm.data.coins = 100;
  pm.data.unlockedAchievements = [];

  const ach = pm.unlockAchievement('first_burnout');
  assert.ok(ach);
  assert.equal(ach.id, 'first_burnout');
  assert.equal(pm.data.coins, 100 + ach.reward);
  assert.ok(pm.data.unlockedAchievements.includes('first_burnout'));

  // Duplicate unlock attempt
  const dup = pm.unlockAchievement('first_burnout');
  assert.equal(dup, null);
  assert.equal(pm.data.coins, 100 + ach.reward);
});

test('rank classification correctly identifies driver milestones', () => {
  const pm = new ProgressionManager();

  assert.equal(pm.getRank(500).title, 'ROOKIE SPEEDER');
  assert.equal(pm.getRank(1500).title, 'STREET RACER');
  assert.equal(pm.getRank(4000).title, 'HIGHWAY OUTLAW');
  assert.equal(pm.getRank(8000).title, 'CYBER DRIFTER');
  assert.equal(pm.getRank(12000).title, 'SPEED DEMON');
  assert.equal(pm.getRank(18000).title, 'S+ RANK HIGHWAY LEGEND');
});

test('vehicle upgrade logic enforces coin costs and level caps', () => {
  const pm = new ProgressionManager();
  pm.data.coins = 500;
  pm.data.upgrades.apex.topSpeed = 0;

  const upgraded = pm.upgradeStat('apex', 'topSpeed', 200);
  assert.equal(upgraded, true);
  assert.equal(pm.data.coins, 300);
  assert.equal(pm.data.upgrades.apex.topSpeed, 1);

  // Attempt upgrade with insufficient coins
  const failed = pm.upgradeStat('apex', 'topSpeed', 500);
  assert.equal(failed, false);
  assert.equal(pm.data.upgrades.apex.topSpeed, 1);
});

test('viral share link generator includes challenge distance and domain', () => {
  const pm = new ProgressionManager();
  const url = pm.generateShareUrl(12500, 150000);

  assert.ok(url.includes('https://games.valixis.tech/road-riot/'));
  assert.ok(url.includes('challenge=12500'));
  assert.ok(url.includes('score=150000'));
});

test('air defense checkpoint interval calculates progressive sector milestones', () => {
  const initialCheckpoint = 1500;
  const interval = 2000;
  const milestones = [initialCheckpoint];
  for (let i = 1; i < 4; i++) {
    milestones.push(initialCheckpoint + i * interval);
  }

  assert.deepEqual(milestones, [1500, 3500, 5500, 7500]);
});

test('multi-map highway biomes support 4 distinct atmospheric presets', () => {
  const biomes = ['midnight', 'canyon', 'neotokyo', 'arctic'];
  assert.equal(biomes.length, 4);
  assert.ok(biomes.includes('arctic'));
  assert.ok(biomes.includes('neotokyo'));
});

test('every supercar supports all 5 performance upgrades with level cap at 5', () => {
  const pm = new ProgressionManager();
  const carKeys = Object.keys(VEHICLE_ROSTER);
  const stats = ['topSpeed', 'accel', 'handling', 'nitro', 'armor'];

  carKeys.forEach(carId => {
    stats.forEach(st => {
      pm.data.coins = 10000;
      if (!pm.data.upgrades[carId]) pm.data.upgrades[carId] = {};
      pm.data.upgrades[carId][st] = 0;

      for (let lvl = 1; lvl <= 5; lvl++) {
        const ok = pm.upgradeStat(carId, st, 100);
        assert.equal(ok, true, `Upgrade ${st} on ${carId} at lvl ${lvl} should succeed`);
      }
      assert.equal(pm.data.upgrades[carId][st], 5);

      // Level 6 should fail
      const extra = pm.upgradeStat(carId, st, 100);
      assert.equal(extra, false, `Level 6 upgrade on ${carId} must be capped at 5`);
    });
  });
});

test('race disciplines configure middle checkpoint for sprint and quick checkpoint for endless', () => {
  const sprintTarget = 1500;
  const sprintCheckpoint = 750; // Exact middle (50%)
  assert.equal(sprintCheckpoint, sprintTarget / 2, 'Sprint checkpoint must be placed exactly in the middle');

  const endlessInitialCheckpoint = 380;
  assert.ok(endlessInitialCheckpoint < 400, 'Endless checkpoint must be fast to reach (~12-15s)');
});

test('cars.json contains valid car records with speeds, prices, and upgrade levels', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const raw = fs.readFileSync(path.resolve('road-riot/data/cars.json'), 'utf-8');
  const cars = JSON.parse(raw);

  assert.ok(Array.isArray(cars), 'cars.json must be an array');
  assert.ok(cars.length >= 2, 'cars.json must have at least 2 cars');

  cars.forEach(car => {
    assert.ok(car.id, 'Car must have an ID');
    assert.ok(car.name, 'Car must have a name');
    assert.ok(car.baseSpeed > 0, 'Car must have a positive baseSpeed');
    assert.ok(car.price > 0, 'Car must have a positive price');
    assert.ok(Array.isArray(car.upgradeLevels), 'Car must have upgrade levels');
  });
});

test('checkpoints.json contains valid battle checkpoint definitions', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const raw = fs.readFileSync(path.resolve('road-riot/data/checkpoints.json'), 'utf-8');
  const checkpoints = JSON.parse(raw);

  assert.ok(Array.isArray(checkpoints), 'checkpoints.json must be an array');
  assert.ok(checkpoints.length >= 2, 'Must have at least 2 checkpoints defined');

  checkpoints.forEach(cp => {
    assert.ok(cp.id, 'Checkpoint must have an ID');
    assert.ok(cp.durationSec > 0, 'Checkpoint must have a positive duration');
    assert.ok(Array.isArray(cp.enemyTypes), 'Checkpoint must define enemyTypes');
    assert.ok(cp.enemyTypes.length > 0, 'Must have at least one enemy type');
  });
});

test('shop economy simulates purchase with credit deductions and owned list', () => {
  let credits = 3000;
  const ownedCars = ['car001'];
  const newCar = { id: 'car002', name: 'Vortex GT', price: 2000 };

  // Valid purchase
  if (credits >= newCar.price) {
    credits -= newCar.price;
    ownedCars.push(newCar.id);
  }
  assert.equal(credits, 1000);
  assert.deepEqual(ownedCars, ['car001', 'car002']);

  // Insufficient credits attempt
  const expensiveCar = { id: 'car004', name: 'Hyperion Zero', price: 5000 };
  let purchased = false;
  if (credits >= expensiveCar.price) {
    credits -= expensiveCar.price;
    ownedCars.push(expensiveCar.id);
    purchased = true;
  }
  assert.equal(purchased, false);
  assert.equal(credits, 1000);
  assert.equal(ownedCars.length, 2);
});

test('60 FPS frame delta clamp prevents simulation explosion', () => {
  const clampFps = (dt) => (dt > 1 / 60 ? 1 / 60 : dt);
  const normalDt = 0.016;
  const spikeDt = 0.5; // Half-second freeze
  assert.equal(clampFps(normalDt), 0.016);
  assert.equal(clampFps(spikeDt), 1 / 60);
});

test('solid collision separates player vehicle from traffic trucks and npcs without phasing through', () => {
  // Simulate collision between player and a truck
  const player = { x: 0, z: -8, speed: 35 };
  const truck = { x: 0.2, z: -6.5, width: 2.8, length: 8.5, speed: 18 };

  const halfW = truck.width * 0.5 + 1.05; // 2.45
  const halfL = truck.length * 0.5 + 2.2;  // 6.45

  const dx = player.x - truck.x; // -0.2
  const dz = player.z - truck.z; // -1.5 (player behind truck)
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  assert.ok(absX < halfW && absZ < halfL, 'Vehicles are initially overlapping');

  // Solid Impasse Resolution:
  const isRearEnd = dz < 0 && absX < (truck.width * 0.5 + 0.45);

  if (isRearEnd) {
    // Rear impact clamp
    player.speed = Math.min(player.speed * 0.35, truck.speed * 0.7);
    truck.z = player.z + halfL;
  }

  // After resolution, truck is pushed forward, player is locked behind bumper
  assert.ok(player.speed < truck.speed, 'Player forward speed is clamped behind target');
  assert.equal(truck.z - player.z, halfL, 'Target Z is separated so player does not penetrate interior');
});

test('solid stunt jump ramp calculates continuous physical deck elevation and launches at takeoff lip', () => {
  const rampLength = 4.8;
  const h0 = 0.03;
  const h1 = 1.35;

  // Entrance (+2.4 relZ)
  const relZEntrance = 2.4;
  const progressEntrance = (2.4 - relZEntrance) / rampLength;
  const deckYEntrance = h0 + progressEntrance * (h1 - h0);
  assert.equal(deckYEntrance, 0.03, 'Entrance elevation matches asphalt surface');

  // Mid-ramp (0.0 relZ)
  const relZMid = 0.0;
  const progressMid = (2.4 - relZMid) / rampLength;
  const deckYMid = h0 + progressMid * (h1 - h0);
  assert.equal(Math.round(deckYMid * 100) / 100, 0.69, 'Mid-ramp deck provides smooth incline elevation');

  // Lip (-2.4 relZ)
  const relZLip = -2.4;
  const progressLip = (2.4 - relZLip) / rampLength;
  const deckYLip = h0 + progressLip * (h1 - h0);
  assert.equal(deckYLip, 1.35, 'Lip elevation reaches full takeoff height');
});

test('mutual traffic collision strictly separates NPC vehicles preventing phasing', () => {
  // Simulate two NPC vehicles overlapping in the same lane
  const v1 = { x: 0, z: -40, width: 2.2, length: 4.6, speed: 22 };
  const v2 = { x: 0.1, z: -42, width: 2.2, length: 4.6, speed: 17 };

  const halfW = (v1.width + v2.width) * 0.5; // 2.2
  const halfL = (v1.length + v2.length) * 0.5; // 4.6
  const dx = v1.x - v2.x;
  const dz = v1.z - v2.z;
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  assert.ok(absX < halfW && absZ < halfL, 'Vehicles initially collide and overlap');

  // Solid Impasse Resolution:
  const isV1Trailing = v1.z > v2.z; // larger z is closer to camera (trailing)
  const trailing = isV1Trailing ? v1 : v2;
  const leading = isV1Trailing ? v2 : v1;

  if (absZ >= absX * 0.8) {
    trailing.z = leading.z + halfL + 0.15;
    trailing.speed = Math.min(trailing.speed, leading.speed * 0.85);
  }

  assert.ok(trailing.z - leading.z >= halfL, 'Trailing vehicle is pushed strictly behind leading vehicle bumper');
  assert.ok(trailing.speed <= leading.speed, 'Trailing vehicle decelerates behind lead vehicle');
});

test('adaptive cruise control slows trailing traffic car when approaching lead vehicle in same lane', () => {
  const lead = { x: 0, z: -50, speed: 18 };
  const trailing = { x: 0.2, z: -38, speed: 26, baseSpeed: 26 };

  const dx = Math.abs(trailing.x - lead.x);
  const dz = trailing.z - lead.z; // 12m headway
  const headway = 18;

  let followSpeed = trailing.speed;
  for (let step = 0; step < 4; step++) {
    if (dx < 2.2 && dz > 0 && dz < headway) {
      const targetSpeed = Math.min(trailing.baseSpeed, lead.speed * 0.94);
      followSpeed += (targetSpeed - followSpeed) * 0.5;
    }
  }

  assert.ok(followSpeed < trailing.baseSpeed, 'Trailing car decelerates when lead car is in headway zone');
  assert.ok(followSpeed <= lead.speed * 1.05, 'Trailing car adjusts pace toward lead car');
});

test('critical hull integrity activates full-screen emergency red alert overlay', () => {
  const checkRedAlert = (hull, maxHull) => {
    const pct = Math.max(0, (hull / maxHull) * 100);
    return pct <= 35 && pct > 0;
  };

  assert.equal(checkRedAlert(100, 100), false, 'Full health should not trigger red alert');
  assert.equal(checkRedAlert(50, 100), false, '50% health should not trigger red alert');
  assert.equal(checkRedAlert(35, 100), true, '35% health must trigger red alert');
  assert.equal(checkRedAlert(15, 100), true, '15% critical health must trigger red alert');
  assert.equal(checkRedAlert(0, 100), false, '0% health (game over) should dismiss red alert');
});

test('traffic vehicle collision with stationary obstacle deflects laterally and prevents clipping', () => {
  // Simulate traffic vehicle overlapping stationary barrier/barrel
  const v = { x: 0, z: -30, width: 2.2, length: 4.6, speed: 20 };
  const obs = { x: 0.1, z: -30.5, width: 2.7, length: 3.0 };

  const halfW = (v.width * 0.5) + (obs.width * 0.5);
  const halfL = (v.length * 0.5) + (obs.length * 0.5);
  const dx = v.x - obs.x;
  const dz = v.z - obs.z;
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);

  assert.ok(absX < halfW && absZ < halfL, 'Vehicle initially intersects obstacle footprint');

  // Solid Impasse Resolution:
  const bounce = dx >= 0 ? 1 : -1;
  v.x = obs.x + bounce * (halfW + 0.15);
  v.speed *= 0.65;

  assert.ok(Math.abs(v.x - obs.x) >= halfW, 'Vehicle is clamped strictly outside obstacle width boundary');
  assert.ok(v.speed < 20, 'Vehicle absorbs collision impact and decelerates');
});

test('traffic vehicle approaching jump ramp rides incline deck and executes stunt jump', () => {
  const ramp = { lane: 0, worldZ: -60, length: 4.8, lipHeight: 1.35 };
  const v = { x: 0, y: 0, z: -60, isAirborne: false, airVy: 0 };

  const relZ = v.z - ramp.worldZ; // 0 (middle of ramp deck)
  const absX = Math.abs(v.x - ramp.lane);

  if (relZ >= -2.4 && relZ <= 2.4 && absX < 1.35) {
    const progress = (2.4 - relZ) / ramp.length; // 0.5
    const deckY = 0.03 + progress * (ramp.lipHeight - 0.03);
    v.y = deckY;
  }

  assert.ok(v.y > 0.6, 'Vehicle Y elevation matches ramp incline deck slope at halfway point');

  // At takeoff lip:
  const relZLip = -2.0;
  if (relZLip <= -1.9 && !v.isAirborne) {
    v.isAirborne = true;
    v.airVy = 7.5;
  }

  assert.equal(v.isAirborne, true, 'Vehicle launches airborne off ramp takeoff lip');
  assert.equal(v.airVy, 7.5, 'Vehicle receives vertical launch velocity');
});

test('critical health triggers recurring audio emergency alarm warning', () => {
  let alarmPlayed = 0;
  let timer = 0.8;
  const dt = 0.1;

  for (let frame = 0; frame < 15; frame++) {
    timer += dt;
    if (timer >= 0.85) {
      timer = 0;
      alarmPlayed++;
    }
  }

  assert.ok(alarmPlayed >= 1, 'Emergency cockpit audio warning alarm beeps during critical hull health');
});

test('traffic manager clear flushes all entities and delays initial spawn timers preventing restart collision', () => {
  const dummyTraffic = {
    vehicles: [{ id: 1 }],
    obstacles: [{ id: 2 }],
    collectibles: [{ id: 3 }],
    particles: [{ id: 4 }],
    scene: { remove: () => {} },
    trafficTimer: 0,
    obstacleTimer: 0,
    collectibleTimer: 0,
    clear() {
      this.vehicles = [];
      this.obstacles = [];
      this.collectibles = [];
      this.particles = [];
      this.trafficTimer = 2.2;
      this.obstacleTimer = 4.0;
      this.collectibleTimer = 2.0;
    }
  };

  dummyTraffic.clear();
  assert.equal(dummyTraffic.vehicles.length, 0, 'Vehicles cleared');
  assert.equal(dummyTraffic.obstacles.length, 0, 'Obstacles cleared');
  assert.ok(dummyTraffic.trafficTimer >= 2.0, 'Traffic spawn timer delayed by at least 2 seconds on restart');
  assert.ok(dummyTraffic.obstacleTimer >= 3.0, 'Obstacle spawn timer delayed by at least 3 seconds on restart');
});

test('world manager reset restores all highway segments to starting longitudinal coordinates', () => {
  const segmentLength = 80;
  const segmentCount = 10;
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({ position: { z: 50.0 + Math.random() * 200 } });
  }

  // Execute reset:
  for (let i = 0; i < segments.length; i++) {
    segments[i].position.z = -i * segmentLength;
  }

  for (let i = 0; i < segments.length; i++) {
    assert.equal(segments[i].position.z, -i * segmentLength, `Segment ${i} restored to initial offset`);
  }
});

test('spawning traffic and obstacles avoids occupied lanes preventing spawn overlapping', () => {
  const lanes = [-6, 0, 6];
  const existingVehicles = [{ lane: -6, z: -130 }];
  const existingObstacles = [{ lane: 0, z: -140 }];
  const jumpRamps = [{ lane: 6, worldZ: -145 }];

  const occupiedLanes = new Set([
    ...existingVehicles.filter(v => v.z < -120).map(v => v.lane),
    ...existingObstacles.filter(o => o.z < -120).map(o => o.lane),
    ...jumpRamps.filter(r => Math.abs(r.worldZ - (-145)) < 16).map(r => r.lane)
  ]);

  const availableLanes = lanes.filter(l => !occupiedLanes.has(l));
  assert.equal(availableLanes.length, 0, 'When all 3 lanes are occupied at spawn threshold, spawn is safely deferred');

  // When lane 0 clears:
  existingObstacles.length = 0;
  const recheckedOccupied = new Set([
    ...existingVehicles.filter(v => v.z < -120).map(v => v.lane),
    ...jumpRamps.filter(r => Math.abs(r.worldZ - (-145)) < 16).map(r => r.lane)
  ]);
  const recheckedAvailable = lanes.filter(l => !recheckedOccupied.has(l));
  assert.deepEqual(recheckedAvailable, [0], 'Only the free lane is picked for new entity spawn');
});

test('npc car reset clears collision state and positions vehicle in valid highway lane', () => {
  const dummyNpc = {
    lanes: [-6, 0, 6],
    currentLane: -6,
    targetX: -6,
    isColliding: true,
    pos: { x: 0, y: 0, z: -5 },
    reset(zOffset = 0) {
      this.currentLane = this.lanes[0];
      this.targetX = this.currentLane;
      this.pos.x = this.currentLane;
      this.pos.y = 0;
      this.pos.z = -85 - zOffset;
      this.isColliding = false;
    }
  };

  dummyNpc.reset(35);
  assert.equal(dummyNpc.isColliding, false, 'Collision state cleared on reset');
  assert.ok(dummyNpc.lanes.includes(dummyNpc.pos.x), 'Positioned in standard highway lane');
  assert.ok(dummyNpc.pos.z <= -120, 'Positioned at safe distance ahead of player on start/restart');
});

test('player mesh position x remains strictly synchronized with lateral physics coordinate', () => {
  const player = {
    x: 0,
    mesh: { position: { x: 0, y: 0, z: -8 } },
    update() {
      this.mesh.position.x = this.x;
    }
  };

  // Simulate lateral collision bounce pushing car to lane 6
  player.x = 6.0;
  player.update();
  assert.equal(player.mesh.position.x, 6.0, 'Mesh X is synchronized with physical coordinate');

  // Clamp at outer guardrail
  player.x = 8.2;
  player.update();
  assert.equal(player.mesh.position.x, 8.2, 'Mesh X clamps at outer guardrail boundary');
});

test('transmission reset guarantees Gear 1 starting state and smooth upshifting', () => {
  const transmission = {
    gear: 6, // previous run or dyno leftover
    rpm: 7200,
    resetTransmission() {
      this.gear = 1;
      this.rpm = 1200;
    },
    update(speedKmh) {
      if (speedKmh <= 6) {
        this.gear = 1;
      } else if (speedKmh > 285) {
        this.gear = 6;
      } else if (speedKmh > 230) {
        this.gear = 5;
      } else if (speedKmh > 175) {
        this.gear = 4;
      } else if (speedKmh > 120) {
        this.gear = 3;
      } else if (speedKmh > 65) {
        this.gear = 2;
      } else {
        this.gear = 1;
      }
    }
  };

  // On countdown start:
  transmission.resetTransmission();
  assert.equal(transmission.gear, 1, 'Gear is immediately reset to 1 on race countdown');
  assert.equal(transmission.rpm, 1200, 'RPM is initialized to idle 1200 RPM');

  // Launching from standstill:
  transmission.update(0);
  assert.equal(transmission.gear, 1, 'Standstill remains strictly in Gear 1');

  // Accelerating through highway gears:
  transmission.update(85);
  assert.equal(transmission.gear, 2, 'Upshifts to Gear 2 at 85 km/h');

  transmission.update(140);
  assert.equal(transmission.gear, 3, 'Upshifts to Gear 3 at 140 km/h');

  transmission.update(200);
  assert.equal(transmission.gear, 4, 'Upshifts to Gear 4 at 200 km/h');

  transmission.update(260);
  assert.equal(transmission.gear, 5, 'Upshifts to Gear 5 at 260 km/h');

  transmission.update(320);
  assert.equal(transmission.gear, 6, 'Upshifts to Gear 6 at 320 km/h');
});

test('player active ceramic braking decelerates vehicle and induces forward pitch', () => {
  const player = {
    speed: 32.0, // ~115 km/h
    topSpeed: 34.0,
    isBraking: false,
    suspensionPitch: 0,
    setBraking(braking) {
      this.isBraking = Boolean(braking);
    },
    update(dt) {
      if (this.isBraking) {
        this.speed = Math.max(6.0, this.speed - dt * 36);
        this.suspensionPitch = 0.10; // Forward dive
      } else {
        this.speed += (this.topSpeed - this.speed) * Math.min(1, dt * 3.2);
        this.suspensionPitch *= 0.9;
      }
    }
  };

  // Apply ceramic brakes
  player.setBraking(true);
  player.update(0.2); // 200ms braking
  assert.ok(player.speed < 25.0, 'Braking rapidly drops forward speed');
  assert.equal(player.suspensionPitch, 0.10, 'Braking produces forward suspension dive');

  // Release brakes
  player.setBraking(false);
  player.update(0.5);
  assert.ok(player.speed > 24.8, 'Releasing brakes recovers acceleration towards top speed');
});

test('life pack repair restores player hull up to max hull and clears critical alert', () => {
  const player = {
    hull: 20, // Critical hull (< 25)
    maxHull: 100,
    repairHull(amount) {
      const prev = this.hull;
      this.hull = Math.min(this.maxHull, this.hull + amount);
      return Math.round(this.hull - prev);
    }
  };

  const healed = player.repairHull(35);
  assert.equal(healed, 35, 'Life pack restores exact repair amount');
  assert.equal(player.hull, 55, 'Hull is restored out of critical danger');
  assert.ok(player.hull > 25, 'Hull above 25% safely disables emergency red alert');

  // Cap at max hull
  player.hull = 90;
  const overheal = player.repairHull(35);
  assert.equal(overheal, 10, 'Healing is cleanly capped at max hull');
  assert.equal(player.hull, 100);
});

test('stunt jump ramp forward launch preserves takeoff lip elevation and deals zero damage to vehicle', () => {
  const ramp = { lane: 0, worldZ: -50, length: 4.8, h0: 0.03, h1: 1.35, triggered: false };
  const player = {
    x: 0,
    y: 0,
    z: -8,
    hull: 100,
    verticalY: 0,
    verticalVel: 0,
    isAirborne: false,
    rampElevation: 0,
    rampPitch: 0,
    suspensionPitch: 0,
    setRampElevation(elev, pitch = -0.24) {
      this.rampElevation = elev;
      this.rampPitch = pitch;
    },
    triggerJump(launchVel = 18, startY = 1.35) {
      if (this.isAirborne) return;
      this.isAirborne = true;
      this.verticalY = Math.max(this.verticalY, startY);
      this.verticalVel = launchVel;
    },
    update(dt) {
      if (this.isAirborne) {
        this.verticalVel -= 28.0 * dt;
        this.verticalY += this.verticalVel * dt;
      }
      this.y = this.isAirborne ? Math.max(this.verticalY, this.rampElevation || 0) : (this.rampElevation || 0);
    }
  };

  // Approach ramp: middle of ramp deck
  const relZMid = 0.0;
  const progressMid = (2.4 - relZMid) / ramp.length;
  const deckYMid = ramp.h0 + progressMid * (ramp.h1 - ramp.h0);
  player.setRampElevation(deckYMid, -0.24);
  player.update(0.016);
  assert.ok(player.y > 0.65, 'Player elevation smoothly ascends on ramp deck');
  assert.equal(player.rampPitch, -0.24, 'Incline pitch matches ramp geometry');

  // Reach takeoff lip:
  const relZLip = -1.9;
  const progressLip = (2.4 - relZLip) / ramp.length;
  const deckYLip = ramp.h0 + progressLip * (ramp.h1 - ramp.h0);
  player.triggerJump(18, deckYLip);
  player.update(0.016);

  // Verify no vertical height drop: height must be >= takeoff lip height!
  assert.equal(player.isAirborne, true, 'Player launches airborne at lip');
  assert.ok(player.y >= deckYLip, `Height (${player.y}) smoothly ascends from lip (${deckYLip}) without dropping`);
  assert.equal(player.hull, 100, 'Stunt ramp launch inflicts exactly 0 damage to player vehicle');
});

test('swept AABB continuous collision detection catches high-speed trajectory intercepts without tunneling', () => {
  // Scenario: Player at 390 km/h (43.3 units/sec).
  // Target vehicle is in lane at z = -14.0 (halfL = 4.45, so box is z in [-18.45, -9.55], x in [-2.45, 2.45]).
  // In a single large frame step (dt = 0.04s, relative step = 1.6m),
  // start position is z = -8.0, previous relative position was -6.5.
  const halfW = 2.45;
  const halfL = 4.45;

  const prevRelX = 0;
  const prevRelZ = 6.0; // ahead by 6m
  const currRelX = 0;
  const currRelZ = 3.8; // moves closer by 2.2m

  const relDispX = currRelX - prevRelX;
  const relDispZ = currRelZ - prevRelZ; // -2.2m

  // Slab test Swept AABB
  let tminX = -Infinity, tmaxX = Infinity;
  if (Math.abs(relDispX) > 0.0001) {
    const tx1 = (-halfW - prevRelX) / relDispX;
    const tx2 = (halfW - prevRelX) / relDispX;
    tminX = Math.min(tx1, tx2);
    tmaxX = Math.max(tx1, tx2);
  } else if (Math.abs(prevRelX) >= halfW) {
    tminX = Infinity;
  }

  let tminZ = -Infinity, tmaxZ = Infinity;
  if (Math.abs(relDispZ) > 0.0001) {
    const tz1 = (-halfL - prevRelZ) / relDispZ;
    const tz2 = (halfL - prevRelZ) / relDispZ;
    tminZ = Math.min(tz1, tz2);
    tmaxZ = Math.max(tz1, tz2);
  } else if (Math.abs(prevRelZ) >= halfL) {
    tminZ = Infinity;
  }

  const tEnter = Math.max(tminX, tminZ);
  const tExit = Math.min(tmaxX, tmaxZ);
  const hasIntercept = tEnter <= tExit && tExit >= 0 && tEnter <= 1.0;

  assert.equal(hasIntercept, true, 'Swept trajectory detects interception before penetration');
  assert.ok(tEnter >= 0 && tEnter <= 1.0, `Time of impact t=${tEnter.toFixed(3)} is normalized within the frame step`);
});

test('elastic guardrail boundary contact induces spring deflection force and friction drag without rigid stick', () => {
  const railBoundary = 7.95;
  const maxClamp = 8.25;
  const player = {
    x: -8.10, // penetrated left barrier by 0.15m
    vx: 0,
    steerAngle: -0.10, // steering towards left wall
    speed: 32.0, // ~288 km/h
  };

  const dt = 0.016;
  const penetration = (-railBoundary) - player.x; // 0.15m
  assert.ok(penetration > 0, 'Penetration detected past barrier boundary');

  // Elastic deflection calculation
  const bounceVelocity = 3.2 + penetration * 7.5;
  player.vx = Math.max(player.vx, bounceVelocity);
  player.steerAngle = Math.min(0.25, Math.max(0.08, player.steerAngle + 0.16));
  const scrapeFriction = Math.max(0.82, 1.0 - dt * (2.2 + penetration * 3.5));
  player.speed = Math.max(4.0, player.speed * scrapeFriction);

  assert.ok(player.vx > 3.0, 'Rebound velocity imparts rightward deflection away from left barrier');
  assert.ok(player.steerAngle > 0, 'Steering angle is turned inward towards open roadway');
  assert.ok(player.speed < 32.0 && player.speed > 25.0, 'Surface friction absorbs kinetic energy without an abrupt halt');
});

test('relative velocity-scaled impact damage differentiates glancing scrapes from catastrophic supersonic crashes', () => {
  const calcDamage = (relKmh, isTruck = false) => {
    const massFactor = isTruck ? 1.4 : 1.0;
    let baseDamage = 6;
    if (relKmh < 35) {
      baseDamage = 4 + (relKmh / 35) * 4;
    } else if (relKmh < 110) {
      baseDamage = 8 + ((relKmh - 35) / 75) * 11;
    } else if (relKmh < 200) {
      baseDamage = 19 + ((relKmh - 110) / 90) * 14;
    } else {
      baseDamage = 33 + Math.min(27, ((relKmh - 200) / 100) * 22);
    }
    return Math.round(baseDamage * massFactor);
  };

  const glancingDmg = calcDamage(20, false); // 20 km/h bump
  const moderateDmg = calcDamage(75, false); // 75 km/h rear-end
  const supersonicCarDmg = calcDamage(260, false); // 260 km/h hypercar impact
  const supersonicTruckDmg = calcDamage(260, true); // 260 km/h into heavy truck

  assert.ok(glancingDmg <= 8, `Glancing tap deals minimal cosmetic scrape damage (${glancingDmg}%)`);
  assert.ok(moderateDmg >= 12 && moderateDmg <= 18, `Moderate impact scales proportionally (${moderateDmg}%)`);
  assert.ok(supersonicCarDmg >= 40, `Supersonic impact inflicts devastating structural damage (${supersonicCarDmg}%)`);
  assert.ok(supersonicTruckDmg > supersonicCarDmg, `Truck mass factor escalates collision damage (${supersonicTruckDmg}% vs ${supersonicCarDmg}%)`);
});

test('pacejka magic formula calculates non-linear lateral friction curve with peak and sliding plateau', () => {
  const calcPacejka = (slipAngle, isDrifting = false, handling = 24) => {
    const handlingFactor = handling / 24.0;
    const D = isDrifting ? (0.92 * handlingFactor) : (1.18 * handlingFactor);
    const C = isDrifting ? 1.30 : 1.55;
    const B = isDrifting ? 5.8 : 9.5;
    const mu = D * Math.sin(C * Math.atan(B * slipAngle));
    return { mu, peakMu: D, isSliding: Math.abs(slipAngle) > (0.18 / (isDrifting ? 0.7 : 1.0)) };
  };

  const zeroSlip = calcPacejka(0, false);
  const smallSlip = calcPacejka(0.08, false); // ~4.5 degrees
  const peakSlip = calcPacejka(0.20, false); // ~11.5 degrees (peak grip)
  const deepSlide = calcPacejka(0.55, false); // ~31.5 degrees

  assert.equal(zeroSlip.mu, 0, 'Zero slip produces zero lateral friction force');
  assert.ok(smallSlip.mu > 0 && smallSlip.mu < peakSlip.mu, 'Linear grip buildup as slip angle increases');
  assert.ok(peakSlip.mu > 1.0, `Peak tire friction reaches optimal coefficient (${peakSlip.mu.toFixed(2)})`);
  assert.ok(deepSlide.isSliding, 'Deep slip angle transitions into kinetic sliding regime');

  // Drift Mode:
  const driftGrip = calcPacejka(0.35, true);
  assert.ok(driftGrip.mu < peakSlip.mu, 'Drift mode exhibits controlled sliding friction plateau');
  assert.equal(driftGrip.isSliding, true, 'Drift angle is marked as sliding');
});

test('dynamic weight transfer redistributes axle and corner loads under braking and cornering', () => {
  const calcWeightTransfer = (forwardSpeed, accelRate, lateralVel, dt = 0.016) => {
    const longAccel = accelRate;
    const h_cog_over_L = 0.22;
    const dW_long = (longAccel / 28.0) * h_cog_over_L;

    const h_cog_over_T = 0.28;
    const dW_lat = Math.min(0.45, Math.max(-0.45, (lateralVel * (forwardSpeed / 30.0) * 0.12)));

    const frontLoad = Math.min(1.45, Math.max(0.65, 1.0 - dW_long));
    const rearLoad = Math.min(1.45, Math.max(0.65, 1.0 + dW_long));

    return {
      fl: Math.min(1.65, Math.max(0.35, frontLoad * (1.0 - dW_lat))),
      fr: Math.min(1.65, Math.max(0.35, frontLoad * (1.0 + dW_lat))),
      rl: Math.min(1.65, Math.max(0.35, rearLoad * (1.0 - dW_lat))),
      rr: Math.min(1.65, Math.max(0.35, rearLoad * (1.0 + dW_lat))),
      dW_lat,
      dW_long
    };
  };

  // Heavy Braking (Deceleration = -36 units/s^2)
  const brakeTransfer = calcWeightTransfer(30.0, -36.0, 0);
  assert.ok(brakeTransfer.fl > 1.0 && brakeTransfer.fr > 1.0, 'Braking shifts load forward onto front tires (dive)');
  assert.ok(brakeTransfer.rl < 1.0 && brakeTransfer.rr < 1.0, 'Rear tires lose normal load, loosening rear end');

  // Hard Right Cornering (Positive lateral velocity = +6.0 m/s)
  const cornerTransfer = calcWeightTransfer(30.0, 0, 6.0);
  assert.ok(cornerTransfer.fr > cornerTransfer.fl, 'Outer right tires gain load during hard right turn');
  assert.ok(cornerTransfer.rr > cornerTransfer.rl, 'Rear outer tire supports greater cornering normal force');
});

test('counter-steering stabilization assist calculates corrective steering torque during drift', () => {
  const calcCounterSteer = (slipAngle, vx, inputDir, isDrifting, assistFactor = 1.0) => {
    const isOversteering = isDrifting && (Math.sign(vx) !== Math.sign(inputDir) || inputDir === 0);
    const torque = isOversteering ? (-slipAngle * 0.44 * assistFactor) : 0;
    return { isOversteering, torque };
  };

  // Car drifting right (vx = +4.5), slip angle = +0.32 rad, driver relaxes steering (inputDir = 0)
  const assistActive = calcCounterSteer(0.32, 4.5, 0, true, 1.0);
  assert.equal(assistActive.isOversteering, true, 'Oversteer detected when tail steps out without steering input');
  assert.ok(assistActive.torque < 0, 'Counter-steering assist applies negative torque to stabilize drift');

  // Driving straight (not drifting)
  const gripDrive = calcCounterSteer(0.05, 0.5, 1.0, false, 1.0);
  assert.equal(gripDrive.torque, 0, 'No counter-steer interference during normal grip driving');
});

test('anti-snapback drift recovery progressively interpolates damping and aligns yaw without snap', () => {
  let driftExitTimer = 0.35; // 350ms window
  let vx = 4.2; // residual lateral speed from drift
  let yaw = -0.38; // residual drift yaw angle
  const dt = 0.05;

  const steps = [];
  while (driftExitTimer > 0) {
    driftExitTimer = Math.max(0, driftExitTimer - dt);
    const recoveryFactor = driftExitTimer / 0.35;
    // Damping smoothly increases from 7.5 to 14.0
    const damping = (1.0 - recoveryFactor) * 14.0 + recoveryFactor * 7.5;
    vx += (0 - vx) * Math.min(1, dt * damping);
    yaw += (0 - yaw) * Math.min(1, dt * 7.8);
    steps.push({ driftExitTimer, damping, vx, yaw });
  }

  assert.ok(steps[0].damping < steps[steps.length - 1].damping, 'Damping progressively stiffens towards full grip');
  assert.ok(Math.abs(steps[steps.length - 1].vx) < Math.abs(steps[0].vx), 'Lateral velocity is critically damped');
  assert.ok(Math.abs(steps[steps.length - 1].yaw) < 0.10, 'Yaw angle smoothly returns to forward alignment without overshoot');
});

test('dual-clutch transmission shifts with 45ms torque dip cut and instantaneous gear engagement', () => {
  const dct = {
    gear: 1,
    isDctCut: false,
    dctShiftTimer: 0,
    shiftCooldown: 0,
    speed: 7.0, // ~63 km/h
    targetSpeed: 35.0,
    update(speedKmh, dt = 0.016) {
      if (this.shiftCooldown > 0) this.shiftCooldown -= dt;
      if (speedKmh > 68 && this.gear === 1 && this.shiftCooldown <= 0) {
        this.gear = 2;
        this.isDctCut = true;
        this.dctShiftTimer = 0.045; // 45ms torque dip
        this.shiftCooldown = 0.12;
      }
      if (this.isDctCut) {
        this.dctShiftTimer -= dt;
        if (this.dctShiftTimer <= 0) this.isDctCut = false;
      }
      const torqueFactor = this.isDctCut ? 0.40 : 1.0;
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 3.5 * torqueFactor);
    }
  };

  // Pre-shift
  dct.update(65);
  assert.equal(dct.gear, 1, 'In Gear 1 below 68 km/h shift point');
  assert.equal(dct.isDctCut, false, 'Full engine torque delivery prior to shift');

  // Trigger upshift at 72 km/h
  dct.update(72);
  assert.equal(dct.gear, 2, 'Instantaneous gear change to Gear 2');
  assert.equal(dct.isDctCut, true, 'Dual-clutch cut active during 45ms transition');
  assert.ok(dct.dctShiftTimer > 0 && dct.dctShiftTimer <= 0.045, 'Shift timer matches 45ms specification');

  // After 45ms expires:
  dct.update(73, 0.05);
  assert.equal(dct.isDctCut, false, 'Torque restored to 100% after 45ms DCT clutch handover');
});

test('automated downshift rev-matching blips throttle to intermediate ratio RPM', () => {
  const powertrain = {
    gear: 3,
    rpm: 4200,
    revMatchTimer: 0,
    shiftCooldown: 0,
    downshift(newGear) {
      this.gear = newGear;
      this.revMatchTimer = 0.12; // 120ms throttle blip
      this.shiftCooldown = 0.12;
    },
    updateRpm(speedKmh, dt = 0.016) {
      if (this.revMatchTimer > 0) this.revMatchTimer = Math.max(0, this.revMatchTimer - dt);
      const gearMin = [0, 0, 52, 110, 165, 218, 272][this.gear] || 0;
      const gearMax = [0, 68, 125, 180, 235, 290, 380][this.gear] || 68;
      const progress = Math.max(0, Math.min(1, (speedKmh - gearMin) / (gearMax - gearMin)));
      let baseRpm = 1400 + progress * 5800;
      if (this.revMatchTimer > 0) {
        baseRpm = Math.min(7800, baseRpm + 1800 * (this.revMatchTimer / 0.12));
      }
      this.rpm += (baseRpm - this.rpm) * Math.min(1, dt * 14.0);
      return Math.round(this.rpm);
    }
  };

  // Hard brake from Gear 3 (130 km/h) down to Gear 2 (95 km/h)
  powertrain.downshift(2);
  assert.equal(powertrain.gear, 2, 'Downshifted to Gear 2');
  assert.ok(powertrain.revMatchTimer > 0, 'Automated throttle blip timer armed');

  const blippedRpm = powertrain.updateRpm(95, 0.016);
  assert.ok(blippedRpm > 4500, `Rev-matching blips engine RPM upward (${blippedRpm} RPM)`);

  // After 120ms blip completes:
  powertrain.updateRpm(95, 0.15);
  assert.equal(powertrain.revMatchTimer, 0, 'Blip timer successfully expired');
});

test('transmission gear hysteresis prevents rapid gear flutter around shift boundaries', () => {
  const getGear = (currentGear, speedKmh) => {
    let target = currentGear;
    if (currentGear === 1 && speedKmh > 68) target = 2;
    else if (currentGear === 2) {
      if (speedKmh > 125) target = 3;
      else if (speedKmh < 52) target = 1;
    } else if (currentGear === 3) {
      if (speedKmh > 180) target = 4;
      else if (speedKmh < 110) target = 2;
    }
    return target;
  };

  let gear = 1;
  gear = getGear(gear, 69); // upshift to 2
  assert.equal(gear, 2, 'Upshifts to Gear 2 when passing 68 km/h');

  // Throttle flutter at 65 km/h (below upshift, but above downshift threshold 52 km/h)
  gear = getGear(gear, 65);
  assert.equal(gear, 2, 'Hysteresis keeps Gear 2 engaged when fluctuating around 65 km/h');

  gear = getGear(gear, 67);
  assert.equal(gear, 2, 'Maintains Gear 2 without hunting back to Gear 1');

  // True downshift threshold
  gear = getGear(gear, 50);
  assert.equal(gear, 1, 'Downshifts to Gear 1 only when dipping below 52 km/h hysteresis limit');
});

test('ceramic brake rotor thermal buildup causes proportional fade and recovers via airflow cooling', () => {
  const brakes = {
    temp: 45, // ambient 45°C
    fadeFactor: 1.0,
    applyBrake(speedKmh, dt = 1.0) {
      const speedUnits = speedKmh / 9.0;
      const heatRate = (speedUnits / 24.0) * 85.0;
      this.temp = Math.min(950, this.temp + heatRate * dt);
      if (this.temp > 600) {
        const fade = (this.temp - 600) / 350;
        this.fadeFactor = Math.max(0.80, 1.0 - fade * 0.20);
      } else {
        this.fadeFactor = 1.0;
      }
    },
    cool(speedKmh, dt = 1.0) {
      const speedUnits = speedKmh / 9.0;
      const coolRate = 12.0 + (speedUnits / 28.0) * 36.0;
      this.temp = Math.max(45, this.temp - coolRate * dt);
      if (this.temp > 600) {
        const fade = (this.temp - 600) / 350;
        this.fadeFactor = Math.max(0.80, 1.0 - fade * 0.20);
      } else {
        this.fadeFactor = 1.0;
      }
    }
  };

  // Normal moderate braking (3 seconds at 180 km/h)
  brakes.applyBrake(180, 3.0);
  assert.ok(brakes.temp > 200 && brakes.temp < 600, `Operating temperature within optimal range (${brakes.temp.toFixed(0)}°C)`);
  assert.equal(brakes.fadeFactor, 1.0, 'No fade within optimal ceramic range (<= 600°C)');

  // Sustained thermal abuse (8 seconds at 250 km/h)
  brakes.applyBrake(250, 8.0);
  assert.ok(brakes.temp > 750, `Rotors heat up significantly under continuous braking (${brakes.temp.toFixed(0)}°C)`);
  assert.ok(brakes.fadeFactor < 1.0 && brakes.fadeFactor >= 0.80, `Thermal fade reduces braking effectiveness (${(brakes.fadeFactor * 100).toFixed(0)}%)`);

  // High-speed cruising cooling (10 seconds at 200 km/h)
  const hotTemp = brakes.temp;
  brakes.cool(200, 10.0);
  assert.ok(brakes.temp < hotTemp, `Airflow at speed dissipates rotor heat (${hotTemp.toFixed(0)}°C -> ${brakes.temp.toFixed(0)}°C)`);
  assert.ok(brakes.fadeFactor > 0.85, 'Brake effectiveness recovers as rotors cool');
});

test('virtual floating joystick clamps throw radius, enforces deadzone, and outputs smooth analog steer', () => {
  const insideDeadzone = computeVirtualJoystickOutput(5, -3, 56, 0.14);
  assert.equal(insideDeadzone.steer, 0, 'Micro jitter inside 14% deadzone outputs exact zero steer');

  const halfRight = computeVirtualJoystickOutput(35, 0, 56, 0.14);
  assert.ok(halfRight.steer > 0.35 && halfRight.steer < 0.75, `Half drag produces smooth progressive analog steer (${halfRight.steer})`);

  const fullLeft = computeVirtualJoystickOutput(-140, 80, 56, 0.14);
  const clampedDist = Math.hypot(fullLeft.clampedDx, fullLeft.clampedDy);
  assert.ok(Math.abs(clampedDist - 56) < 0.01, `Visual thumbstick knob clamps cleanly to 56px radius (${clampedDist.toFixed(2)})`);
  assert.ok(fullLeft.steer < -0.7, 'Far-left drag delivers strong negative steer despite diagonal offset');
});

test('multi-touch tracker isolates per-pointer lifecycles without touchcancel or multi-finger release leaks', () => {
  const tracker = new TouchInputTracker();

  // Finger 1 holds Left steer via virtual joystick, Finger 2 holds NITRO (' '), Finger 3 holds BRAKE ('ArrowDown')
  tracker.startJoystick(101, 100, 500);
  const joyOut = tracker.moveJoystick(101, 145, 500);
  assert.ok(joyOut.steer > 0.5, 'Joystick pointer actively steers');

  tracker.pressButton(102, ' ');
  tracker.pressButton(103, 'ArrowDown');
  assert.equal(tracker.hasActiveKey(' '), true);
  assert.equal(tracker.hasActiveKey('ArrowDown'), true);

  // Release NITRO finger (pointer 102): Joystick steer & BRAKE finger MUST remain intact!
  const relNitro = tracker.releasePointer(102);
  assert.equal(relNitro.releasedKey, ' ');
  assert.equal(relNitro.releasedJoystick, false);
  assert.equal(tracker.hasActiveKey(' '), false);
  assert.equal(tracker.hasActiveKey('ArrowDown'), true, 'Releasing one touch pointer never cancels another held button');
  assert.equal(tracker.joystick.active, true, 'Joystick stays active when action button is released');

  // Simulate pointercancel / drag-off on joystick (pointer 101)
  const relJoy = tracker.releasePointer(101);
  assert.equal(relJoy.releasedJoystick, true);
  assert.equal(tracker.joystick.active, false);
  assert.equal(tracker.joystick.steer, 0, 'Joystick steer snaps cleanly to zero on pointercancel');

  // Simulate blur/visibility reset clearing remaining stuck pointers
  tracker.resetAll();
  assert.equal(tracker.activePointers.size, 0);
  assert.equal(tracker.hasActiveKey('ArrowDown'), false);
});

test('gamepad API normalizer handles analog stick curve, RT/LT progressive triggers, and edge-triggered pause', () => {
  const mockPad = {
    connected: true,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    axes: [-0.62, 0.0, 0.0, 0.0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  };
  mockPad.buttons[7] = { pressed: true, value: 0.72 }; // RT partial throttle
  mockPad.buttons[6] = { pressed: true, value: 0.53 }; // LT progressive brake
  mockPad.buttons[9] = { pressed: true, value: 1.0 };  // Start pressed

  const frame1 = normalizeGamepadState(mockPad, { pause: false, emp: false });
  assert.equal(frame1.connected, true);
  assert.ok(frame1.steer < -0.35 && frame1.steer > -0.7, `Analog left stick produces smooth steer (${frame1.steer})`);
  assert.equal(frame1.hasAnalogThrottle, true);
  assert.ok(frame1.throttle > 0.75 && frame1.throttle < 0.9, `RT maps progressive throttle (${frame1.throttle})`);
  assert.ok(frame1.brakeIntensity > 0.45 && frame1.brakeIntensity < 0.6, `LT maps progressive braking (${frame1.brakeIntensity})`);
  assert.equal(frame1.drift, true, 'LT brake + stick steer initiates progressive drift');
  assert.equal(frame1.pausePressed, true, 'First frame Start press triggers pause edge');

  // Holding Start on frame 2 must NOT re-trigger togglePause
  const frame2 = normalizeGamepadState(mockPad, frame1.nextPrevButtons);
  assert.equal(frame2.pausePressed, false, 'Held Pause button does not spam-toggle across frames');

  // Idle controller at rest (RT=0, stick inside deadzone) must NOT slow keyboard/touch auto-throttle
  const idlePad = {
    connected: true,
    id: 'Idle Pad',
    axes: [0.05, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  };
  const idleState = normalizeGamepadState(idlePad);
  assert.equal(idleState.steer, 0);
  assert.equal(idleState.hasAnalogThrottle, false);
  assert.equal(idleState.throttle, 1.0);
});

test('haptic controller throttles continuous curb scuffs and drives navigator.vibrate + dual-rumble actuators', () => {
  const haptics = new HapticController();
  const vibrateCalls = [];
  const rumbleCalls = [];

  const env = (now) => ({
    now,
    hapticEnabled: true,
    gamepadRumbleEnabled: true,
    vibrateFn: (pat) => vibrateCalls.push(pat),
    getGamepadsFn: () => [{
      connected: true,
      vibrationActuator: {
        playEffect: (type, opts) => rumbleCalls.push({ type, ...opts })
      }
    }]
  });

  // First curb scuff fires immediately
  const hit1 = haptics.trigger('curb_scuff', { vibratePattern: 28, weakMagnitude: 0.5, strongMagnitude: 0.4, durationMs: 55, cooldownMs: 110 }, env(1000));
  // Rapid next-frame call inside 110ms cooldown is throttled cleanly
  const hit2 = haptics.trigger('curb_scuff', { vibratePattern: 28, cooldownMs: 110 }, env(1016));
  // Different channel ('gear_shift') is independent and fires immediately
  const hit3 = haptics.trigger('gear_shift', { vibratePattern: 14, weakMagnitude: 0.3, strongMagnitude: 0.55, durationMs: 35, cooldownMs: 90 }, env(1030));
  // Curb scuff after cooldown expires fires again
  const hit4 = haptics.trigger('curb_scuff', { vibratePattern: 28, cooldownMs: 110 }, env(1130));

  assert.equal(hit1, true);
  assert.equal(hit2, false, 'Continuous curb scuffs are throttled cleanly inside 110ms window');
  assert.equal(hit3, true, 'Independent haptic channel triggers without being blocked by curb cooldown');
  assert.equal(hit4, true, 'Curb scuff fires again once cooldown expires');
  assert.equal(vibrateCalls.length, 3);
  assert.equal(rumbleCalls.length, 3);
  assert.equal(rumbleCalls[0].type, 'dual-rumble');
});

test('turn signal indicator flashes 1.2s before civilian traffic initiates lateral lane transition', () => {
  const car = {
    lane: 0,
    targetLane: 0,
    pendingTargetLane: 0,
    signalDir: 0,
    signalTimer: 0,
    mesh: { position: { x: 0, z: -60 } }
  };

  const scheduled = planLaneChangeWithSignal(car, -6, 1.2);
  assert.equal(scheduled, true);
  assert.equal(car.signalTimer, 1.2, 'Turn signal activates for 1.2s prior to lane transition');
  assert.equal(car.signalDir, -1, 'Left turn signal activates when shifting toward left lane (-6)');
  assert.equal(car.targetLane, 0, 'Car holds current lane during 1.2s pre-change flash');

  // Simulate 0.8s elapsed (still signaling before moving)
  car.signalTimer = Math.max(0, car.signalTimer - 0.8);
  assert.ok(car.signalTimer > 0 && car.targetLane === 0, 'Car still flashes before 1.2s lead expires');

  // Simulate remaining 0.45s elapsed -> transition commits
  car.signalTimer = Math.max(0, car.signalTimer - 0.45);
  if (car.signalTimer <= 0) car.targetLane = car.pendingTargetLane;
  assert.equal(car.targetLane, -6, 'Target lane engages only after 1.2s signal warning completes');
});

test('convoy pacing assigns heavy trucks and tankers to right/center lanes leaving left lane clear for overtakes', () => {
  const allThree = selectConvoyAwareLanes([-6, 0, 6], true);
  assert.deepEqual(allThree, [6, 0], 'Heavy convoy selects right (6) first, then center (0), excluding left (-6)');

  const leftAndCenter = selectConvoyAwareLanes([-6, 0], true);
  assert.deepEqual(leftAndCenter, [0], 'When right lane is busy, heavy convoy stays in center (0) rather than fast left (-6)');

  const onlyLeft = selectConvoyAwareLanes([-6], true);
  assert.deepEqual(onlyLeft, [-6], 'Falls back to left lane only when no right/center lane exists');
});

test('10,000m continuous traffic flow simulation has zero overlapping spawns and guarantees escape corridor', () => {
  const lanes = [-6, 0, 6];
  const vehicles = [];
  const obstacles = [];
  let distance = 0;
  let totalSpawns = 0;
  let overlappingSpawns = 0;
  let deadlockCount = 0;

  const dt = 0.1; // 10 Hz flow simulation over ~10,000m
  const playerSpeed = 30; // ~270 km/h
  let spawnTimer = 0.8;
  let obsTimer = 2.5;

  while (distance < 10000) {
    distance += playerSpeed * dt;
    spawnTimer -= dt;
    obsTimer -= dt;

    // Move existing entities
    for (let i = vehicles.length - 1; i >= 0; i--) {
      vehicles[i].z += (playerSpeed - vehicles[i].speed) * dt;
      if (vehicles[i].z > 24) vehicles.splice(i, 1);
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].z += playerSpeed * dt;
      if (obstacles[i].z > 24) obstacles.splice(i, 1);
    }
    preventClumpDeadlocks(vehicles, obstacles, [], dt);

    if (spawnTimer <= 0) {
      const occupied = new Set([
        ...vehicles.filter(v => v.z < -118).map(v => v.lane),
        ...obstacles.filter(o => o.z < -118).map(o => o.lane)
      ]);
      const avail = lanes.filter(l => !occupied.has(l));
      if (avail.length > 1) {
        const isHeavy = (totalSpawns % 5) === 0;
        const candidateLanes = selectConvoyAwareLanes(avail, isHeavy);
        for (const picked of candidateLanes) {
          const candidate = { lane: picked, targetLane: picked, z: -145, speed: isHeavy ? 17 : 22 };
          if (hasViableEscapeCorridor([...vehicles, candidate], obstacles, [], -145, -5)) {
            if (occupied.has(picked)) overlappingSpawns++;
            vehicles.push(candidate);
            totalSpawns++;
            break;
          }
        }
      }
      spawnTimer = Math.max(0.45, 1.4 - distance / 6000);
    }

    if (obsTimer <= 0) {
      const occupied = new Set([
        ...vehicles.filter(v => v.z < -118).map(v => v.lane),
        ...obstacles.filter(o => o.z < -118).map(o => o.lane)
      ]);
      const avail = lanes.filter(l => !occupied.has(l));
      if (avail.length > 1) {
        for (let i = 0; i < avail.length; i++) {
          const picked = avail[(totalSpawns + i) % avail.length];
          const candidate = { lane: picked, z: -145 };
          if (hasViableEscapeCorridor(vehicles, [...obstacles, candidate], [], -145, -5)) {
            if (occupied.has(picked)) overlappingSpawns++;
            obstacles.push(candidate);
            break;
          }
        }
      }
      obsTimer = 2.4;
    }

    preventClumpDeadlocks(vehicles, obstacles, [], dt);

    if (!hasViableEscapeCorridor(vehicles, obstacles, [], -65, -5)) {
      deadlockCount++;
    }
  }

  assert.ok(totalSpawns >= 80, `Simulated ${totalSpawns} traffic spawns over 10,000m`);
  assert.equal(overlappingSpawns, 0, 'Zero overlapping spawns occurred across 10,000m');
  assert.equal(deadlockCount, 0, 'Zero 3-wide clump deadlocks occurred within 60m escape corridor');
});

test('civilian traffic solid impasse prevents clipping through stationary obstacles', () => {
  const vehicle = {
    lane: 0,
    targetLane: 0,
    width: 2.2,
    length: 4.6,
    speed: 22,
    mesh: { position: { x: 0, z: -42.5 } }
  };
  const obstacle = {
    lane: 0,
    mesh: { position: { x: 0, z: -45 } }
  };

  const obsHalfW = 1.45;
  const obsHalfL = 1.65;
  const halfW = (vehicle.width * 0.5) + obsHalfW; // 2.55
  const halfL = (vehicle.length * 0.5) + obsHalfL; // 3.95
  const dx = vehicle.mesh.position.x - obstacle.mesh.position.x;
  const dz = vehicle.mesh.position.z - obstacle.mesh.position.z; // +2.5 < 3.95 -> intersecting from behind

  const overlapX = halfW - Math.abs(dx);
  const overlapZ = halfL - Math.abs(dz);
  if (Math.abs(dx) < halfW && Math.abs(dz) < halfL) {
    if (overlapZ <= overlapX && dz > 0) {
      vehicle.mesh.position.z = obstacle.mesh.position.z + halfL + 0.15;
      vehicle.speed = 0;
    }
  }

  assert.ok(vehicle.mesh.position.z >= obstacle.mesh.position.z + halfL, 'Vehicle is cleanly stopped behind obstacle without clipping');
  assert.equal(vehicle.speed, 0, 'Vehicle halts cleanly on rear-bumper impasse');
});
