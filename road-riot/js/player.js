// Road Riot 3D - Player Car Physics, Suspension Dynamics, Skid Marks, Airtime & Drones
import * as THREE from 'three';

// Shared Pooled Static Geometries & Base Materials to eliminate GC memory leaks
const SHARED_SKID_GEO = (() => {
  const g = new THREE.PlaneGeometry(0.34, 1.4);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const SHARED_SMOKE_GEO = new THREE.SphereGeometry(0.28, 6, 6);
const SHARED_SKID_MAT = new THREE.MeshBasicMaterial({
  color: 0x05080e,
  transparent: true,
  opacity: 0.6,
  depthWrite: false
});
const SHARED_SMOKE_MAT = new THREE.MeshBasicMaterial({
  color: 0x8899aa,
  transparent: true,
  opacity: 0.4,
  depthWrite: false
});

export const VEHICLE_ROSTER = {
  apex: {
    id: 'apex',
    name: 'Valixis Apex',
    tier: 'GT SPORT',
    desc: 'Precision aerodynamics & razor-sharp lane transition.',
    modelAsset: './assets/player-ferrari.glb',
    baseStats: { topSpeed: 28, accel: 30, handling: 32, nitro: 50, armor: 100 },
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
    baseStats: { topSpeed: 31, accel: 34, handling: 36, nitro: 55, armor: 85 },
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
    baseStats: { topSpeed: 26, accel: 26, handling: 25, nitro: 45, armor: 180 },
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
    baseStats: { topSpeed: 34, accel: 36, handling: 29, nitro: 60, armor: 120 },
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
    baseStats: { topSpeed: 38, accel: 44, handling: 40, nitro: 70, armor: 140 },
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

    // Chassis sub-group (for suspension pitch, roll & bounce)
    this.chassis = new THREE.Group();
    this.mesh.add(this.chassis);

    // Active car config & stats
    this.currentVehicleId = 'apex';
    this.paintColor = 0xd71920;
    this.underglowColor = 0x00d9ff;

    // Physical State
    this.x = 0;
    this.speed = 0;
    this.targetSpeed = 22;
    this.hull = 100;
    this.maxHull = 100;
    this.nitro = 50;
    this.maxNitro = 100;
    this.isBoosting = false;
    this.boostPadTimer = 0;
    this.isBrakingToHalt = false;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerInput = 0;
    this.steerAngle = 0;

    // Suspension Kinetics
    this.suspensionPitch = 0;
    this.suspensionRoll = 0;
    this.wheelRotation = 0;

    // Airtime & Stunt Jumps
    this.isAirborne = false;
    this.verticalY = 0;
    this.verticalVel = 0;
    this.gravity = -26;

    // Power-up States
    this.shieldActive = false;
    this.shieldTime = 0;
    this.magnetActive = false;
    this.magnetTime = 0;
    this.slowMoActive = false;
    this.slowMoTime = 0;
    this.droneActive = false;
    this.droneTime = 0;
    this.droneShootTimer = 0;
    this.activeWeapon = null;

    // Visual Sub-components
    this.carModel = null;
    this.underglowLight = null;
    this.exhaustFlames = [];
    this.shieldMesh = null;
    this.droneMesh = null;
    this.wheels = { fl: null, fr: null, rl: null, rr: null };

    // Skid marks & smoke
    this.skidMarks = [];
    this.smokeParticles = [];

    this.initVisuals();
  }

  initVisuals() {
    // 1. Soft Ambient Occlusion Contact Shadow Plane (Grounds player car on asphalt)
    const shadowGeo = new THREE.PlaneGeometry(2.6, 5.0);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x03060a,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.02;
    this.mesh.add(shadowMesh);

    // 2. Underglow Neon Point Light
    this.underglowLight = new THREE.PointLight(this.underglowColor, 3.0, 7.0);
    this.underglowLight.position.set(0, 0.25, 0);
    this.mesh.add(this.underglowLight);

    // 3. Dual Exhaust Nitro Jet Cones
    [-0.6, 0.6].forEach(x => {
      // Visual Flame Cone with luminous electric blue
      const coneGeo = new THREE.ConeGeometry(0.18, 0.9, 8);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0 });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(x, 0.45, 2.3);
      this.chassis.add(coneMesh);

      // Lightweight flame object for animation
      const flame = { userData: { cone: coneMesh } };
      this.exhaustFlames.push(flame);
    });

    // Shield Forcefield Bubble (Pulsing Hexagonal Energy)
    const shieldGeo = new THREE.IcosahedronGeometry(2.5, 2);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x9d4edd,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0,
      wireframe: true
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 0.8, 0);
    this.chassis.add(this.shieldMesh);

    // Drone Companion Mesh
    this.droneMesh = this.buildDroneMesh();
    this.droneMesh.visible = false;
    this.mesh.add(this.droneMesh);

    this.rebuildCarModel();
  }

  reset() {
    this.x = 0;
    this.speed = 0;
    this.targetSpeed = this.topSpeed;
    this.hull = this.maxHull;
    this.nitro = this.maxNitro * 0.5;
    this.isBoosting = false;
    this.boostPadTimer = 0;
    this.isBrakingToHalt = false;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.vx = 0;
    this.suspensionPitch = 0;
    this.suspensionRoll = 0;
    this.wheelRotation = 0;
    this.isAirborne = false;
    this.verticalY = 0;
    this.verticalVel = 0;
    this.shieldActive = false;
    this.shieldTime = 0;
    this.magnetActive = false;
    this.magnetTime = 0;
    this.slowMoActive = false;
    this.slowMoTime = 0;
    this.droneActive = false;
    this.droneTime = 0;

    this.mesh.position.set(0, 0, -8);
    this.mesh.rotation.set(0, 0, 0);
    if (this.chassis) {
      this.chassis.rotation.set(0, 0, 0);
    }
    if (this.shieldMesh && this.shieldMesh.material) {
      this.shieldMesh.material.opacity = 0;
    }
    if (this.droneMesh) {
      this.droneMesh.visible = false;
    }
    if (this.wheels.fl) this.wheels.fl.rotation.y = 0;
    if (this.wheels.fr) this.wheels.fr.rotation.y = 0;
  }

  buildDroneMesh() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x111e2e, metalness: 0.9, roughness: 0.2 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // Center Core
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), coreMat);
    group.add(core);

    // Wing Ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 20), mat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Twin Plasma Thrusters
    [-0.6, 0.6].forEach(x => {
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8), mat);
      jet.position.set(x, 0, 0);
      group.add(jet);

      const light = new THREE.PointLight(0x00ffff, 2.0, 4);
      light.position.set(x, -0.25, 0);
      group.add(light);
    });

    group.position.set(0, 2.8, -0.5);
    return group;
  }

  setVehicle(vehicleId, upgrades = {}, customPaint = null, customGlow = null) {
    this.currentVehicleId = vehicleId;
    const data = VEHICLE_ROSTER[vehicleId] || VEHICLE_ROSTER.apex;

    // Apply Upgrades (1 to 5 levels)
    const speedBonus = (upgrades.topSpeed || 0) * 4.2;
    const accelBonus = (upgrades.accel || 0) * 4.0;
    const handlingBonus = (upgrades.handling || 0) * 3.5;
    const armorBonus = (upgrades.armor || 0) * 20;
    const nitroBonus = (upgrades.nitro || 0) * 14;

    this.topSpeed = data.baseStats.topSpeed + speedBonus;
    this.accel = data.baseStats.accel + accelBonus;
    this.handling = data.baseStats.handling + handlingBonus;
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
      this.chassis.remove(this.carModel);
      this.carModel = null;
    }

    const proto = this.assetPrototypes[this.currentVehicleId] || this.assetPrototypes.player;
    if (proto) {
      const model = proto.clone(true);
      const isFerrari = (this.currentVehicleId === 'apex' || this.currentVehicleId === 'player');

      model.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          const newMats = mats.map(m => {
            const combined = `${node.name || ''} ${m.name || ''}`.toUpperCase();

            // 1. Cockpit Windshield & Windows
            if (/GLASS|WINDOW/i.test(combined)) {
              return new THREE.MeshStandardMaterial({
                color: /BLACK/i.test(combined) ? 0x05080e : 0x0a1c2e,
                metalness: 0.95,
                roughness: 0.05,
                transparent: true,
                opacity: /BLACK/i.test(combined) ? 0.85 : 0.65,
                depthWrite: false
              });
            }

            // 2. Rubber Tires (Treads & Sidewalls)
            if (/TYRE|TIRE|RUBBER|GT3PHONG1/i.test(combined)) {
              return new THREE.MeshStandardMaterial({
                color: 0x131518,
                roughness: 0.86,
                metalness: 0.05
              });
            }

            // 3. Alloy Rims, Chrome Badges & Brake Rotors
            if (/WHEEL|RIM|CHROME|ROTOR|BADGE|PHONG9|GT3ROTOR/i.test(combined)) {
              const isRotor = /ROTOR/i.test(combined);
              return new THREE.MeshStandardMaterial({
                color: isRotor ? 0x5a6068 : 0xebf2f8,
                metalness: 0.95,
                roughness: isRotor ? 0.35 : 0.12
              });
            }

            // 4. Carbon Fiber Aerodynamics (Splitter, Diffuser, Spoiler)
            if (/CARBON/i.test(combined)) {
              return new THREE.MeshStandardMaterial({
                color: 0x16181d,
                roughness: 0.38,
                metalness: 0.45
              });
            }

            // 5. Headlights & Taillights
            if (/LIGHT/i.test(combined)) {
              const isTail = /TAIL|REAR|BRAKE/i.test(combined);
              return new THREE.MeshStandardMaterial({
                color: isTail ? 0xff1644 : 0xccf2ff,
                emissive: isTail ? 0xff0525 : 0x00d9ff,
                emissiveIntensity: 3.2,
                roughness: 0.1,
                metalness: 0.8
              });
            }

            // 6. Primary High-Gloss Metallic Car Body Paint
            if (/CHASSIS|BODY|HOOD|DOOR|BOOT|BUMPER|PHONG4|COLORMAP/i.test(combined) || isFerrari) {
              // If material has an existing texture map (e.g., Kenney colormap, Ferrari livery), preserve map!
              if (m.map) {
                const cloned = m.clone();
                cloned.map.colorSpace = THREE.SRGBColorSpace;
                cloned.map.anisotropy = 16;
                cloned.map.flipY = false;
                cloned.roughness = 0.28;
                cloned.metalness = 0.65;
                return cloned;
              }
              return new THREE.MeshStandardMaterial({
                color: this.paintColor,
                metalness: 0.88,
                roughness: 0.18
              });
            }

            const cloned = m.clone();
            if (cloned.map) {
              cloned.map.colorSpace = THREE.SRGBColorSpace;
              cloned.map.anisotropy = 16;
            }
            return cloned;
          });

          node.material = Array.isArray(node.material) ? newMats : newMats[0];
        }
      });

      // Compute bounding box and normalize scale & center
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetScale = 5.2 / maxDim;
      model.scale.setScalar(targetScale);

      // Center model inside an inner pivot group
      const inner = new THREE.Group();
      inner.add(model);

      const scaledBox = new THREE.Box3().setFromObject(inner);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x = -center.x;
      model.position.y = -scaledBox.min.y;
      model.position.z = -center.z;

      // Rotate inner model so car nose points along -Z and rear faces +Z
      inner.rotation.y = Math.PI;

      // Wrap in an unrotated outer group aligned with standard track coordinates
      const wrapper = new THREE.Group();
      wrapper.add(inner);

      // Add Brilliant Headlights & Taillights in world coordinates
      this.attachVehicleLamps(wrapper);

      this.carModel = wrapper;
      this.chassis.add(this.carModel);
    } else {
      this.carModel = this.buildProceduralSupercar();
      this.chassis.add(this.carModel);
    }
  }

  attachVehicleLamps(parentGroup) {
    // Twin Xenon Forward Projectors (-Z)
    [-0.8, 0.8].forEach(x => {
      const headLamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xccf2ff })
      );
      headLamp.position.set(x, 0.55, -2.4);
      parentGroup.add(headLamp);

      const spot = new THREE.SpotLight(0xccf2ff, 3.5, 40, Math.PI / 6, 0.4);
      spot.position.set(x, 0.6, -2.3);
      spot.target.position.set(x * 0.4, 0, -35);
      parentGroup.add(spot);
      parentGroup.add(spot.target);
    });

    // Twin Neon Ruby Taillight Strips (+Z facing player)
    [-0.8, 0.8].forEach(x => {
      const tailLamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.09, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff1644 })
      );
      tailLamp.position.set(x, 0.68, 2.3);
      parentGroup.add(tailLamp);

      const glow = new THREE.PointLight(0xff1644, 2.0, 5.0);
      glow.position.set(x, 0.68, 2.35);
      parentGroup.add(glow);
    });
  }

  buildProceduralSupercar() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.paintColor,
      metalness: 0.9,
      roughness: 0.16
    });
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.5, roughness: 0.38 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x081828,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.72
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xebf2f8, metalness: 0.96, roughness: 0.12 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x131518, roughness: 0.86, metalness: 0.05 });

    // 1. Lower Sleek GT Monocoque
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.45, 4.5), bodyMat);
    base.position.y = 0.52;
    base.castShadow = true;
    group.add(base);

    // 2. Sculpted Aerodynamic Nose & Front Splitter
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.32, 1.4), bodyMat);
    nose.position.set(0, 0.42, -2.4);
    nose.rotation.x = 0.08;
    group.add(nose);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.6), carbonMat);
    splitter.position.set(0, 0.22, -2.75);
    group.add(splitter);

    // 3. Cockpit Canopy with Curvature
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.58, 2.2), glassMat);
    canopy.position.set(0, 0.95, 0.1);
    group.add(canopy);

    // 4. Side Skirts & Rear Carbon Diffuser
    [-1.15, 1.15].forEach(x => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.8), carbonMat);
      skirt.position.set(x, 0.25, 0.1);
      group.add(skirt);
    });

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.6), carbonMat);
    diffuser.position.set(0, 0.28, 2.3);
    group.add(diffuser);

    // 5. High-Downforce GT Carbon Wing
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 0.45), carbonMat);
    spoiler.position.set(0, 1.28, 2.05);
    group.add(spoiler);

    [-0.7, 0.7].forEach(x => {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.22), carbonMat);
      upright.position.set(x, 1.05, 1.95);
      group.add(upright);
    });

    // 6. Headlights & Taillights
    this.attachVehicleLamps(group);

    // 7. 4 Independent High-Detail Wheels (Rubber Tire + Chrome Alloy Rim + Hub)
    const createWheel = () => {
      const wheelGroup = new THREE.Group();
      // Outer Tire
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 20), rubberMat);
      tire.rotation.z = Math.PI / 2;
      wheelGroup.add(tire);
      // Chrome Rim Face
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.35, 12), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);
      // Center Cap / Caliper Accent
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.36, 8), bodyMat);
      cap.rotation.z = Math.PI / 2;
      wheelGroup.add(cap);
      return wheelGroup;
    };

    // Front Wheels (Steerable)
    this.wheels.fl = new THREE.Group();
    this.wheels.fl.position.set(-1.12, 0.44, -1.35);
    this.wheels.fl.add(createWheel());
    group.add(this.wheels.fl);

    this.wheels.fr = new THREE.Group();
    this.wheels.fr.position.set(1.12, 0.44, -1.35);
    this.wheels.fr.add(createWheel());
    group.add(this.wheels.fr);

    // Rear Wheels (Drive)
    this.wheels.rl = new THREE.Group();
    this.wheels.rl.position.set(-1.12, 0.44, 1.35);
    this.wheels.rl.add(createWheel());
    group.add(this.wheels.rl);

    this.wheels.rr = new THREE.Group();
    this.wheels.rr.position.set(1.12, 0.44, 1.35);
    this.wheels.rr.add(createWheel());
    group.add(this.wheels.rr);

    return group;
  }

  steer(inputDir, dt, sensitivity = 1.0) {
    this.steerInput = inputDir;

    // Progressive lateral steering momentum with smooth damping (eliminates robotic twitch)
    this.vx = this.vx || 0;
    const targetVx = inputDir * (this.handling * 0.52 * sensitivity);
    const damping = inputDir !== 0 ? 15 : 12;
    this.vx += (targetVx - this.vx) * Math.min(1, dt * damping);
    this.x = THREE.MathUtils.clamp(this.x + this.vx * dt, -7.2, 7.2);
    this.mesh.position.x = this.x;

    // Target Front Wheel Turn Angle
    const maxSpeedHandling = Math.max(1, this.handling * 0.52 * sensitivity);
    const normTurn = THREE.MathUtils.clamp(this.vx / maxSpeedHandling, -1, 1);
    const targetWheelTurn = normTurn * 0.45;
    this.steerAngle += (targetWheelTurn - this.steerAngle) * Math.min(1, dt * 14);
    if (this.wheels.fl && this.wheels.fr) {
      this.wheels.fl.rotation.y = this.steerAngle;
      this.wheels.fr.rotation.y = this.steerAngle;
    }

    // Suspension Body Roll into Turns
    const targetRoll = -normTurn * (this.isDrifting ? 0.22 : 0.12);
    this.suspensionRoll += (targetRoll - this.suspensionRoll) * Math.min(1, dt * 9);

    // Car Yaw Slide: In Three.js looking towards -Z, turning right (+X) points nose right
    const targetYaw = -normTurn * (this.isDrifting ? 0.38 : 0.09);
    this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * Math.min(1, dt * 8);
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

  triggerJump(launchVel = 14) {
    if (this.isAirborne) return;
    this.isAirborne = true;
    this.verticalVel = launchVel;
  }

  triggerSpeedBoost(multiplier = 1.62, duration = 2.2) {
    this.boostPadTimer = Math.max(this.boostPadTimer, duration);
    this.isBoosting = true;
    this.addNitro(35);
    // Instant kinetic surge
    this.speed = Math.max(this.speed, this.topSpeed * 1.35);
  }

  activateShield(duration = 8) {
    this.shieldActive = true;
    this.shieldTime = duration;
    if (this.shieldMesh) {
      this.shieldMesh.material.opacity = 0.65;
    }
  }

  activateMagnet(duration = 9) {
    this.magnetActive = true;
    this.magnetTime = duration;
  }

  activateSlowMo(duration = 4.5) {
    this.slowMoActive = true;
    this.slowMoTime = duration;
  }

  activateDrone(duration = 10) {
    this.droneActive = true;
    this.droneTime = duration;
    if (this.droneMesh) {
      this.droneMesh.visible = true;
    }
  }

  takeDamage(amount) {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTime = 0;
      if (this.shieldMesh) this.shieldMesh.material.opacity = 0;
      return 0; // completely absorbed!
    }
    this.hull = Math.max(0, this.hull - amount);
    // Impact nose dive pitch
    this.suspensionPitch = 0.25;
    return amount;
  }

  repair(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  addNitro(amount) {
    this.nitro = Math.min(this.maxNitro, this.nitro + amount);
  }

  spawnSkidMark(x, z) {
    if (this.skidMarks.length >= 30) {
      const old = this.skidMarks.shift();
      this.scene.remove(old.mesh);
      if (old.mesh.material) old.mesh.material.dispose();
    }
    const markMat = SHARED_SKID_MAT.clone();
    const mark = new THREE.Mesh(SHARED_SKID_GEO, markMat);
    mark.position.set(x, 0.02, z);
    this.scene.add(mark);
    this.skidMarks.push({ mesh: mark, life: 3.0 });
  }

  spawnSmokeParticle(pos) {
    if (this.smokeParticles.length >= 22) {
      const old = this.smokeParticles.shift();
      this.scene.remove(old.mesh);
      if (old.mesh.material) old.mesh.material.dispose();
    }
    const mat = SHARED_SMOKE_MAT.clone();
    const mesh = new THREE.Mesh(SHARED_SMOKE_GEO, mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.25;
    this.scene.add(mesh);
    this.smokeParticles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.2, 2.5),
      life: 0.6,
      maxLife: 0.6
    });
  }

  update(dt, onLandCallback = null) {
    // 1. Acceleration & Nitro Dynamics (Calibrated: 80-120 Stock, 150-160 Boost)
    if (this.isBrakingToHalt) {
      this.targetSpeed = 0;
      this.isBoosting = false;
      this.speed = Math.max(0, this.speed - dt * 42);
      this.suspensionPitch = 0.12; // Forward brake dive
    } else if (this.boostPadTimer > 0) {
      this.boostPadTimer -= dt;
      this.isBoosting = true;
      this.targetSpeed = this.topSpeed * 1.55;
      this.suspensionPitch = -0.10; // High-speed acceleration squat
      if (this.boostPadTimer <= 0 && this.nitro <= 0) {
        this.isBoosting = false;
      }
    } else if (this.isBoosting && this.nitro > 0) {
      this.nitro = Math.max(0, this.nitro - dt * 20);
      this.targetSpeed = this.topSpeed * 1.55;
      if (this.nitro <= 0) this.isBoosting = false;
      // Acceleration squat (rear dips, nose lifts)
      this.suspensionPitch = -0.08;
    } else if (this.isDrifting) {
      this.targetSpeed = this.topSpeed * 0.88;
      this.suspensionPitch = 0.03; // slight nose dip
    } else {
      this.targetSpeed = this.topSpeed;
      this.suspensionPitch *= 0.9;
    }

    // Smooth ground speed acceleration (only when not braking to halt)
    if (!this.isBrakingToHalt) {
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * (this.isBoosting ? 5.5 : 3.2));
    }

    // 2. Wheel Spinning Animation
    this.wheelRotation += (this.speed * dt) * 2.8;
    Object.values(this.wheels).forEach(w => {
      if (w && w.children[0]) {
        w.children[0].rotation.x = this.wheelRotation;
      }
    });

    // 3. Stunt Jump & Airtime Physics
    if (this.isAirborne) {
      this.verticalVel += this.gravity * dt;
      this.verticalY += this.verticalVel * dt;

      // Slight nose-up pitch in air
      this.chassis.rotation.x = -0.12;

      // Landing detection
      if (this.verticalY <= 0) {
        this.verticalY = 0;
        this.verticalVel = 0;
        this.isAirborne = false;
        this.suspensionPitch = 0.16; // heavy landing bounce!
        if (onLandCallback) onLandCallback();
      }
    } else {
      this.verticalY = 0;
      this.chassis.rotation.x = this.suspensionPitch;
    }

    this.mesh.position.y = this.verticalY + Math.sin(performance.now() * 0.008) * 0.02;
    this.chassis.rotation.y = 0; // Chassis yaw is strictly locked forward; steering yaw is applied to this.mesh
    this.chassis.rotation.z = this.suspensionRoll;

    // 4. Drift Tire Skids & Smoke
    if (this.isDrifting && this.speed > 14 && !this.isAirborne) {
      [-0.85, 0.85].forEach(offsetX => {
        const markPos = new THREE.Vector3(this.x + offsetX, 0, this.mesh.position.z + 1.2);
        this.spawnSkidMark(markPos.x, markPos.z);
        this.spawnSmokeParticle(markPos);
      });
    }

    // Update & Fade Skid Marks with Memory Cleanup
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const s = this.skidMarks[i];
      s.life -= dt;
      s.mesh.position.z += this.speed * dt; // Scrolls back with road
      s.mesh.material.opacity = Math.max(0, (s.life / 3.0) * 0.6);
      if (s.life <= 0 || s.mesh.position.z > 22) {
        this.scene.remove(s.mesh);
        if (s.mesh.material) s.mesh.material.dispose();
        this.skidMarks.splice(i, 1);
      }
    }

    // Update Smoke Particles with Memory Cleanup
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1.05);
      p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.4);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.material) p.mesh.material.dispose();
        this.smokeParticles.splice(i, 1);
      }
    }

    // 5. Exhaust Nitro Flames FX & Underglow Modulation
    if (this.underglowLight) {
      this.underglowLight.intensity = this.isBoosting ? 5.5 : 3.0;
    }
    this.exhaustFlames.forEach(f => {
      if (f.intensity !== undefined) f.intensity = this.isBoosting ? 6.5 : 0.8;
      if (f.userData && f.userData.cone) {
        f.userData.cone.material.opacity = this.isBoosting ? 0.92 : 0;
        f.userData.cone.scale.y = this.isBoosting ? 1.0 + Math.random() * 0.45 : 0.1;
      }
    });

    // 6. Drone Companion Wobble & Timer
    if (this.droneActive && this.droneMesh) {
      this.droneTime -= dt;
      this.droneMesh.position.y = 2.6 + Math.sin(performance.now() * 0.005) * 0.25;
      this.droneMesh.rotation.y += dt * 3.0;

      if (this.droneTime <= 0) {
        this.droneActive = false;
        this.droneMesh.visible = false;
      }
    }

    // 7. Shield & Magnet Timers
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

    if (this.magnetActive) {
      this.magnetTime -= dt;
      if (this.magnetTime <= 0) this.magnetActive = false;
    }
  }
}
