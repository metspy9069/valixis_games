import test from 'node:test';
import assert from 'node:assert';
import { DampedSpring, SIGHT_OFFSETS } from '../js/weapons.js';
import { WEAPONS } from '../js/data.js';

test('DampedSpring provides stable critically damped spring physics', () => {
  const spring = new DampedSpring(18, 1.0);
  assert.strictEqual(spring.val, 0);
  assert.strictEqual(spring.vel, 0);

  // Apply target offset
  spring.setTarget(1.0);

  // Step at 60 FPS (dt = 0.0167)
  for (let i = 0; i < 60; i++) {
    spring.update(0.0167);
  }

  // After 1 second, critically damped spring with omega=18 must have settled within 0.1% of target
  assert(Math.abs(spring.val - 1.0) < 0.005, `Spring did not settle to target: val=${spring.val}`);
  assert(Math.abs(spring.vel) < 0.01, `Spring velocity still high: vel=${spring.vel}`);
});

test('DampedSpring maintains numerical stability across extreme framerates', () => {
  const spring = new DampedSpring(18, 1.0);
  spring.setTarget(5.0);

  // High refresh rate 240Hz (dt = 0.00416)
  for (let i = 0; i < 100; i++) {
    spring.update(0.00416);
    assert(!Number.isNaN(spring.val), 'Spring val became NaN at 240Hz');
  }

  // Extreme hitch / lag spike (dt = 0.15)
  spring.update(0.15);
  assert(!Number.isNaN(spring.val) && Number.isFinite(spring.val), 'Spring unstable during lag spike');
  assert(spring.val <= 5.05, 'Spring overshot target excessively');
});

test('SIGHT_OFFSETS covers all 5 weapons with optical alignment coordinates', () => {
  assert.strictEqual(SIGHT_OFFSETS.length, WEAPONS.length, 'Must have sight offsets for all weapons');
  for (let i = 0; i < WEAPONS.length; i++) {
    const sight = SIGHT_OFFSETS[i];
    assert(sight, `Missing sight offset for weapon ${i}`);
    assert.strictEqual(sight.id, WEAPONS[i].id, `ID mismatch at index ${i}`);
    assert.strictEqual(sight.x, 0, `Sight ${sight.id} must be centered on optical axis x=0`);
    assert(sight.y < 0 && sight.y > -0.15, `Sight ${sight.id} y offset out of realistic bounds: ${sight.y}`);
    assert(sight.z < -0.2 && sight.z > -0.6, `Sight ${sight.id} z offset out of realistic bounds: ${sight.z}`);
  }
});

test('Hermite ADS blend curve is smooth and monotonic', () => {
  let blend = 0;
  const dt = 0.016;
  const speed = 14;
  const values = [];

  for (let i = 0; i < 20; i++) {
    blend += (1 - blend) * (1 - Math.exp(-speed * dt));
    const k = blend * blend * (3 - 2 * blend);
    values.push(k);
    if (i > 0) {
      assert(values[i] >= values[i - 1], `ADS blend curve was non-monotonic at step ${i}`);
    }
  }

  assert(values[values.length - 1] > 0.95, 'ADS blend did not reach full engagement');
});
