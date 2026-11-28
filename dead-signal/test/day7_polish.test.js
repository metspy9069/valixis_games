import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEAPON_RECOIL_PROFILES,
  WeaponRecoilSpring,
  ScreenShakeSystem,
} from '../js/gunplay-polish.js';
import {
  simulateWaves,
  waveHealth,
  clearTime,
  PISTOL,
  SMG,
  SHOTGUN,
  RIFLE,
  RIPPER,
} from '../tools/balance-sim.mjs';
import { waveTable } from '../js/waves.js';

test('WEAPON_RECOIL_PROFILES covers all 5 weapon tiers with distinct physical spring rates', () => {
  const tiers = ['pistol', 'smg', 'shotgun', 'rifle', 'ripper'];
  for (const t of tiers) {
    const prof = WEAPON_RECOIL_PROFILES[t];
    assert.ok(prof, `Profile for ${t} exists`);
    assert.ok(prof.springRate > 0, `Spring rate for ${t} must be positive`);
    assert.ok(prof.damping >= 0.95 && prof.damping <= 1.15, `Damping for ${t} must be near critically damped`);
    assert.ok(prof.fireShake > 0 && prof.fireShake < 0.15, `Micro-shake for ${t} must be subtle`);
  }

  // Pistol resets significantly faster than Shotgun or Marksman Rifle
  const pistol = WEAPON_RECOIL_PROFILES.pistol;
  const shotgun = WEAPON_RECOIL_PROFILES.shotgun;
  const rifle = WEAPON_RECOIL_PROFILES.rifle;
  assert.ok(pistol.springRate > shotgun.springRate, 'Pistol spring rate must be faster than Shotgun');
  assert.ok(pistol.springRate > rifle.springRate, 'Pistol spring rate must be faster than Rifle');
  assert.ok(shotgun.fireShake > pistol.fireShake, 'Shotgun must produce heavier micro-shake than Pistol');
});

test('WeaponRecoilSpring applies kick and settles smoothly to zero equilibrium', () => {
  const spring = new WeaponRecoilSpring('pistol');

  // Initial state is rest
  const initial = spring.update(0.016);
  assert.equal(initial.pitch, 0);
  assert.equal(initial.yaw, 0);

  // Fire round: impulse kicked
  const res = spring.kick('pistol', false, 1.0, false);
  assert.ok(res.pitchDelta > 0, 'Pitch delta kicked upward');

  // Step physics: pitch increases
  const step1 = spring.update(0.016);
  assert.ok(step1.pitch > 0, 'Camera pitch kicks upward after fire');

  // ADS reduces kick
  const springAds = new WeaponRecoilSpring('pistol');
  const resAds = springAds.kick('pistol', true, 1.0, false);
  assert.ok(resAds.pitchDelta < res.pitchDelta * 0.7, 'ADS reduces recoil kick impulse');

  // Over 0.35s, spring settles back to equilibrium (zero drift)
  for (let t = 0; t < 0.4; t += 0.016) {
    spring.update(0.016);
  }
  const settled = spring.update(0.016);
  assert.ok(settled.pitch < 1e-3, `Recoil pitch settled back to center (${settled.pitch})`);
});

test('ScreenShakeSystem implements 3-tier hierarchy: micro, medium, and radial explosion shake', () => {
  const shake = new ScreenShakeSystem(2.6);

  // 1. Tier 1: Micro-shake on fire
  shake.reset();
  shake.addFireShake(0.035);
  const fireShakeVal = shake.update(0.016, 1.0);
  assert.ok(fireShakeVal > 0 && fireShakeVal < 0.01, `Fire micro-shake is subtle (${fireShakeVal})`);

  // 2. Tier 2: Medium-shake on damage taken
  shake.reset();
  shake.addDamageShake(0.42);
  const dmgShakeVal = shake.update(0.016, 1.0);
  assert.ok(dmgShakeVal > 0.12, `Damage shake produces tactile punch (${dmgShakeVal})`);
  assert.ok(dmgShakeVal > fireShakeVal * 15, 'Damage shake is significantly stronger than fire micro-shake');

  // 3. Tier 3: Heavy radial explosion shake with distance falloff
  shake.reset();
  const closeImpulse = shake.addExplosionShake(2.0, 18.0, 1.5);
  const closeShake = shake.update(0.016, 1.0);
  assert.ok(closeShake > 1.0, `Close explosion shake is room-rumbling (${closeShake})`);

  shake.reset();
  const farImpulse = shake.addExplosionShake(14.0, 18.0, 1.5);
  assert.ok(farImpulse < closeImpulse * 0.25, 'Explosion shake attenuates with distance');

  shake.reset();
  const outOfRange = shake.addExplosionShake(25.0, 18.0, 1.5);
  assert.equal(outOfRange, 0, 'Explosion outside radius causes zero shake');
});

test('Wave balance simulation across Waves 1-15 confirms balanced TTK with zero overruns', () => {
  const results = simulateWaves(15);
  assert.equal(results.length, 15);

  let overrunCount = 0;
  for (const r of results) {
    if (r.verdict === 'overrun') overrunCount++;
    assert.notEqual(r.verdict, 'overrun', `Wave ${r.wave} must be clearable before overrun`);
  }
  assert.equal(overrunCount, 0, 'All Waves 1-15 must be solvable with zero overruns under progressive loadouts');

  // Verify all 5 weapons are represented in cap wave comparisons
  const rows = waveTable(20);
  const capWave = rows.find((r) => r.count >= 40);
  const hp = waveHealth(capWave, capWave.mix);

  for (const w of [PISTOL, SMG, SHOTGUN, RIFLE, RIPPER]) {
    const perShot = w.damage * (w.pellets || 1);
    const shots = Math.ceil(hp / perShot);
    const time = clearTime(w, shots);
    assert.ok(time > 15 && time < 80, `${w.name} clear time (${time}s) on wave ${capWave.wave} is physically reasonable`);
  }
});
