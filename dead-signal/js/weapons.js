// Weapon definitions and the first-person viewmodel (a second scene rendered
// over the world so the gun never clips into walls).
import * as THREE from 'three';
import { buildGun, buildMelee } from './models.js';

import { WEAPONS } from './data.js';
export { WEAPONS };

export class ViewModel {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.index = 0;
    this.bob = 0;
    this.kick = 0;
    this.kickRot = 0;
    this.sprintBlend = 0;
    this.adsBlend = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.reloadBlend = 0;

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

  /** Start one machete swing; the animation is driven from update(). */
  swing() {
    this.swingTimer = this.swingDuration;
  }

  update(dt, state) {
    const { moving = 0, sprinting = false, ads = false, reloading = false, mouseDX = 0, mouseDY = 0, grounded = true } = state || {};

    this.bob += dt * (6 + moving * 1.6);
    this.sprintBlend += ((sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 9);
    this.adsBlend += ((ads ? 1 : 0) - this.adsBlend) * Math.min(1, dt * 12);

    // Mouse sway lags the camera slightly, which sells the weight.
    this.swayX += (-mouseDX * 0.00035 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (-mouseDY * 0.00035 - this.swayY) * Math.min(1, dt * 8);

    this.kick += (0 - this.kick) * Math.min(1, dt * 14);
    this.kickRot += (0 - this.kickRot) * Math.min(1, dt * 12);
    this.reloadBlend += ((reloading ? 1 : 0) - this.reloadBlend) * Math.min(1, dt * 10);

    const bobAmp = (0.012 + moving * 0.02) * (1 - this.adsBlend * 0.75);
    const bx = Math.sin(this.bob) * bobAmp;
    const by = Math.abs(Math.cos(this.bob)) * bobAmp * 0.8;

    // The viewmodel camera shares the window aspect, so on a narrow/portrait
    // window the fixed hip offset would push the gun off the right edge.
    const aspect = state.aspect || 1.6;
    const aspectK = Math.min(1.15, Math.max(0.34, aspect / 1.6));

    const hipX = 0.24 - this.adsBlend * 0.24;
    const hipY = -0.16 + this.adsBlend * 0.09;
    const hipZ = -0.5 + this.adsBlend * 0.1;

    const sprintDrop = this.sprintBlend * 0.09;
    const reloadDrop = this.reloadBlend * 0.12;

    this.root.position.x = hipX * aspectK + bx + this.swayX * 3;
    this.root.position.y = hipY + by - sprintDrop - reloadDrop + this.swayY * 3;
    this.root.position.z = hipZ + this.kick;

    this.root.rotation.x = this.baseX - this.kickRot + this.sprintBlend * 0.22 + this.reloadBlend * 0.55;
    this.root.rotation.y = this.baseY + this.swayX * 6 - this.sprintBlend * 0.3 - this.adsBlend * 0.14;
    this.root.rotation.z = this.baseZ + this.swayY * 5 - this.reloadBlend * 0.35;

    if (!grounded) {
      this.root.position.y -= 0.03;
      this.root.rotation.x += 0.06;
    }

    this.updateMelee(dt, state);

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
  updateMelee(dt, state) {
    const { moving = 0, ads = false, aspect = 1.6 } = state || {};
    this.meleeBob += dt * (5.4 + moving * 1.4);
    const aspectK = Math.min(1.15, Math.max(0.34, aspect / 1.6));

    let sx = 0, sy = 0, sz = 0, rx = 0, ry = 0, rz = 0;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const t = 1 - this.swingTimer / this.swingDuration;   // 0 -> 1
      // Wind up briefly, then cut across and recover.
      const wind = Math.min(1, t / 0.24);
      const cut = Math.max(0, (t - 0.24) / 0.76);
      const ease = cut * cut * (3 - 2 * cut);
      sx = -0.02 + ease * 0.34;
      sy = 0.1 * wind - ease * 0.12;
      sz = ease * 0.2;
      ry = 0.62 - wind * 0.5 + ease * 1.5;
      rx = 0.1 - wind * 0.6 + ease * 1.0;
      rz = -0.34 + wind * 0.5 - ease * 1.35;
    }

    const bob = Math.sin(this.meleeBob) * (0.008 + moving * 0.012);
    const drop = ads ? 0.12 : 0;
    this.meleeRoot.position.set(
      (-0.27 + sx) * aspectK,
      -0.3 + sy - bob - drop - this.sprintBlend * 0.1,
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
    return target.copy(local).applyMatrix4(worldCamera.matrixWorld);
  }
}
