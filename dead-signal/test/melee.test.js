import test from 'node:test';
import assert from 'node:assert';
import {
  MELEE_COMBO_STEPS,
  nextMeleeCombo,
  isTargetInMeleeArc,
  applyMeleeWear,
} from '../js/melee.js';

test('nextMeleeCombo chains 3 distinct combo steps and resets after combo window expires', () => {
  const state = { comboStep: 0, lastSwingAt: -99 };

  const s1 = nextMeleeCombo(state, 1.0);
  assert.strictEqual(s1.step, 0);
  assert.strictEqual(s1.damageMul, 1.0);
  assert.strictEqual(s1.breaksGuard, false);

  const s2 = nextMeleeCombo(state, 1.45);
  assert.strictEqual(s2.step, 1);
  assert.strictEqual(s2.damageMul, 1.15);

  const s3 = nextMeleeCombo(state, 1.9);
  assert.strictEqual(s3.step, 2);
  assert.strictEqual(s3.damageMul, 1.75);
  assert.strictEqual(s3.breaksGuard, true);

  // Fourth hit wraps to Step 0
  const sWrap = nextMeleeCombo(state, 2.4);
  assert.strictEqual(sWrap.step, 0);

  // Letting combo window (>1.1s) expire resets to Step 0
  nextMeleeCombo(state, 2.8); // Step 1
  const sExpired = nextMeleeCombo(state, 5.0);
  assert.strictEqual(sExpired.step, 0);
});

test('isTargetInMeleeArc blocks targets behind the player camera regardless of target radius', () => {
  const playerPos = { x: 0, z: 0 };
  const forward = { x: 0, z: -1 }; // Looking down -Z
  const range = 2.4;
  const halfAngle = 0.65;

  // Target directly in front within range -> HIT
  const front = isTargetInMeleeArc(playerPos, forward, { x: 0, z: -1.8 }, 0.4, range, halfAngle);
  assert.strictEqual(front.hit, true);

  // Large brute standing directly BEHIND player camera -> MUST MISS
  const behindBrute = isTargetInMeleeArc(playerPos, forward, { x: 0, z: 0.45 }, 0.64, range, halfAngle);
  assert.strictEqual(behindBrute.hit, false, 'Melee swing must never hit targets behind the camera');

  // Target far out of cone to the side -> MUST MISS
  const flank = isTargetInMeleeArc(playerPos, forward, { x: 1.5, z: -0.2 }, 0.4, range, halfAngle);
  assert.strictEqual(flank.hit, false);
});

test('applyMeleeWear does not drain durability on missed swings and resets cleanly at maxUses', () => {
  // Missed swing (hits = 0)
  const miss = applyMeleeWear(14, 90, 0);
  assert.strictEqual(miss.uses, 14);
  assert.strictEqual(miss.replaced, false);

  // Connected swing (hits = 2) consumes 1 swing durability
  const hit = applyMeleeWear(14, 90, 2);
  assert.strictEqual(hit.uses, 15);
  assert(hit.wearRatio > 0.16);

  // Final swing triggers blade replacement
  const wornOut = applyMeleeWear(89, 90, 1);
  assert.strictEqual(wornOut.uses, 0);
  assert.strictEqual(wornOut.replaced, true);
  assert.strictEqual(wornOut.wearRatio, 0);
});
