import test from 'node:test';
import assert from 'node:assert';
import {
  computeSpatialAudio,
  VoiceBudget,
  computeConcussionProfile,
} from '../js/audio-dsp.js';

test('computeSpatialAudio calculates accurate left/right pan and rear occlusion without behind-player inversion', () => {
  const listener = { x: 0, z: 0 };

  // Facing -Z (yaw = 0): +X is right, -X is left, +Z is directly behind
  const right = computeSpatialAudio(listener, 0, { x: 10, z: 0 });
  assert(right.pan > 0.99, `Expected +1 pan for right source, got ${right.pan}`);
  assert(right.rearFactor < 0.01);

  const left = computeSpatialAudio(listener, 0, { x: -10, z: 0 });
  assert(left.pan < -0.99, `Expected -1 pan for left source, got ${left.pan}`);

  const behind = computeSpatialAudio(listener, 0, { x: 0, z: 10 });
  assert(Math.abs(behind.pan) < 0.01, `Directly behind must center pan, got ${behind.pan}`);
  assert(behind.rearFactor > 0.99, `Expected rearFactor=1 behind listener, got ${behind.rearFactor}`);
  assert(behind.rearCutoffHz < 8000, `Rear occlusion cutoff should darken behind sounds: ${behind.rearCutoffHz}`);

  // Facing +Z (yaw = PI): -X is right, +X is left
  const rightTurned = computeSpatialAudio(listener, Math.PI, { x: -10, z: 0 });
  assert(rightTurned.pan > 0.99, `After 180° turn, -X must be right speaker (+1), got ${rightTurned.pan}`);

  // Near-origin deadzone prevents violent pan snapping right on top of listener
  const onTop = computeSpatialAudio(listener, 0, { x: 0.05, z: 0 });
  assert(Math.abs(onTop.pan) <= 0.25, `Near-origin pan must damp smoothly: ${onTop.pan}`);
});

test('VoiceBudget caps concurrent voices at 40 and drops low-priority debris under explosion chains', () => {
  const budget = new VoiceBudget(28, 40);
  const t = 10.0;

  // Fill 28 low-priority voices
  for (let i = 0; i < 28; i++) {
    assert(budget.acquire(t, 1.0, 0), `Should acquire voice ${i}`);
  }

  // At softCap (28), additional priority 0 (debris) voices are dropped cleanly
  assert.strictEqual(budget.acquire(t, 0.5, 0), false);
  assert(budget.dropped >= 1);

  // High-priority (gunfire/explosion) voices still acquire up to hardCap (40)
  for (let i = 0; i < 12; i++) {
    assert(budget.acquire(t, 1.0, 2), `Should acquire priority-2 voice ${i}`);
  }
  assert.strictEqual(budget.activeCount(t), 40);

  // Priority-3 (explosion/tinnitus) steals from lower-priority slot when at hardCap
  let stolen = false;
  const slot = budget.acquire(t, 1.5, 3, () => { stolen = true; });
  assert(slot !== false && stolen === true, 'Priority-3 voice must steal a lower-priority slot at hardCap');
  assert.strictEqual(budget.activeCount(t), 40);

  // After durations expire, voices prune automatically
  assert.strictEqual(budget.activeCount(t + 2.0), 0);
});

test('computeConcussionProfile scales low-pass muffle and tinnitus safely within blast radius', () => {
  const close = computeConcussionProfile(1.5, 11);
  assert.strictEqual(close.active, true);
  assert(close.cutoffHz < 800, `Close blast must heavily muffle highs: ${close.cutoffHz}`);
  assert(close.tinnitusGain > 0.02 && close.tinnitusGain <= 0.045);

  const far = computeConcussionProfile(18, 11);
  assert.strictEqual(far.active, false);
  assert.strictEqual(far.cutoffHz, 20000);
  assert.strictEqual(far.tinnitusGain, 0);
});
