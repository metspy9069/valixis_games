// Weapon definitions and the first-person viewmodel (a second scene rendered
// over the world so the gun never clips into walls).
import * as THREE from 'three';
import { buildGun, buildMelee } from './models.js';

import { WEAPONS } from './data.js';
export { WEAPONS };

/**
 * Critically damped 2nd-order spring simulation for organic viewmodel sway & inertia.
 * Semi-implicit integration provides unconditional numerical stability at any frame rate.
 */
export class DampedSpring {
  constructor(omega = 18, zeta = 1) {
    this.omega = omega; // Natural frequency (rad/s)
    this.zeta = zeta;   // Damping ratio (1 = critically damped)
    this.val = 0;
    this.vel = 0;
    this.target = 0;
  }

  update(dt) {
    dt = Math.min(0.05, Math.max(0.0001, dt));
    const f = 1 + 2 * dt * this.zeta * this.omega;
    const oo = this.omega * this.omega;
    const hoo = dt * oo;
    const hhoo = dt * hoo;
    const detInv = 1 / (f + hhoo);
    const detP = f * this.val + dt * this.vel + hhoo * this.target;
    const detV = this.vel + hoo * (this.target - this.val);
    this.val = detP * detInv;
    this.vel = detV * detInv;
    return this.val;
  }

  impulse(v) {
    this.vel += v;
  }

  setTarget(t) {
    this.target = t;
  }

  reset() {
    this.val = 0;
    this.vel = 0;
    this.target = 0;
  }
}

/**
 * Exact optical sight alignment offsets for each weapon (in root viewmodel local space).
 * Derived directly from each weapon model's iron sight notch / optic reticle coordinates.
 */
export const SIGHT_OFFSETS = [
  { id: 'pistol',  x: 0, y: -0.0346, z: -0.42 }, // M9 Sidearm (slide front/rear iron sights)
  { id: 'smg',     x: 0, y: -0.0576, z: -0.42 }, // Vector-9 (red-dot holographic optic)
  { id: 'shotgun', x: 0, y: -0.0324, z: -0.40 }, // Breacher 12 (front bead sight)
  { id: 'rifle',   x: 0, y: -0.0748, z: -0.34 }, // Longshot 7 (magnified optic scope center)
  { id: 'ripper',  x: 0, y: -0.0633, z: -0.42 }, // Ripper LMG (top cover sight rail)
];

export class ViewModel {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.index = 0;
    this.bob = 0;
    this.breathPhase = 0;
    this.kick = 0;
    this.kickRot = 0;
    this.sprintBlend = 0;
    this.adsBlend = 0;
    this.reloadBlend = 0;
    this.tuckBlend = 0;

    // 2nd-order spring physics for viewmodel sway & inertia
    this.swaySpringX = new DampedSpring(18, 1.0);
    this.swaySpringY = new DampedSpring(18, 1.0);
    this.rollSpring = new DampedSpring(16, 1.0);
    this.tuckSpring = new DampedSpring(24, 1.0);

    this.swayX = 0;
    this.swayY = 0;
    this.swayRoll = 0;

    this.root = new THREE.Group();
    this.root.position.set(0.175, -0.17, -0.46);
    this.root.scale.setScalar(0.72);
    scene.add(this.root);

    // The blade lives in the left hand for the whole run: it is a tool you
    // always have, not a pickup, and it keeps the close-range answer free.
    this.meleeRoot = new THREE.Group();
    this.meleeRoot.position.set(-0.27, -0.3, -0.5);
    this.meleeRoot.scale.setScalar(0.68);
    this.meleeRoot.rotation.set(0.1, 0.62, -0.34);
    scene.add(this.meleeRoot);
    this.meleeTier = -1;
    this.setMelee(0);
    this.meleeBob = 0;
    this.swingTimer = 0;
    this.swingDuration = 0.34;
    this.swingStep = 0;
    this.shoveTimer = 0;
    this.shoveDuration = 0.28;

    // Base pose: the gun is canted inward so the camera sees its flank, not
    // the end of the barrel.
    this.baseX = 0.02;
    this.baseY = 0.2;
    this.baseZ = 0.04;

    this.lights = new THREE.Group();
    this.root.add(this.lights);

    this.flashLight = new THREE.PointLight(0xffcf8a, 0, 6, 2);
    this.lights.add(this.flashLight);

