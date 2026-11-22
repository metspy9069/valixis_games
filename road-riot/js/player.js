// Road Riot 3D - Player Car Physics, Suspension Dynamics, Skid Marks & Airtime
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
    name: 'Valixis Apex GT',
    tier: 'GT SPORT',
    desc: 'Precision Italian aerodynamics, razor-sharp lane handling, and balanced track performance.',
    modelAsset: './assets/player-apex.glb',
    baseStats: { topSpeed: 28, accel: 32, handling: 34, nitro: 50, armor: 100 },
    paint: 0xd71920, // Valixis Apex Red
    glow: 0x00d9ff,
    cost: 0,
    unlocked: true
  },
  venom: {
    id: 'venom',
    name: 'Venom Drift-R',
    tier: 'DRIFT SPEC',
    desc: 'Lightweight carbon chassis engineered for high-angle corner slides and slipstream slingshots.',
    modelAsset: './assets/venom.glb',
    baseStats: { topSpeed: 31, accel: 35, handling: 38, nitro: 55, armor: 85 },
    paint: 0x9d4edd, // Cyber Purple
    glow: 0xff2a85,
    cost: 800,
    unlocked: false
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom GT V8',
    tier: 'SUPER SEDAN',
    desc: 'Twin-turbo executive sport sedan with brutal straight-line acceleration and rapid nitrous recharge.',
    modelAsset: './assets/phantom.glb',
    baseStats: { topSpeed: 33, accel: 38, handling: 31, nitro: 60, armor: 110 },
    paint: 0xffb800, // Electric Gold
    glow: 0xff8800,
    cost: 1500,
    unlocked: false
  },
  interceptor: {
    id: 'interceptor',
    name: 'Highway Interceptor',
    tier: 'PURSUIT SPEC',
    desc: 'Reinforced high-output police cruiser with front tactical push-bar and active siren strobes.',
    modelAsset: './assets/interceptor.glb',
    baseStats: { topSpeed: 34, accel: 36, handling: 33, nitro: 65, armor: 160 },
    paint: 0x0c121e, // Stealth Midnight
    glow: 0x00d9ff,
    cost: 2400,
    unlocked: false
  },
  titan: {
    id: 'titan',
    name: 'Titan Juggernaut',
    tier: 'HEAVY ARMOR',
    desc: 'Heavy-duty armored tactical SUV. Crushes oncoming traffic and shrugs off massive collisions.',
    modelAsset: './assets/titan.glb',
    baseStats: { topSpeed: 27, accel: 28, handling: 26, nitro: 45, armor: 220 },
    paint: 0x1e2d3d, // Battleship Slate
    glow: 0x00ff88,
    cost: 3500,
    unlocked: false
  },
  hyperion: {
    id: 'hyperion',
    name: 'Valixis Hyperion GTR',
    tier: 'CYBER HYPERCAR',
    desc: 'The apex prototype. Advanced ground-effect downforce and twin-electric hyperdrive breaking 320+ KM/H.',
    modelAsset: './assets/player-hyperion.glb',
    baseStats: { topSpeed: 40, accel: 46, handling: 42, nitro: 75, armor: 140 },
    paint: 0x00f0ff, // Luminous Cyan
    glow: 0x00ffff,
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
    this.isBraking = false;
    this.isBrakingToHalt = false;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.rampElevation = 0;
    this.rampPitch = 0;

    // Suspension Kinetics
    this.suspensionPitch = 0;
    this.targetPitch = 0;
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

    // Visual Sub-components
    this.carModel = null;
    this.underglowLight = null;
    this.exhaustFlames = [];
    this.shieldMesh = null;
    this.wheels = { fl: null, fr: null, rl: null, rr: null };

    // Skid marks & smoke
    this.skidMarks = [];
    this.smokeParticles = [];

    this.initVisuals();
  }

  buildContactShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Ultra-soft outer ambient occlusion drop shadow (large Gaussian falloff)
    const outerGrad = ctx.createRadialGradient(256, 256, 30, 256, 256, 235);
    outerGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    outerGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.52)');
    outerGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.22)');
    outerGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.ellipse(256, 256, 185, 235, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Chassis Core & Deep Floor Underbody Occlusion (Medium soft ellipse)
    const coreGrad = ctx.createRadialGradient(256, 250, 15, 256, 250, 160);
    coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    coreGrad.addColorStop(0.50, 'rgba(0, 0, 0, 0.60)');
    coreGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.20)');
    coreGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(256, 250, 140, 185, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. 4 Softly Feathered Tire Contact Footprints (FL, FR, RL, RR)
    const tirePositions = [
      { x: 138, y: 140, rx: 30, ry: 46 }, // Front Left
      { x: 374, y: 140, rx: 30, ry: 46 }, // Front Right
      { x: 138, y: 370, rx: 34, ry: 54 }, // Rear Left
      { x: 374, y: 370, rx: 34, ry: 54 }  // Rear Right
    ];

    tirePositions.forEach(tp => {
      const tireGrad = ctx.createRadialGradient(tp.x, tp.y, 6, tp.x, tp.y, tp.rx * 1.4);
      tireGrad.addColorStop(0, 'rgba(0, 0, 0, 0.90)');
      tireGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.65)');
      tireGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = tireGrad;
      ctx.beginPath();
      ctx.ellipse(tp.x, tp.y, tp.rx * 1.3, tp.ry * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Soft Front Aerodynamic Splitter & Rear Diffuser Shadows (smooth feathered ellipses, NO hard fillRect!)
    const frontGrad = ctx.createRadialGradient(256, 85, 10, 256, 85, 120);
    frontGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    frontGrad.addColorStop(0.60, 'rgba(0, 0, 0, 0.25)');
    frontGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.ellipse(256, 85, 110, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    const rearGrad = ctx.createRadialGradient(256, 425, 10, 256, 425, 120);
    rearGrad.addColorStop(0, 'rgba(0, 0, 0, 0.60)');
    rearGrad.addColorStop(0.60, 'rgba(0, 0, 0, 0.30)');
    rearGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = rearGrad;
    ctx.beginPath();
    ctx.ellipse(256, 425, 115, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  initVisuals() {
    // 1. Soft Ambient Occlusion Contact Shadow Plane (Grounds player car on asphalt/turntable)
    const shadowTex = this.buildContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(3.1, 5.7);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.76,
      depthWrite: false
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.y = 0.008;
    this.mesh.add(this.shadowMesh);

    // 2. Underglow Neon Point Light
    this.underglowLight = new THREE.PointLight(this.underglowColor, 3.0, 7.0);
    this.underglowLight.position.set(0, 0.25, 0);
    this.mesh.add(this.underglowLight);

    // 3. Dual Exhaust Nitro Jet Cones (Hypersonic Diamond Plasma Plumes)
    [-0.6, 0.6].forEach(x => {
      const jetGroup = new THREE.Group();
      jetGroup.position.set(x, 0.45, 2.3);

      // Outer Cyan Plasma Flame Cone
      const coneGeo = new THREE.ConeGeometry(0.18, 1.1, 8);
      coneGeo.rotateX(-Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0 });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      jetGroup.add(coneMesh);

      // Inner Diamond White Core Cone
      const coreGeo = new THREE.ConeGeometry(0.09, 0.7, 8);
      coreGeo.rotateX(-Math.PI / 2);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.z = -0.05;
      jetGroup.add(coreMesh);

      // Exhaust Tip Flare Point Light
      const flareLight = new THREE.PointLight(0x00d9ff, 0, 4.0);
      flareLight.position.set(0, 0, 0.2);
      jetGroup.add(flareLight);

      this.chassis.add(jetGroup);
      this.exhaustFlames.push({ cone: coneMesh, core: coreMesh, light: flareLight });
    });

    // 4. High-Detail Xenon Forward Projector Headlights
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0.1, -40);
    this.mesh.add(this.headlightTarget);

    this.headlight = new THREE.SpotLight(0xdcf2ff, 5.0, 55, Math.PI / 4.2, 0.45, 1.2);
    this.headlight.position.set(0, 0.85, -2.4);
    this.headlight.target = this.headlightTarget;
    this.mesh.add(this.headlight);

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
    this.isBraking = false;
    this.isBrakingToHalt = false;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.vx = 0;
    this.suspensionPitch = 0;
    this.targetPitch = 0;
    this.suspensionRoll = 0;
    this.wheelRotation = 0;
    this.isAirborne = false;
    this.verticalY = 0;
    this.verticalVel = 0;
    this.rampElevation = 0;
    this.rampPitch = 0;
    this.shieldActive = false;
    this.shieldTime = 0;
    this.magnetActive = false;
    this.magnetTime = 0;
    this.slowMoActive = false;
    this.slowMoTime = 0;
    this.mesh.position.set(0, 0, -8);
    this.mesh.rotation.set(0, 0, 0);
    if (this.chassis) {
      this.chassis.rotation.set(0, 0, 0);
    }
    if (this.shieldMesh && this.shieldMesh.material) {
      this.shieldMesh.material.opacity = 0;
    }
    if (this.wheels.fl) this.wheels.fl.rotation.y = 0;
    if (this.wheels.fr) this.wheels.fr.rotation.y = 0;
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
      const isApexModel = (this.currentVehicleId === 'apex' || this.currentVehicleId === 'player');

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
            if (/CHASSIS|BODY|HOOD|DOOR|BOOT|BUMPER|PHONG4|COLORMAP/i.test(combined) || isApexModel) {
              // If material has an existing texture map (e.g., Kenney colormap), preserve map!
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

      // Rig Wheel Pivots and Spinners for Animation
      this.setupWheelRig(model);

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

  setupWheelRig(model) {
    this.wheels = { fl: null, fr: null, rl: null, rr: null };
    this.wheelSpinners = [];

    // Check Pattern 1: Custom Blender supercars (venom, phantom, interceptor, titan)
    const hasBlenderWheels = Boolean(model.getObjectByName('FL_Tire'));
    if (hasBlenderWheels) {
      ['FL', 'FR', 'RL', 'RR'].forEach(prefix => {
        const parts = [];
        model.traverse(node => {
          if (node.name && node.name.startsWith(prefix + '_') && !node.name.includes('Caliper')) {
            parts.push(node);
          }
        });
        if (parts.length > 0) {
          const center = parts[0].position.clone();
          const pivot = new THREE.Group();
          pivot.name = prefix + '_SteerPivot';
          pivot.position.copy(center);

          const spinner = new THREE.Group();
          spinner.name = prefix + '_SpinGroup';
          pivot.add(spinner);

          parts.forEach(p => {
            p.position.sub(center);
            spinner.add(p);
          });

          model.add(pivot);
          this.wheels[prefix.toLowerCase()] = pivot;
          this.wheelSpinners.push(spinner);
        }
      });
      return;
    }

    // Check Pattern 2: Apex GT (player-apex.glb)
    const apexFL = model.getObjectByName('gt3:LOD_A_WHEEL_mm_wheel1');
    const apexFR = model.getObjectByName('gt3:LOD_A_WHEEL_mm_wheel');
    const apexRL = model.getObjectByName('gt3:LOD_A_WHEEL_REAR_mm_wheel1');
    const apexRR = model.getObjectByName('gt3:LOD_A_WHEEL_REAR_mm_wheel');
    if (apexFL && apexFR) {
      this.wheels.fl = apexFL;
      this.wheels.fr = apexFR;
      this.wheels.rl = apexRL;
      this.wheels.rr = apexRR;
      [apexFL, apexFR, apexRL, apexRR].filter(Boolean).forEach(w => {
        this.wheelSpinners.push(w);
      });
      return;
    }

    // Check Pattern 3: Hyperion GTR (player-hyperion.glb)
    let hyperionFL = null, hyperionFR = null, hyperionRL = null, hyperionRR = null;
    model.traverse(n => {
      if (!n.name) return;
      if (/3DWheel Front L/i.test(n.name)) hyperionFL = n;
      else if (/3DWheel Front R/i.test(n.name)) hyperionFR = n;
      else if (/3DWheel Rear L/i.test(n.name)) hyperionRL = n;
      else if (/3DWheel Rear R/i.test(n.name)) hyperionRR = n;
    });
    if (hyperionFL && hyperionFR) {
      this.wheels.fl = hyperionFL;
      this.wheels.fr = hyperionFR;
      this.wheels.rl = hyperionRL;
      this.wheels.rr = hyperionRR;
      [hyperionFL, hyperionFR, hyperionRL, hyperionRR].filter(Boolean).forEach(w => {
        this.wheelSpinners.push(w);
      });
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

    group.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    return group;
  }

  steer(inputDir, dt, sensitivity = 1.0) {
    this.steerInput = inputDir;

    // Progressive lateral steering momentum with smooth damping (eliminates robotic twitch)
    this.vx = this.vx || 0;
    const targetVx = inputDir * (this.handling * 0.52 * sensitivity);
    const damping = inputDir !== 0 ? 14 : 9.5;
    this.vx += (targetVx - this.vx) * Math.min(1, dt * damping);
    this.x = THREE.MathUtils.clamp(this.x + this.vx * dt, -8.2, 8.2);
    this.mesh.position.x = this.x;

    // Target Front Wheel Turn Angle (Smooth progressive steering)
    const maxSpeedHandling = Math.max(1, this.handling * 0.52 * sensitivity);
    const normTurn = THREE.MathUtils.clamp(this.vx / maxSpeedHandling, -1, 1);
    const targetWheelTurn = normTurn * 0.42;
    this.steerAngle += (targetWheelTurn - this.steerAngle) * Math.min(1, dt * 11);
    if (this.wheels.fl && this.wheels.fr) {
      const isInnerRotated = Boolean(this.carModel && this.carModel.children[0]?.rotation.y === Math.PI);
      const steerVal = isInnerRotated ? -this.steerAngle : this.steerAngle;
      this.wheels.fl.rotation.y = steerVal;
      this.wheels.fr.rotation.y = steerVal;
    }

    // Suspension Body Roll into Turns (Silky smooth weight transfer)
    const targetRoll = -normTurn * (this.isDrifting ? 0.20 : 0.11);
    this.suspensionRoll += (targetRoll - this.suspensionRoll) * Math.min(1, dt * 8.0);

    // Car Yaw Slide: Fluid arcade rotation
    const targetYaw = -normTurn * (this.isDrifting ? 0.36 : 0.08);
    this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * Math.min(1, dt * 7.0);
  }

  setDrift(drifting) {
    this.isDrifting = drifting;
  }

  setBraking(braking) {
    this.isBraking = Boolean(braking);
  }

  setRampElevation(elevation, pitch = -0.24) {
    this.rampElevation = elevation;
    this.rampPitch = pitch;
  }

  repairHull(amount) {
    const prev = this.hull;
    this.hull = Math.min(this.maxHull, this.hull + amount);
    return Math.round(this.hull - prev);
  }

  setBoost(boosting) {
    if (boosting && this.nitro > 0) {
      this.isBoosting = true;
    } else {
      this.isBoosting = false;
    }
  }

  triggerJump(launchVel = 18, startY = 1.35) {
    if (this.isAirborne) return;
    this.isAirborne = true;
    this.verticalY = Math.max(this.verticalY, startY);
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
    } else if (this.isBraking) {
      // ACTIVE CERAMIC BRAKING: High-performance braking with forward nose dive
      this.targetSpeed = Math.min(this.speed, this.topSpeed * 0.28);
      this.isBoosting = false;
      this.speed = Math.max(6.0, this.speed - dt * 36);
      this.suspensionPitch = 0.10; // Forward brake dive
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

    // Smooth ground speed acceleration (only when not braking or halting)
    if (!this.isBrakingToHalt && !this.isBraking) {
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * (this.isBoosting ? 5.5 : 3.2));
    }

    // 2. Wheel Spinning Animation
    this.wheelRotation += (this.speed * dt) * 2.8;
    if (this.wheelSpinners && this.wheelSpinners.length > 0) {
      this.wheelSpinners.forEach(s => {
        s.rotation.x = this.wheelRotation;
      });
    }
    Object.values(this.wheels).forEach(w => {
      if (w && w.children[0] && (!this.wheelSpinners || !this.wheelSpinners.includes(w.children[0]))) {
        w.children[0].rotation.x = this.wheelRotation;
      }
    });

    // 3. Stunt Jump & Airtime Physics
    if (this.isAirborne) {
      this.verticalVel += this.gravity * dt;
      this.verticalY += this.verticalVel * dt;

      // Aerodynamic glide nose-up pitch in air
      this.targetPitch = -0.10;

      // Landing detection
      if (this.verticalY <= 0) {
        this.verticalY = 0;
        this.verticalVel = 0;
        this.isAirborne = false;
        this.targetPitch = 0.12; // Smooth suspension landing compression
        if (onLandCallback) onLandCallback();
      }
    } else if (this.rampElevation > 0) {
      // Smoothly match ramp incline
      this.targetPitch = this.rampPitch || -0.24;
    } else {
      // Flat road pitch from braking / acceleration
      if (this.isBrakingToHalt) {
        this.targetPitch = 0.12;
      } else if (this.isBraking) {
        this.targetPitch = 0.10;
      } else if (this.isBoosting) {
        this.targetPitch = -0.08;
      } else {
        this.targetPitch = 0;
      }
    }

    // Silky smooth suspension pitch lerp (eliminates 60Hz twitch and jitter)
    this.suspensionPitch += (this.targetPitch - this.suspensionPitch) * Math.min(1, dt * 11.0);
    this.chassis.rotation.x = this.suspensionPitch;

    // Ensure mesh X is 100% synchronized with physics state
    this.mesh.position.x = this.x;
    const baseElevation = this.isAirborne ? Math.max(this.verticalY, this.rampElevation || 0) : (this.rampElevation || 0);
    this.mesh.position.y = baseElevation;
    this.chassis.rotation.y = 0; // Chassis yaw is strictly locked forward; steering yaw is applied to this.mesh
    this.chassis.rotation.z = this.suspensionRoll;
    this.rampElevation = 0; // Reset for next frame
    this.rampPitch = 0;

    // Dynamic ground contact shadow anchoring (stays on ground during jumps)
    if (this.shadowMesh) {
      if (baseElevation > 0) {
        this.shadowMesh.position.y = -baseElevation + 0.008;
        this.shadowMesh.material.opacity = Math.max(0.12, 0.76 - baseElevation * 0.10);
        this.shadowMesh.scale.setScalar(1.0 + baseElevation * 0.06);
      } else {
        this.shadowMesh.position.y = 0.008;
        this.shadowMesh.material.opacity = 0.76;
        this.shadowMesh.scale.set(1, 1, 1);
      }
    }

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
      if (f.light) {
        f.light.intensity = this.isBoosting ? 5.0 + Math.random() * 2.5 : 0;
      }
      if (f.cone) {
        f.cone.material.opacity = this.isBoosting ? 0.95 : 0;
        f.cone.scale.y = this.isBoosting ? 1.0 + Math.random() * 0.55 : 0.1;
      }
      if (f.core) {
        f.core.material.opacity = this.isBoosting ? 1.0 : 0;
        f.core.scale.y = this.isBoosting ? 0.8 + Math.random() * 0.4 : 0.1;
      }
      if (f.intensity !== undefined) f.intensity = this.isBoosting ? 6.5 : 0.8;
      if (f.userData && f.userData.cone) {
        f.userData.cone.material.opacity = this.isBoosting ? 0.92 : 0;
        f.userData.cone.scale.y = this.isBoosting ? 1.0 + Math.random() * 0.45 : 0.1;
      }
    });

    // 6. Shield & Magnet Timers
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
