import test from 'node:test';
import assert from 'node:assert';
import {
  RELOAD_STAGE,
  totalLoaded,
  consumeRound,
  beginReloadState,
  tickReloadState,
  interruptReloadState,
} from '../js/reload.js';
import { WEAPONS } from '../js/data.js';

function makeAmmo(weaponIdx = 0) {
  return {
    weapon: weaponIdx,
    mag: WEAPONS.map((w) => w.magSize - 1),
    chambered: WEAPONS.map(() => true),
    reloadStage: WEAPONS.map(() => RELOAD_STAGE.READY),
    reserve: WEAPONS.map((w) => (w.reserveMax === Infinity ? Infinity : 120)),
    reloading: false,
    reloadTimer: 0,
    reloadTotal: 0,
    reloadIsPartial: false,
    reloadWeapon: weaponIdx,
    dryFireLatched: false,
  };
}

test('Chambered + magazine logic supports +1 tactical reload capacity and 25% faster partial reload', () => {
  const smg = WEAPONS[1];
  const ammo = makeAmmo(1); // 31 in mag + 1 chambered = 32
  assert.strictEqual(totalLoaded(ammo, 1), 32);

  // Fire 5 rounds -> 26 in mag + 1 chambered = 27
  for (let i = 0; i < 5; i++) assert.strictEqual(consumeRound(ammo, 1), true);
  assert.strictEqual(ammo.mag[1], 26);
  assert.strictEqual(ammo.chambered[1], true);
  assert.strictEqual(totalLoaded(ammo, 1), 27);

  // Tactical reload while chambered should be 25% faster and leave 32 + 1 = 33 loaded
  const started = beginReloadState(ammo, smg, smg.magSize, smg.reloadTime);
  assert.strictEqual(started.isPartial, true);
  assert(Math.abs(started.fullTime - smg.reloadTime * 0.75) < 1e-6);

  // Step through full reload
  tickReloadState(ammo, smg, smg.magSize, started.fullTime + 0.05);
  assert.strictEqual(ammo.reloading, false);
  assert.strictEqual(ammo.mag[1], 32);
  assert.strictEqual(ammo.chambered[1], true);
  assert.strictEqual(totalLoaded(ammo, 1), 33);
});

test('Empty reload racks charging handle and takes full reloadTime', () => {
  const smg = WEAPONS[1];
  const ammo = makeAmmo(1);
  // Drain all 32 rounds
  for (let i = 0; i < 32; i++) assert.strictEqual(consumeRound(ammo, 1), true);
  assert.strictEqual(consumeRound(ammo, 1), false);
  assert.strictEqual(ammo.mag[1], 0);
  assert.strictEqual(ammo.chambered[1], false);

  const started = beginReloadState(ammo, smg, smg.magSize, smg.reloadTime);
  assert.strictEqual(started.isPartial, false);
  assert(Math.abs(started.fullTime - smg.reloadTime) < 1e-6);

  const events = tickReloadState(ammo, smg, smg.magSize, started.fullTime + 0.05);
  assert(events.includes('chamber'));
  assert(events.includes('complete'));
  assert.strictEqual(ammo.chambered[1], true);
  assert.strictEqual(ammo.mag[1], smg.magSize - 1);
  assert.strictEqual(totalLoaded(ammo, 1), smg.magSize);
});

test('Checkpoint reload staging preserves dropped mag and inserted mag across sprint/swap interrupts', () => {
  const rifle = WEAPONS[3];
  const ammo = makeAmmo(3);
  ammo.mag[3] = 0;
  ammo.chambered[3] = false;
  const reserveBefore = ammo.reserve[3];

  // Start empty reload (fullTime = 1.3s)
  const s1 = beginReloadState(ammo, rifle, rifle.magSize, rifle.reloadTime);
  assert.strictEqual(s1.stage, RELOAD_STAGE.READY);

  // Advance 40% (past DROP_MAG 28%, before INSERT_MAG 72%)
  const ev1 = tickReloadState(ammo, rifle, rifle.magSize, s1.fullTime * 0.4);
  assert(ev1.includes('drop'));
  assert.strictEqual(ammo.reloadStage[3], RELOAD_STAGE.MAG_DROPPED);

  // Interrupt by sprinting/swapping
  assert.strictEqual(interruptReloadState(ammo), true);
  assert.strictEqual(ammo.reloading, false);
  assert.strictEqual(ammo.reloadStage[3], RELOAD_STAGE.MAG_DROPPED, 'Dropped mag checkpoint must persist');

  // Resume reload: should start at MAG_DROPPED and take shorter remaining time
  const s2 = beginReloadState(ammo, rifle, rifle.magSize, rifle.reloadTime);
  assert.strictEqual(s2.stage, RELOAD_STAGE.MAG_DROPPED);
  assert(s2.remaining < rifle.reloadTime * 0.8, `Expected resumed reload to skip drop stage: ${s2.remaining}`);

  // Advance past INSERT_MAG (another 50% of fullTime) -> mag inserted, only chambering left
  const ev2 = tickReloadState(ammo, rifle, rifle.magSize, s2.fullTime * 0.5);
  assert(ev2.includes('insert'));
  assert.strictEqual(ammo.reloadStage[3], RELOAD_STAGE.MAG_INSERTED);
  assert.strictEqual(ammo.reserve[3], reserveBefore - rifle.magSize);

  // Interrupt again after mag insertion
  interruptReloadState(ammo);
  const s3 = beginReloadState(ammo, rifle, rifle.magSize, rifle.reloadTime);
  assert.strictEqual(s3.stage, RELOAD_STAGE.MAG_INSERTED);
  assert(s3.remaining < rifle.reloadTime * 0.35, 'Resuming after mag insert should only perform charging handle pull');

  // Complete final stage without consuming extra reserve ammo
  const ev3 = tickReloadState(ammo, rifle, rifle.magSize, s3.remaining + 0.05);
  assert(ev3.includes('chamber'));
  assert.strictEqual(ammo.reloadStage[3], RELOAD_STAGE.READY);
  assert.strictEqual(ammo.reserve[3], reserveBefore - rifle.magSize, 'Must not double-consume reserve on staged resume');
  assert.strictEqual(totalLoaded(ammo, 3), rifle.magSize);
});
