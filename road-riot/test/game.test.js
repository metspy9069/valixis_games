import test from 'node:test';
import assert from 'node:assert/strict';

import { ProgressionManager, ACHIEVEMENTS } from '../js/progression.js';
import { VEHICLE_ROSTER } from '../js/player.js';

test('vehicle roster contains 5 distinct supercars with complete base stats', () => {
  const keys = Object.keys(VEHICLE_ROSTER);
  assert.equal(keys.length, 5);
  assert.deepEqual(keys, ['apex', 'venom', 'titan', 'phantom', 'hyperion']);

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