    this.flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flashMesh.rotation.z = Math.PI / 4;
    this.lights.add(this.flashMesh);

    this.flashTimer = 0;
    this.models = WEAPONS.map((def, i) => this.buildModel(def, i));
    this.select(0, true);
  }

  buildModel(def, i) {
    // Built in models.js so the weapons share the same sculpted style as the
    // rest of the game. The muzzle point travels with the model.
    const group = buildGun(def.id);
    group.visible = i === 0;
    this.root.add(group);
    return group;
  }

  get def() { return WEAPONS[this.index]; }

  /** Swap the left-hand weapon as the run's blade tier changes. */
  setMelee(tier) {
    if (this.meleeTier === tier) return;
    this.meleeTier = tier;
    if (this.melee) this.meleeRoot.remove(this.melee);
    const kinds = ['knife', 'machete', 'bat'];
    this.melee = buildMelee(kinds[Math.max(0, Math.min(kinds.length - 1, tier))]);
    this.meleeRoot.add(this.melee);
  }

  select(index, silent = false) {
    this.index = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    this.models.forEach((m, i) => { m.visible = i === this.index; });
    this.kick = 0;
    this.reloadBlend = 0;
  }

  flash(scale = 1) {
    this.flashTimer = 0.055;
    this.flashScale = scale;
    const muzzle = this.models[this.index].userData.muzzle;
    this.flashMesh.position.copy(muzzle);
    this.flashMesh.position.z -= 0.05;
    this.flashMesh.material.opacity = 0.95 * scale;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
    this.flashMesh.scale.setScalar((0.8 + Math.random() * 0.6) * (0.55 + scale * 0.45));
    this.flashLight.position.copy(muzzle);
    this.flashLight.intensity = 14 * scale;
  }

  recoil(amount) {
    this.kick = Math.min(0.16, this.kick + amount * 0.014);
    this.kickRot = Math.min(0.5, this.kickRot + amount * 0.045);
  }

  /** Start one melee combo swing (`step`: 0 slash, 1 return cut, 2 overhead cleave). */
  swing(step = 0) {
    this.swingStep = step;
    this.swingDuration = step === 2 ? 0.42 : 0.32;
    this.swingTimer = this.swingDuration;
  }

  /** Start defensive shove / kick lunge animation. */
  shove() {
    this.shoveTimer = this.shoveDuration;
  }

  /** Update visual blood & wear scratches on the active melee weapon. */
  setMeleeWear(ratio) {
    if (this.melee && this.melee.userData && this.melee.userData.updateWear) {
      this.melee.userData.updateWear(ratio);
    }
  }

  update(dt, state) {
    const {
      moving = 0,
      sprinting = false,
      ads = false,
      reloading = false,
      mouseDX = 0,
      mouseDY = 0,
      grounded = true,
      wallDist = 99,
      staminaRatio = 1,
      aspect = 1.6,
      strafe = 0,
    } = state || {};

    const aspectK = Math.min(1.15, Math.max(0.34, aspect / 1.6));

    // 1. Organic Dynamic Breathing Cycle
    // Breath accelerates with sprint / low stamina, slows down during ADS (lung hold)
    const targetBreathFreq = ads ? 0.6 : (sprinting || staminaRatio < 0.4 ? 2.4 : 1.25);
    this.breathPhase += dt * targetBreathFreq * Math.PI * 2;
    const breathAmp = ads ? 0.0016 : (sprinting ? 0.008 : 0.0042);
    const breathX = Math.cos(this.breathPhase * 0.5) * breathAmp * 0.75;
    const breathY = Math.sin(this.breathPhase) * breathAmp;

    // 2. Walking Bob
    this.bob += dt * (5.8 + moving * 2.2);
    const moveBobAmp = (moving * 0.022) * (1 - this.adsBlend * 0.85);
    const bobX = Math.sin(this.bob) * moveBobAmp;
    const bobY = Math.abs(Math.cos(this.bob)) * moveBobAmp * 0.8;

    // 3. Critically Damped Spring Sway & Inertia
    // Mouse delta applies target displacement clamped to realistic ergonomics
    const swaySens = ads ? 0.00015 : 0.00045;
    const targetSwayX = Math.max(-0.045, Math.min(0.045, -mouseDX * swaySens));
    const targetSwayY = Math.max(-0.045, Math.min(0.045, -mouseDY * swaySens));
    this.swaySpringX.setTarget(targetSwayX);
    this.swaySpringY.setTarget(targetSwayY);

    // Roll into turns / strafes
    const targetRoll = Math.max(-0.06, Math.min(0.06, -mouseDX * 0.00028 - strafe * 0.03));
    this.rollSpring.setTarget(targetRoll);

    this.swayX = this.swaySpringX.update(dt);
    this.swayY = this.swaySpringY.update(dt);
    this.swayRoll = this.rollSpring.update(dt);

    // 4. Anti-Wall-Clipping Tactical Tuck (High-Ready)
    const tuckThreshold = 0.72; // metres
    const targetTuck = wallDist < tuckThreshold ? Math.max(0, Math.min(1, (tuckThreshold - wallDist) / 0.45)) : 0;
    this.tuckSpring.setTarget(targetTuck);
    this.tuckBlend = this.tuckSpring.update(dt);

    // 5. Exponential Frame-Rate Independent ADS Blend (Eliminates High-Hz Snap Popping)
    const adsTarget = ads ? 1 : 0;
    const adsSpeed = ads ? 14 : 12;
    this.adsBlend += (adsTarget - this.adsBlend) * (1 - Math.exp(-adsSpeed * dt));
    const adsK = this.adsBlend * this.adsBlend * (3 - 2 * this.adsBlend);

    // Other stance blends
    this.sprintBlend += ((sprinting ? 1 : 0) - this.sprintBlend) * (1 - Math.exp(-9 * dt));
    this.reloadBlend += ((reloading ? 1 : 0) - this.reloadBlend) * (1 - Math.exp(-11 * dt));
    this.kick += (0 - this.kick) * (1 - Math.exp(-16 * dt));
    this.kickRot += (0 - this.kickRot) * (1 - Math.exp(-14 * dt));

    // 6. True 3D Optical Sight Alignment
    const sight = SIGHT_OFFSETS[this.index] || SIGHT_OFFSETS[0];
    const hipX = 0.24 * aspectK;
    const hipY = -0.16;
    const hipZ = -0.5;

    const adsX = sight.x;
    const adsY = sight.y;
    const adsZ = sight.z;

    // Tuck adjustments (draws gun back & lowers slightly when pressed against a wall)
    const tuckZ = this.tuckBlend * 0.16;
    const tuckY = -this.tuckBlend * 0.06;
    const sprintDrop = this.sprintBlend * 0.09;
    const reloadDrop = this.reloadBlend * 0.12;

    // Apply combined positions
    this.root.position.x = hipX * (1 - adsK) + adsX * adsK + (bobX + breathX) + this.swayX * 2.8;
    this.root.position.y = hipY * (1 - adsK) + adsY * adsK + (bobY + breathY) - sprintDrop - reloadDrop + tuckY + this.swayY * 2.6;
    this.root.position.z = hipZ * (1 - adsK) + adsZ * adsK + this.kick + tuckZ;

    // Apply combined rotations
    // At hip: gun is canted. At ADS: sights are aligned straight (rot = 0).
    const hipRotX = this.baseX;
    const hipRotY = this.baseY;
    const hipRotZ = this.baseZ;

    const tuckRotX = this.tuckBlend * 0.48; // Barrels point up in high-ready
    const tuckRotY = -this.tuckBlend * 0.18;

    this.root.rotation.x = hipRotX * (1 - adsK) - this.kickRot + this.sprintBlend * 0.22 + this.reloadBlend * 0.55 + tuckRotX + this.swayY * 3.5;
    this.root.rotation.y = hipRotY * (1 - adsK) + this.swayX * 5.2 - this.sprintBlend * 0.3 + tuckRotY;
    this.root.rotation.z = hipRotZ * (1 - adsK) + this.swayRoll * 4.0 - this.reloadBlend * 0.35;

    if (!grounded) {
      this.root.position.y -= 0.025;
      this.root.rotation.x += 0.05;
    }

    this.updateMelee(dt, state, adsK);

    // Muzzle flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashMesh.material.opacity = 0;
        this.flashLight.intensity = 0;
      } else {
        const k = this.flashTimer / 0.055;
        const scale = this.flashScale === undefined ? 1 : this.flashScale;
        this.flashLight.intensity = 14 * scale * k;
        this.flashMesh.material.opacity = 0.9 * scale * k;
      }
    }
  }

  /**
   * Left arm. It carries the same bob and sway as the gun so the two hands
   * read as one body, then sweeps a diagonal cut across the frame on a swing.
   */
  updateMelee(dt, state, adsK = 0) {
    const { moving = 0, aspect = 1.6 } = state || {};
    this.meleeBob += dt * (5.4 + moving * 1.4);
    const aspectK = Math.min(1.15, Math.max(0.34, aspect / 1.6));

    let sx = 0, sy = 0, sz = 0, rx = 0, ry = 0, rz = 0;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const t = 1 - this.swingTimer / this.swingDuration;   // 0 -> 1
      const wind = Math.min(1, t / 0.24);
      const cut = Math.max(0, (t - 0.24) / 0.76);
      const ease = cut * cut * (3 - 2 * cut);
      if (this.swingStep === 1) {
        // Swing 2: Left-to-right return cut
        sx = 0.34 - ease * 0.38;
        sy = 0.08 * wind - ease * 0.06;
        sz = ease * 0.22;
        ry = 1.15 - ease * 1.65;
        rx = -0.25 + ease * 0.75;
        rz = -1.2 + ease * 1.45;
      } else if (this.swingStep === 2) {
        // Swing 3: Overhead downward cleave (heavy guard-break)
        sx = 0.16 * Math.sin(cut * Math.PI);
        sy = 0.28 * wind - ease * 0.44;
        sz = -0.05 * wind + ease * 0.28;
        rx = 0.75 * wind - ease * 1.85;
        ry = 0.22 * wind - ease * 0.3;
        rz = 0.15 * wind - ease * 0.25;
      } else {
        // Swing 1: Right-to-left horizontal slash
        sx = -0.02 + ease * 0.34;
        sy = 0.1 * wind - ease * 0.12;
        sz = ease * 0.2;
        ry = 0.62 - wind * 0.5 + ease * 1.5;
        rx = 0.1 - wind * 0.6 + ease * 1.0;
        rz = -0.34 + wind * 0.5 - ease * 1.35;
      }
    } else if (this.shoveTimer > 0) {
      this.shoveTimer = Math.max(0, this.shoveTimer - dt);
      const t = 1 - this.shoveTimer / this.shoveDuration;
      const thrust = Math.sin(t * Math.PI);
      sx = 0.18 * thrust;
      sy = 0.12 * thrust;
      sz = -0.22 * thrust;
      rx = -0.45 * thrust;
      ry = -0.55 * thrust;
      rz = 0.65 * thrust;
    }

    const bob = Math.sin(this.meleeBob) * (0.008 + moving * 0.012);
    // Left hand drops down cleanly during ADS so it never interferes with optical sight picture
    const adsDrop = adsK * 0.22;
    const tuckDrop = this.tuckBlend * 0.12;

    this.meleeRoot.position.set(
      (-0.27 + sx) * aspectK,
      -0.3 + sy - bob - adsDrop - tuckDrop - this.sprintBlend * 0.1,
      -0.5 + sz + this.swayX * 1.4,
    );
    this.meleeRoot.rotation.set(
      0.1 + rx + this.swayY * 2.4,
      0.62 + ry + this.swayX * 3,
      -0.34 + rz + this.sprintBlend * 0.2,
    );
  }

  /**
   * Muzzle position in WORLD space.
   *
   * The viewmodel renders in its own scene with the camera fixed at the
   * origin, so localToWorld() only gets us back to camera space. The camera
   * passed in here must be the PLAYER camera (the one that moves with the
   * view), not this.camera: that one never leaves the origin, so its matrix is
   * identity and every tracer started near the map origin instead of at the
   * gun.
   */
  muzzleWorld(target, worldCamera = this.camera) {
    this.scene.updateMatrixWorld(true);
    worldCamera.updateMatrixWorld(true);
    const m = this.models[this.index];
    const local = m.userData.muzzle.clone();
    m.localToWorld(local);
    if (worldCamera === this.camera) return target.copy(local);

    // The viewmodel is drawn through this.camera (58°) and the world through
    // worldCamera (78°). Copying the point straight across would put the
    // tracer's on-screen start above the barrel. Keep the barrel's screen
    // position and its depth: map to NDC through the viewmodel camera, then
    // back out along that same pixel under the world camera.
    const ndc = local.clone().project(this.camera);
    const depth = Math.max(0.2, -local.z);
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(worldCamera).sub(worldCamera.position).normalize();
    return target.copy(worldCamera.position).addScaledVector(dir, depth);
  }
}
