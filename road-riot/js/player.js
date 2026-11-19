// Road Riot 3D - Player Car Physics, Garage Roster & Visual FX
import * as THREE from 'three';

export const VEHICLE_ROSTER = {
  apex: {
    id: 'apex',
    name: 'Valixis Apex',
    tier: 'GT SPORT',
    desc: 'Precision aerodynamics & razor-sharp lane transition.',
    modelAsset: './assets/player-ferrari.glb',
    baseStats: { topSpeed: 23, accel: 28, handling: 30, nitro: 25, armor: 100 },
    paint: 0xd71920, // Rosso Corsa
    glow: 0x00d9ff,
    cost: 0,
    unlocked: true
  },
  venom: {
    id: 'venom',
    name: 'Venom Drift-R',
    tier: 'DRIFT SPEC',
    desc: 'Lightweight chassis designed for massive drift streaks & slipstreams.',
    modelAsset: './assets/sports.glb',
    baseStats: { topSpeed: 25, accel: 32, handling: 35, nitro: 28, armor: 85 },
    paint: 0x9d4edd, // Cyber Purple
    glow: 0xff2a85,
    cost: 800,
    unlocked: false
  },
  titan: {
    id: 'titan',
    name: 'Titan Enforcer',
    tier: 'HEAVY ARMOR',
    desc: 'Reinforced plating that crushes obstacles and absorbs heavy hits.',
    modelAsset: './assets/suv.glb',
    baseStats: { topSpeed: 21, accel: 24, handling: 20, nitro: 22, armor: 160 },
    paint: 0x223548, // Midnight Navy
    glow: 0x00ff88,
    cost: 1500,
    unlocked: false
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom V8',
    tier: 'INTERCEPTOR',
    desc: 'Raw twin-turbo muscle car with rapid nitrous recharge.',
    modelAsset: './assets/van.glb',
    baseStats: { topSpeed: 27, accel: 35, handling: 25, nitro: 35, armor: 110 },
    paint: 0xffb800, // Electric Gold
    glow: 0xff8800,
    cost: 2500,
    unlocked: false
  },
  hyperion: {
    id: 'hyperion',
    name: 'Lamborghini Hyperion',
    tier: 'CYBER HYPERCAR',
    desc: 'The ultimate prototype. Breaks the Mach barrier with hyper-drive.',
    modelAsset: './assets/player-lamborghini.glb',
    baseStats: { topSpeed: 32, accel: 42, handling: 38, nitro: 45, armor: 130 },
    paint: 0x05c2d6, // Electric Cyan
    glow: 0x00d9ff,
    cost: 5000,
    unlocked: false
  }
};

export class PlayerCar {
  constructor(scene, assetPrototypes = {}) {
    this.scene = scene;
    this.assetPrototypes = assetPrototypes;

    // Root 3D Object
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, -8);
    this.scene.add(this.mesh);

    // Active car config & stats
    this.currentVehicleId = 'apex';
    this.paintColor = 0xd71920;
    this.underglowColor = 0x00d9ff;

    // Physical State
    this.x = 0;
    this.targetX = 0;
    this.speed = 0;
    this.targetSpeed = 22;
    this.hull = 100;
    this.maxHull = 100;
    this.nitro = 50;
    this.maxNitro = 100;
    this.isBoosting = false;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerAngle = 0;

    // Power-up States
    this.shieldActive = false;
    this.shieldTime = 0;
    this.magnetActive = false;
    this.magnetTime = 0;
    this.slowMoActive = false;
    this.slowMoTime = 0;
    this.activeWeapon = null;

    // Visual Sub-components
    this.carModel = null;
    this.underglowLight = null;
    this.exhaustFlames = [];
    this.shieldMesh = null;
    this.particles = [];

