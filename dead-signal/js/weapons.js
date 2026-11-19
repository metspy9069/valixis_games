// Weapon definitions and the first-person viewmodel (a second scene rendered
// over the world so the gun never clips into walls).
import * as THREE from 'three';
import { buildGun } from './models.js';

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

  select(index, silent = false) {
    this.index = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    this.models.forEach((m, i) => { m.visible = i === this.index; });
    this.kick = 0;
    this.reloadBlend = 0;
  }

  flash() {
    this.flashTimer = 0.055;
    const muzzle = this.models[this.index].userData.muzzle;
    this.flashMesh.position.copy(muzzle);
    this.flashMesh.position.z -= 0.05;
    this.flashMesh.material.opacity = 0.95;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
    this.flashMesh.scale.setScalar(0.8 + Math.random() * 0.6);
    this.flashLight.position.copy(muzzle);
    this.flashLight.intensity = 14;
  }

  recoil(amount) {
    this.kick = Math.min(0.16, this.kick + amount * 0.014);
    this.kickRot = Math.min(0.5, this.kickRot + amount * 0.045);
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

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashMesh.material.opacity = 0;
        this.flashLight.intensity = 0;
      } else {
        this.flashLight.intensity = 14 * (this.flashTimer / 0.055);
        this.flashMesh.material.opacity = 0.9 * (this.flashTimer / 0.055);
      }
    }
  }

  muzzleWorld(target) {
    this.scene.updateMatrixWorld(true);
    const m = this.models[this.index];
    const local = m.userData.muzzle.clone();
    m.localToWorld(local);
    return target.copy(local);
  }
}
