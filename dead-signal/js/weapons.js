// Weapon definitions and the first-person viewmodel (a second scene rendered
// over the world so the gun never clips into walls).
import * as THREE from 'three';

export const WEAPONS = [
  // Baseline targets: a walker (100 hp) dies to one pistol headshot, three
  // pistol body shots (~0.4 s), six SMG rounds (~0.37 s) or one point-blank
  // shell. Kept deliberately stable so headshots never stop working.
  {
    id: 'pistol', name: 'M9 SIDEARM', key: '1',
    damage: 40, magSize: 15, reserveMax: Infinity,
    rpm: 300, spread: 0.011, adsSpread: 0.0035, recoil: 1.6,
    pellets: 1, reloadTime: 1.45, auto: false, sound: 'pistol',
    falloffStart: 30, falloffEnd: 65, falloffMin: 0.6,
  },
  {
    id: 'smg', name: 'VECTOR-9', key: '2',
    damage: 19, magSize: 32, reserveMax: 224,
    rpm: 820, spread: 0.03, adsSpread: 0.014, recoil: 0.8,
    pellets: 1, reloadTime: 1.85, auto: true, sound: 'smg',
    falloffStart: 15, falloffEnd: 40, falloffMin: 0.5,
  },
  {
    id: 'shotgun', name: 'BREACHER 12', key: '3',
    damage: 11, magSize: 6, reserveMax: 48,
    rpm: 78, spread: 0.085, adsSpread: 0.055, recoil: 5.6,
    pellets: 12, reloadTime: 2.5, auto: false, sound: 'shotgun',
    falloffStart: 7, falloffEnd: 20, falloffMin: 0.3,
  },
];

function boxMesh(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

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
    this.root.position.set(0.24, -0.16, -0.5);
    this.root.scale.setScalar(0.55);
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
    const group = new THREE.Group();
    // Low metalness: without an environment map, metals render almost black
    // and the gun disappears against the night scene.
    const metal = new THREE.MeshStandardMaterial({ color: 0x596168, roughness: 0.52, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c3236, roughness: 0.7, metalness: 0.25 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x2a322c, roughness: 0.9, metalness: 0.05 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xb6ff74, emissive: 0x7fe02a, emissiveIntensity: 0.7, roughness: 0.5 });

    if (def.id === 'pistol') {
      group.add(boxMesh(0.09, 0.11, 0.34, metal, 0, 0, -0.1));
      group.add(boxMesh(0.075, 0.075, 0.2, dark, 0, 0.005, -0.31));
      group.add(boxMesh(0.085, 0.2, 0.11, grip, 0, -0.14, 0.03));
      group.add(boxMesh(0.05, 0.05, 0.05, accent, 0, 0.085, -0.22));
      group.add(boxMesh(0.02, 0.03, 0.02, metal, 0, 0.075, -0.02));
      group.add(boxMesh(0.02, 0.03, 0.02, metal, 0, 0.075, 0.06));
      group.userData.muzzle = new THREE.Vector3(0, 0.01, -0.42);
    } else if (def.id === 'smg') {
      group.add(boxMesh(0.1, 0.13, 0.42, metal, 0, 0, -0.12));
      group.add(boxMesh(0.05, 0.05, 0.26, dark, 0, 0.01, -0.42));
      group.add(boxMesh(0.07, 0.22, 0.1, grip, 0, -0.15, 0.02));
      group.add(boxMesh(0.06, 0.26, 0.09, dark, 0, -0.17, -0.16));
      group.add(boxMesh(0.08, 0.09, 0.14, dark, 0, -0.02, 0.16));
      group.add(boxMesh(0.03, 0.05, 0.03, accent, 0, 0.09, -0.3));
      group.add(boxMesh(0.03, 0.03, 0.2, metal, 0, 0.085, -0.06));
      group.userData.muzzle = new THREE.Vector3(0, 0.01, -0.56);
    } else {
      group.add(boxMesh(0.11, 0.13, 0.5, metal, 0, 0, -0.14));
      group.add(boxMesh(0.06, 0.06, 0.44, dark, 0, 0.02, -0.55));
      group.add(boxMesh(0.07, 0.2, 0.11, grip, 0, -0.14, 0.04));
      group.add(boxMesh(0.09, 0.08, 0.26, dark, 0, -0.03, -0.36));
      group.add(boxMesh(0.1, 0.09, 0.2, grip, 0, 0.01, 0.24));
      group.add(boxMesh(0.04, 0.04, 0.06, accent, 0, 0.09, -0.2));
      group.userData.muzzle = new THREE.Vector3(0, 0.02, -0.78);
    }

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