    this.initVisuals();
  }

  initVisuals() {
    // Underglow Neon Point Light
    this.underglowLight = new THREE.PointLight(this.underglowColor, 3.5, 7.5);
    this.underglowLight.position.set(0, 0.2, 0);
    this.mesh.add(this.underglowLight);

    // Dual Exhaust Nitro Lights
    [-0.6, 0.6].forEach(x => {
      const flame = new THREE.PointLight(0x00f0ff, 0, 5);
      flame.position.set(x, 0.45, 2.2);
      this.mesh.add(flame);
      this.exhaustFlames.push(flame);

      // Visual Flame Cone
      const coneGeo = new THREE.ConeGeometry(0.18, 0.85, 8);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff, transparent: true, opacity: 0 });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(x, 0.45, 2.3);
      this.mesh.add(coneMesh);
      flame.userData.cone = coneMesh;
    });

    // Shield Forcefield Bubble (Pulsing Hexagonal Energy)
    const shieldGeo = new THREE.IcosahedronGeometry(2.4, 2);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x9d4edd,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 0.8, 0);
    this.mesh.add(this.shieldMesh);

    // Build procedural fallback or attach 3D model
    this.rebuildCarModel();
  }

  setVehicle(vehicleId, upgrades = {}, customPaint = null, customGlow = null) {
    this.currentVehicleId = vehicleId;
    const data = VEHICLE_ROSTER[vehicleId] || VEHICLE_ROSTER.apex;

    // Apply Upgrades (1 to 5 levels)
    const speedBonus = (upgrades.topSpeed || 0) * 1.8;
    const armorBonus = (upgrades.armor || 0) * 15;
    const nitroBonus = (upgrades.nitro || 0) * 12;

    this.topSpeed = data.baseStats.topSpeed + speedBonus;
    this.accel = data.baseStats.accel;
    this.handling = data.baseStats.handling;
    this.maxHull = data.baseStats.armor + armorBonus;
    this.hull = this.maxHull;
    this.maxNitro = data.baseStats.nitro + nitroBonus;
    this.nitro = this.maxNitro * 0.5;

    this.paintColor = customPaint !== null ? customPaint : data.paint;
    this.underglowColor = customGlow !== null ? customGlow : data.glow;

    if (this.underglowLight) {
      this.underglowLight.color.setHex(this.underglowColor);
    }

    this.rebuildCarModel();
  }

  rebuildCarModel() {
    if (this.carModel) {
      this.mesh.remove(this.carModel);
      this.carModel = null;
    }

    const proto = this.assetPrototypes[this.currentVehicleId] || this.assetPrototypes.player;
    if (proto) {
      // Clone imported 3D GLTF model
      const model = proto.clone(true);
      model.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = Array.isArray(node.material)
            ? node.material.map(m => m.clone())
            : node.material.clone();
          const preserve = /wheel|tire|rubber|glass|window|light|lamp|chrome|mirror/i.test(
            `${node.name} ${node.material.name || ''}`
          );
          if (!preserve) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(m => {
              if (m.color) m.color.setHex(this.paintColor);
              if (m.emissive) m.emissive.setHex(0x000000);
            });
          }
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(5.2 / maxDim);
      model.rotation.y = Math.PI; // Face forward along -Z
      this.carModel = model;
      this.mesh.add(this.carModel);
    } else {
      // High detail procedural supercar fallback
      this.carModel = this.buildProceduralSupercar();
      this.mesh.add(this.carModel);
    }
  }

  buildProceduralSupercar() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.paintColor,
      metalness: 0.85,
      roughness: 0.25
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x090f18, metalness: 0.4, roughness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x071e33,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.88
    });

    // Lower Chassis
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 4.4), bodyMat);
    base.position.y = 0.55;
    base.castShadow = true;
    group.add(base);

    // Aerodynamic Nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 1.4), bodyMat);
    nose.position.set(0, 0.45, -2.4);
    nose.rotation.x = 0.08;
    group.add(nose);

    // Cockpit Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.0), glassMat);
    canopy.position.set(0, 0.95, 0.1);
    group.add(canopy);

    // Cyber Spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.4), darkMat);
    spoiler.position.set(0, 1.25, 2.0);
    group.add(spoiler);

    // Headlights
    [-0.75, 0.75].forEach(x => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      head.position.set(x, 0.6, -3.05);
      group.add(head);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0xff1649 }));
      tail.position.set(x, 0.65, 2.22);
      group.add(tail);
    });

    // 4 Wheels
    [-1.0, 1.0].forEach(x => {
      [-1.35, 1.35].forEach(z => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.44, 0.44, 0.32, 16),
          new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.9 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.44, z);
        group.add(wheel);
      });
    });

    return group;
  }

  steer(inputDir, dt) {
    // Smooth lane steering (-7 to +7 meters road bounds)
    const steerSpeed = (this.handling * 0.45) * dt;
    this.x = THREE.MathUtils.clamp(this.x + inputDir * steerSpeed, -7.2, 7.2);

    // Body roll / tilt into turns
    const targetTilt = -inputDir * (this.isDrifting ? 0.22 : 0.12);
    this.mesh.rotation.z += (targetTilt - this.mesh.rotation.z) * Math.min(1, dt * 10);
    this.mesh.rotation.y = (inputDir * 0.08 - this.mesh.rotation.y) * Math.min(1, dt * 8);

    this.mesh.position.x = this.x;
  }

  setDrift(drifting) {
    this.isDrifting = drifting;
  }

  setBoost(boosting) {
    if (boosting && this.nitro > 0) {
      this.isBoosting = true;
    } else {
      this.isBoosting = false;
    }
  }

  activateShield(duration = 7) {
    this.shieldActive = true;
    this.shieldTime = duration;
    if (this.shieldMesh) {
      this.shieldMesh.material.opacity = 0.65;
    }
  }

  activateMagnet(duration = 8) {
    this.magnetActive = true;
    this.magnetTime = duration;
  }

  activateSlowMo(duration = 4.5) {
    this.slowMoActive = true;
    this.slowMoTime = duration;
  }

  takeDamage(amount) {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTime = 0;
      if (this.shieldMesh) this.shieldMesh.material.opacity = 0;
      return 0; // absorbed!
    }
    this.hull = Math.max(0, this.hull - amount);
    return amount;
  }

  repair(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  addNitro(amount) {
    this.nitro = Math.min(this.maxNitro, this.nitro + amount);
  }

  update(dt) {
    // Nitro Consumption / Regeneration
    if (this.isBoosting && this.nitro > 0) {
      this.nitro = Math.max(0, this.nitro - dt * 24);
      this.targetSpeed = this.topSpeed * 1.45;
      if (this.nitro <= 0) this.isBoosting = false;
    } else {
      this.targetSpeed = this.isDrifting ? this.topSpeed * 0.85 : this.topSpeed;
    }

    // Smooth speed acceleration
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * (this.isBoosting ? 5.5 : 3.0));

    // Exhaust Nitro Flames FX
    this.exhaustFlames.forEach(f => {
      f.intensity = this.isBoosting ? 6.5 : 0.8;
      if (f.userData.cone) {
        f.userData.cone.material.opacity = this.isBoosting ? 0.9 : 0;
        f.userData.cone.scale.y = this.isBoosting ? 1.0 + Math.random() * 0.4 : 0.1;
      }
    });

    // Shield Rotation & Pulse
    if (this.shieldActive) {
      this.shieldTime -= dt;
      if (this.shieldMesh) {
        this.shieldMesh.rotation.y += dt * 2.5;
        this.shieldMesh.rotation.x += dt * 1.8;
        if (this.shieldTime <= 0) {
          this.shieldActive = false;
          this.shieldMesh.material.opacity = 0;
        }
      }
    }

    // Magnet Countdown
    if (this.magnetActive) {
      this.magnetTime -= dt;
      if (this.magnetTime <= 0) this.magnetActive = false;
    }

    // Slow-Mo Countdown
    if (this.slowMoActive) {
      this.slowMoTime -= dt;
      if (this.slowMoTime <= 0) this.slowMoActive = false;
    }

    // Subtle idle chassis suspension float
    this.mesh.position.y = Math.sin(performance.now() * 0.008) * 0.03;
  }
}
