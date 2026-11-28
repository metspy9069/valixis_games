/**
 * Gunplay Feel Polish & Integration Engine (Day 7)
 *
 * Implements:
 * 1. Weapon-Tier Recoil Recovery Spring Rates (Pistol, SMG, Shotgun, Marksman, Heavy).
 * 2. 3-Tier Screen-Shake Hierarchy:
 *    - Tier 1: Micro-shake on fire (caliber-tuned, 0.025 - 0.085)
 *    - Tier 2: Medium-shake on damage taken (0.40 - 0.55)
 *    - Tier 3: Heavy radial shake on explosions (distance-attenuated, up to 1.6)
 * 3. Critically damped 2nd-order camera recoil integration with zero drift.
 */

import { DampedSpring } from './weapons.js';

export const WEAPON_RECOIL_PROFILES = {
  pistol: {
    id: 'pistol',
    name: 'M9 SIDEARM',
    springRate: 18.5, // Natural frequency (rad/s) - snappy, crisp reset
    damping: 1.02,    // Critically damped
    kickPitch: 0.0038,
    kickYaw: 0.0012,
    fireShake: 0.035, // Micro-shake
    recoilRecoverySec: 0.09,
  },
  smg: {
    id: 'smg',
    name: 'VECTOR-9',
    springRate: 15.0, // Matches high 1050 RPM cyclic rate
    damping: 1.04,
    kickPitch: 0.0026,
    kickYaw: 0.0016, // Lateral chatter
    fireShake: 0.026, // Fast micro-buzz
    recoilRecoverySec: 0.065,
  },
  shotgun: {
    id: 'shotgun',
    name: 'BREACHER 12',
    springRate: 9.8,  // Heavy punch with mechanical pump recovery
    damping: 0.98,
    kickPitch: 0.0058,
    kickYaw: 0.0022,
    fireShake: 0.088, // Punchy micro-shake
    recoilRecoverySec: 0.18,
  },
  rifle: {
    id: 'rifle',
    name: 'LONGSHOT 7',
    springRate: 9.0,  // Deliberate marksman return for single-shot precision
    damping: 1.01,
    kickPitch: 0.0064,
    kickYaw: 0.0010, // Predominantly vertical rise
    fireShake: 0.076, // Concussive snap
    recoilRecoverySec: 0.22,
  },
  ripper: {
    id: 'ripper',
    name: 'RIPPER LMG',
    springRate: 13.2, // Rhythmic heavy sustained fire
    damping: 1.05,
    kickPitch: 0.0024,
    kickYaw: 0.0019, // Heavy side-to-side chugging
    fireShake: 0.054, // Continuous heavy rumble
    recoilRecoverySec: 0.085,
  },
};

/**
 * Procedural spring-based camera recoil simulation.
 * Replaces flat exponential decay with per-weapon harmonic spring physics.
 */
export class WeaponRecoilSpring {
  constructor(weaponId = 'pistol') {
    this.pitchSpring = new DampedSpring(18.5, 1.02);
    this.yawSpring = new DampedSpring(18.5, 1.02);
    this.activeProfile = WEAPON_RECOIL_PROFILES.pistol;
    this.setWeapon(weaponId);
  }

  setWeapon(weaponId) {
    const profile = WEAPON_RECOIL_PROFILES[weaponId] || WEAPON_RECOIL_PROFILES.pistol;
    this.activeProfile = profile;
    this.pitchSpring.omega = profile.springRate;
    this.pitchSpring.zeta = profile.damping;
    this.yawSpring.omega = profile.springRate;
    this.yawSpring.zeta = profile.damping;
  }

  kick(weaponId, isAds = false, recoilMul = 1.0, isSlug = false) {
    if (weaponId !== this.activeProfile.id) {
      this.setWeapon(weaponId);
    }
    const profile = this.activeProfile;
    const adsMul = isAds ? 0.55 : 1.0;
    const slugMul = isSlug ? 1.4 : 1.0;

    const pImpulse = profile.kickPitch * recoilMul * adsMul * slugMul;
    const yImpulse = (Math.random() - 0.5) * profile.kickYaw * recoilMul * adsMul * slugMul;

    // Apply impulse to 2nd-order spring velocity
    this.pitchSpring.impulse(pImpulse * 52);
    this.yawSpring.impulse(yImpulse * 52);

    return {
      fireShake: profile.fireShake * recoilMul,
      pitchDelta: pImpulse,
      yawDelta: yImpulse,
    };
  }

  update(dt) {
    const p = this.pitchSpring.update(dt);
    const y = this.yawSpring.update(dt);
    return {
      pitch: Math.max(0, p), // Recoil only kicks view upwards
      yaw: y,
    };
  }

  get pitch() {
    return Math.max(0, this.pitchSpring.val);
  }

  get yaw() {
    return this.yawSpring.val;
  }

  reset() {
    this.pitchSpring.reset();
    this.yawSpring.reset();
  }
}

/**
 * 3-Tier Screen-Shake Hierarchy.
 * Manages tactile physical feedback across all three combat impact scales.
 */
export class ScreenShakeSystem {
  constructor(decayRate = 2.6) {
    this.trauma = 0;       // Clamped 0.0 to 2.0
    this.decayRate = decayRate;
  }

  /**
   * Tier 1: Micro-shake on weapon fire (0.025 to 0.088).
   * Gives crisp tactile kick without induced disorientation.
   */
  addFireShake(amount = 0.035) {
    this.trauma = Math.min(0.55, this.trauma + amount);
    return this.trauma;
  }

  /**
   * Tier 2: Medium-shake on damage taken (0.40 to 0.55).
   * Directional impact punch signaling player distress.
   */
  addDamageShake(amount = 0.42) {
    this.trauma = Math.min(1.2, this.trauma + amount);
    return this.trauma;
  }

  /**
   * Tier 3: Heavy radial shake on explosions (distance-attenuated, up to 1.6).
   * Heavy low-frequency shockwave rumble.
   */
  addExplosionShake(distance, maxRadius = 18.0, peakImpulse = 1.5) {
    if (distance >= maxRadius) return 0;
    const t = 1.0 - Math.min(1.0, distance / maxRadius);
    const impulse = peakImpulse * t * t; // Quadratic distance falloff
    this.trauma = Math.min(1.8, this.trauma + impulse);
    return impulse;
  }

  update(dt, userShakeSetting = 1.0) {
    const settingMul = Math.max(0, userShakeSetting);
    // Quadratic power curve: evaluate shake for the current frame before decay
    const currentShake = this.trauma * this.trauma * settingMul;
    this.trauma = Math.max(0, this.trauma - dt * this.decayRate);
    return currentShake;
  }

  reset() {
    this.trauma = 0;
  }
}
