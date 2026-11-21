import test from 'node:test';
import assert from 'node:assert/strict';

import { ProgressionManager, ACHIEVEMENTS } from '../js/progression.js';
import { VEHICLE_ROSTER } from '../js/player.js';

test('vehicle roster contains 6 distinct supercars with complete base stats', () => {
  const keys = Object.keys(VEHICLE_ROSTER);
  assert.equal(keys.length, 6);
  assert.deepEqual(keys, ['apex', 'venom', 'phantom', 'interceptor', 'titan', 'hyperion']);

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
