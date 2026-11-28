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

// Cached Procedural Textures & PBR Materials for Day 08
let _carbonFiberTexture = null;
export function getCarbonFiberTexture() {
  if (_carbonFiberTexture) return _carbonFiberTexture;
  if (typeof document === 'undefined' || !document.createElement) {
    _carbonFiberTexture = new THREE.Texture();
    _carbonFiberTexture.name = 'CarbonFiberProcedural';
    return _carbonFiberTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Draw authentic 2x2 carbon fiber twill weave
  ctx.fillStyle = '#111317';
  ctx.fillRect(0, 0, 64, 64);

  const cellSize = 16;
  for (let y = 0; y < 64; y += cellSize) {
    for (let x = 0; x < 64; x += cellSize) {
      const isAlt = ((x + y) / cellSize) % 2 === 0;
      const grad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      if (isAlt) {
        grad.addColorStop(0, '#1c1f26');
        grad.addColorStop(0.5, '#353945');
        grad.addColorStop(1, '#15171c');
      } else {
        grad.addColorStop(0, '#14161b');
        grad.addColorStop(0.5, '#282c36');
        grad.addColorStop(1, '#0e1014');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
    }
  }

  _carbonFiberTexture = new THREE.CanvasTexture(canvas);
  _carbonFiberTexture.name = 'CarbonFiberProcedural';
  _carbonFiberTexture.wrapS = THREE.RepeatWrapping;
  _carbonFiberTexture.wrapT = THREE.RepeatWrapping;
  _carbonFiberTexture.repeat.set(6, 6);
  _carbonFiberTexture.colorSpace = THREE.SRGBColorSpace;
  return _carbonFiberTexture;
}

let _wheelBlurTexture = null;
export function getWheelBlurTexture() {
  if (_wheelBlurTexture) return _wheelBlurTexture;
  if (typeof document === 'undefined' || !document.createElement) {
    _wheelBlurTexture = new THREE.Texture();
    _wheelBlurTexture.name = 'WheelBlurProcedural';
    return _wheelBlurTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cx = 64, cy = 64, r = 58;

  ctx.clearRect(0, 0, 128, 128);

  // Concentric motion blur rings representing high-RPM spinning spokes
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
  grad.addColorStop(0.3, 'rgba(180, 200, 220, 0.8)');
  grad.addColorStop(0.65, 'rgba(100, 120, 140, 0.65)');
  grad.addColorStop(0.85, 'rgba(40, 50, 65, 0.4)');
  grad.addColorStop(1.0, 'rgba(10, 15, 20, 0.1)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  for (let rad = 18; rad < r; rad += 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  _wheelBlurTexture = new THREE.CanvasTexture(canvas);
  _wheelBlurTexture.colorSpace = THREE.SRGBColorSpace;
  return _wheelBlurTexture;
}

/**
 * Injects metallic micro-flake sparkle into Three.js MeshPhysicalMaterial via shader chunk hook.
 */
export function applyMetallicFlakeShader(material, flakeScale = 150.0, flakeSparkle = 0.22) {
  if (!material) return material;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldFlakePos;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldFlakePos = worldPosition.xyz;
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldFlakePos;
       float flakeHash(vec3 p) {
         p = fract(p * 0.3183099 + 0.1);
         p *= 17.0;
         return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
       }
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float flake = flakeHash(floor(vWorldFlakePos * ${flakeScale.toFixed(1)}));
       roughnessFactor = clamp(roughnessFactor + (flake - 0.5) * ${flakeSparkle.toFixed(2)}, 0.04, 0.96);
      `
    );
  };
  return material;
}

/**
 * Calculates progressive wheel motion blur factor from road speed in km/h:
 * 0.0 at <= 120 km/h, smoothly scaling to 1.0 at >= 210 km/h.
 */
export function calculateWheelBlurFactor(speedKmh, thresholdKmh = 120, maxKmh = 210) {
  if (speedKmh <= thresholdKmh) return 0;
  return Math.min(1.0, Math.max(0, (speedKmh - thresholdKmh) / (maxKmh - thresholdKmh)));
}

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
    desc: 'The apex prototype. Advanced ground-effect downforce and twin-electric hyperdrive breaking 340+ KM/H.',
    modelAsset: './assets/player-hyperion.glb',
    baseStats: { topSpeed: 40, accel: 46, handling: 42, nitro: 75, armor: 140 },
    paint: 0x00f0ff, // Luminous Cyan
    glow: 0x00ffff,
    cost: 5000,
    unlocked: false,
    engineProfile: 'electric'
  },
  valkyrie: {
    id: 'valkyrie',
    name: 'Valixis Valkyrie SV',
    tier: 'V12 TRACK SERIES',
    desc: 'Naturally-aspirated 6.5L screaming V12 atmospheric track monster with active aero and 8,500 RPM redline.',
    modelAsset: './assets/player-lamborghini.glb',
    baseStats: { topSpeed: 38, accel: 44, handling: 40, nitro: 70, armor: 130 },
    paint: 0xff1744, // Rosso Corsa
    glow: 0xffea00,
    cost: 4200,
    unlocked: false,
    engineProfile: 'v12'
  },
  spectre: {
    id: 'spectre',
    name: 'Valixis Spectre EV',
    tier: 'ELECTRIC HYPER GT',
    desc: 'Quad-motor electric prototype with instantaneous torque vectoring, carbon aeroblades, and silent supersonic launch.',
    modelAsset: './assets/sports.glb',
    baseStats: { topSpeed: 42, accel: 48, handling: 45, nitro: 85, armor: 140 },
    paint: 0x00ffaa, // Cyber Emerald
    glow: 0x00f0ff,
    cost: 6500,
    unlocked: false,
    engineProfile: 'electric'
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
    this.topSpeed = VEHICLE_ROSTER.apex.baseStats.topSpeed;
    this.accel = VEHICLE_ROSTER.apex.baseStats.accel;
    this.handling = VEHICLE_ROSTER.apex.baseStats.handling;
    this.targetSpeed = 22;
    this.hull = 100;
    this.maxHull = 100;
    this.nitro = 50;
    this.maxNitro = 100;
    this.isBoosting = false;
    this.boostPadTimer = 0;
    this.isBraking = false;
    this.brakeIntensity = 1.0;
    this.throttleInput = 1.0;
    this.isBrakingToHalt = false;
    this.lastShiftType = null;
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

    // Advanced Tire Dynamics & Pacejka Friction
    this.slipAngle = 0;
    this.lateralG = 0;
    this.tireGrip = 1.0;
    this.pacejkaMu = 1.0;
    this.weightTransfer = { fl: 1.0, fr: 1.0, rl: 1.0, rr: 1.0, dW_lat: 0, dW_long: 0 };
    this.driftExitTimer = 0;
    this.driftAngle = 0;
    this.counterSteerAssist = 1.0;
    this.prevVx = 0;
    this.prevSpeed = 0;

    // Dual-Clutch Transmission & Powertrain Simulation
    this.gear = 1;
    this.rpm = 1200;
    this.isDctCut = false;
    this.dctShiftTimer = 0;
    this.revMatchTimer = 0;
    this.shiftCooldown = 0;
    this.backfireTimer = 0;
    this.backfireCount = 0;
    this.prevBoosting = false;

    // Ceramic Brake Rotor Thermals & Fade
    this.brakeRotorTemp = 45; // Ambient 45°C
    this.brakeFadeFactor = 1.0;
    this.brakeGlow = 0;

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
    this.wheelBlurMeshes = [];
    this.currentWheelBlurFactor = 0;

    // Downshift Overrun Backfire & Nitro Ignition VFX
    this.backfireTimer = 0;
    this.backfireCount = 0;
    this.prevBoosting = false;
    this.emberMesh = null;
    this.emberParticles = [];

    // Skid marks & smoke
    this.skidMarks = [];
    this.smokeParticles = [];

    this.initVisuals();
  }

  buildContactShadowTexture() {
    if (typeof document === 'undefined' || !document.createElement) {
      const tex = new THREE.Texture();
      tex.name = 'ContactShadowNodeFallback';
      return tex;
    }
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

    this.initBackfireVfx();
    this.rebuildCarModel();
  }

  initBackfireVfx() {
    this.maxEmbers = 24;
    this.emberParticles = [];
    this._emberMatrix = new THREE.Matrix4();
    this._emberPos = new THREE.Vector3();
    this._emberScale = new THREE.Vector3();
    this._emberQuat = new THREE.Quaternion();

    const geo = new THREE.PlaneGeometry(0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.emberMesh = new THREE.InstancedMesh(geo, mat, this.maxEmbers);
    this.emberMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chassis.add(this.emberMesh);

    for (let i = 0; i < this.maxEmbers; i++) {
      this.emberParticles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.22,
        scale: 0.1
      });
      this._emberMatrix.makeScale(0, 0, 0);
      this.emberMesh.setMatrixAt(i, this._emberMatrix);
    }
    this.emberMesh.instanceMatrix.needsUpdate = true;
  }

  triggerBackfire(type = 'overrun') {
    this.backfireTimer = 0.14; // 140ms backfire flash
    this.backfireCount++;

    const exhaustX = [-0.6, 0.6];
    let spawned = 0;
    for (let i = 0; i < this.maxEmbers; i++) {
      const p = this.emberParticles[i];
      if (!p.active) {
        const sideX = exhaustX[spawned % 2];
        p.active = true;
        p.x = sideX + (Math.random() - 0.5) * 0.12;
        p.y = 0.45 + (Math.random() - 0.5) * 0.1;
        p.z = 2.3 + Math.random() * 0.15;
        p.vx = (Math.random() - 0.5) * 2.2;
        p.vy = 0.5 + Math.random() * 1.8;
        p.vz = 8.0 + Math.random() * 12.0;
        p.life = 0.18 + Math.random() * 0.12;
        p.maxLife = p.life;
        p.scale = type === 'nitro' ? 0.24 : 0.16;
        spawned++;
        if (spawned >= 12) break;
      }
    }

    if (typeof window !== 'undefined' && window.audio && typeof window.audio.play === 'function') {
      window.audio.play('blowoff');
    }
  }

  reset() {
    this.x = 0;
    this.prevX = 0;
    this.prevZ = -8;
    this.speed = 0;
    this.targetSpeed = this.topSpeed;
    this.hull = this.maxHull;
    this.nitro = this.maxNitro * 0.5;
    this.isBoosting = false;
    this.boostPadTimer = 0;
    this.isBraking = false;
    this.brakeIntensity = 1.0;
    this.throttleInput = 1.0;
    this.isBrakingToHalt = false;
    this.lastShiftType = null;
    this.isDrifting = false;
    this.driftScore = 0;
    this.steerInput = 0;
    this.steerAngle = 0;
    this.vx = 0;
    this.suspensionPitch = 0;
    this.targetPitch = 0;
    this.suspensionRoll = 0;
    this.wheelRotation = 0;
    this.slipAngle = 0;
    this.lateralG = 0;
    this.tireGrip = 1.0;
    this.pacejkaMu = 1.0;
    this.weightTransfer = { fl: 1.0, fr: 1.0, rl: 1.0, rr: 1.0, dW_lat: 0, dW_long: 0 };
    this.driftExitTimer = 0;
    this.driftAngle = 0;
    this.counterSteerAssist = 1.0;
    this.prevVx = 0;
    this.prevSpeed = 0;

    // Dual-Clutch Transmission & Powertrain Simulation
    this.gear = 1;
    this.rpm = 1200;
    this.isDctCut = false;
    this.dctShiftTimer = 0;
    this.revMatchTimer = 0;
    this.shiftCooldown = 0;
    this.backfireTimer = 0;
    this.backfireCount = 0;
    this.prevBoosting = false;

    // Ceramic Brake Rotor Thermals & Fade
    this.brakeRotorTemp = 45; // Ambient 45°C
    this.brakeFadeFactor = 1.0;
    this.brakeGlow = 0;
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
    this.wheelBlurMeshes = [];
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

            // 1. Cockpit Windshield & Tinted Refractive Glass (PBR Physical Transmission)
            if (/GLASS|WINDOW/i.test(combined)) {
              return new THREE.MeshPhysicalMaterial({
                color: /BLACK/i.test(combined) ? 0x05080e : 0x081828,
                metalness: 0.15,
                roughness: 0.05,
                transparent: true,
                opacity: /BLACK/i.test(combined) ? 0.78 : 0.62,
                transmission: 0.65,
                ior: 1.52,
                thickness: 0.5,
                clearcoat: 1.0,
                clearcoatRoughness: 0.04,
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

            // 4. Carbon Fiber Aerodynamics (Splitter, Diffuser, Spoiler - 2x2 Twill Weave PBR)
            if (/CARBON/i.test(combined)) {
              return new THREE.MeshPhysicalMaterial({
                color: 0x1c1e24,
                map: getCarbonFiberTexture(),
                roughness: 0.32,
                metalness: 0.5,
                clearcoat: 0.45,
                clearcoatRoughness: 0.12
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

            // 6. Primary High-Gloss Metallic Car Body Paint with PBR Clearcoat & Metallic Flake
            if (/CHASSIS|BODY|HOOD|DOOR|BOOT|BUMPER|PHONG4|COLORMAP/i.test(combined) || isApexModel) {
              if (m.map) {
                const cloned = new THREE.MeshPhysicalMaterial({
                  map: m.map,
                  color: m.color || 0xffffff,
                  roughness: 0.22,
                  metalness: 0.65,
                  clearcoat: 1.0,
                  clearcoatRoughness: 0.08,
                  reflectivity: 0.95
                });
                cloned.map.colorSpace = THREE.SRGBColorSpace;
                cloned.map.anisotropy = 16;
                cloned.map.flipY = false;
                applyMetallicFlakeShader(cloned, 160.0, 0.18);
                return cloned;
              }
              const paintMat = new THREE.MeshPhysicalMaterial({
                color: this.paintColor,
                metalness: 0.88,
                roughness: 0.16,
                clearcoat: 1.0,
                clearcoatRoughness: 0.08,
                reflectivity: 0.95
              });
              applyMetallicFlakeShader(paintMat, 150.0, 0.22);
              return paintMat;
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

      // Cockpit Interior Sub-Cluster (Dashboard & F1 Steering Wheel visible through windshield)
      const cockpitGroup = new THREE.Group();
      cockpitGroup.name = 'CockpitInterior';
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.9, metalness: 0.1 })
      );
      dash.position.set(0, 0.82, -0.4);
      cockpitGroup.add(dash);

      const hudCluster = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.12, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x00d9ff })
      );
      hudCluster.position.set(-0.2, 0.90, -0.18);
      hudCluster.rotation.x = -0.3;
      cockpitGroup.add(hudCluster);

      const steerWheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.022, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.75, metalness: 0.25 })
      );
      steerWheel.position.set(-0.2, 0.92, -0.08);
      steerWheel.rotation.x = 0.35;
      cockpitGroup.add(steerWheel);
      wrapper.add(cockpitGroup);

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

          this.attachWheelBlurDisc(spinner);
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
        this.attachWheelBlurDisc(w);
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
        this.attachWheelBlurDisc(w);
      });
      return;
    }

    // Check Pattern 4: Generic / Lamborghini / Sports Wheels
    if (!this.wheels.fl) {
      let fl = null, fr = null, rl = null, rr = null;
      model.traverse(n => {
        if (!n.name) return;
        const nm = n.name.toLowerCase();
        if (/wheel|tire|rim/i.test(nm)) {
          if (/front.*(l|left)|wheel1|fl/i.test(nm)) fl = n;
          else if (/front.*(r|right)|wheel0|fr/i.test(nm)) fr = n;
          else if (/(rear|back).*(l|left)|rl/i.test(nm)) rl = n;
          else if (/(rear|back).*(r|right)|rr/i.test(nm)) rr = n;
        }
      });
      if (fl || fr) {
        this.wheels.fl = fl;
        this.wheels.fr = fr;
        this.wheels.rl = rl;
        this.wheels.rr = rr;
        [fl, fr, rl, rr].filter(Boolean).forEach(w => {
          this.wheelSpinners.push(w);
          this.attachWheelBlurDisc(w);
        });
      }
    }
  }

  attachWheelBlurDisc(targetGroup, radius = 0.44) {
    if (!targetGroup) return null;
    const discGeo = new THREE.CircleGeometry(radius * 0.96, 24);
    discGeo.rotateY(Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      map: getWheelBlurTexture(),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.name = 'WheelBlurDisc';
    targetGroup.add(discMesh);
    if (!this.wheelBlurMeshes) this.wheelBlurMeshes = [];
    this.wheelBlurMeshes.push(discMesh);
    return discMesh;
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
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: this.paintColor,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95
    });
    applyMetallicFlakeShader(bodyMat, 150.0, 0.22);

    const carbonMat = new THREE.MeshPhysicalMaterial({
      color: 0x1c1e24,
      map: getCarbonFiberTexture(),
      roughness: 0.32,
      metalness: 0.5,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x081828,
      metalness: 0.15,
      roughness: 0.05,
      transparent: true,
      opacity: 0.65,
      transmission: 0.65,
      ior: 1.52,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false
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

    // Cockpit Interior Sub-Cluster (Dashboard, glowing HUD & F1 steering wheel visible through glass)
    const cockpitGroup = new THREE.Group();
    cockpitGroup.name = 'CockpitInterior';
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.9, metalness: 0.1 })
    );
    dash.position.set(0, 0.82, -0.4);
    cockpitGroup.add(dash);

    const hudCluster = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.12, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x00d9ff })
    );
    hudCluster.position.set(-0.2, 0.90, -0.18);
    hudCluster.rotation.x = -0.3;
    cockpitGroup.add(hudCluster);

    const steerWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.75, metalness: 0.25 })
    );
    steerWheel.position.set(-0.2, 0.92, -0.08);
    steerWheel.rotation.x = 0.35;
    cockpitGroup.add(steerWheel);
    group.add(cockpitGroup);

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

    // 7. 4 Independent High-Detail Wheels (Rubber Tire + Chrome Alloy Rim + Hub + Motion Blur Disc)
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

      this.attachWheelBlurDisc(wheelGroup, 0.44);
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

  calculatePacejkaGrip(slipAngle, isDrifting = false) {
    // Pacejka Magic Formula: mu(s) = D * sin(C * arctan(B * s))
    // D = Peak friction, C = Shape factor, B = Stiffness factor
    const handlingFactor = (this.handling || 24) / 24.0;
    const D = isDrifting ? (0.92 * handlingFactor) : (1.18 * handlingFactor);
    const C = isDrifting ? 1.30 : 1.55;
    const B = isDrifting ? 5.8 : 9.5;

    const mu = D * Math.sin(C * Math.atan(B * slipAngle));
    return {
      mu,
      peakMu: D,
      isSliding: Math.abs(slipAngle) > (0.18 / (isDrifting ? 0.7 : 1.0))
    };
  }

  calculateWeightTransfer(forwardSpeed, accelRate, lateralVel, dt) {
    // Longitudinal weight transfer: a_x (units/s^2)
    // Positive accel lifts nose (squat), braking dips nose (dive)
    const longAccel = accelRate;
    const h_cog_over_L = 0.22;
    const dW_long = (longAccel / 28.0) * h_cog_over_L;

    // Lateral weight transfer: a_y based on lateral velocity and forward velocity
    const h_cog_over_T = 0.28;
    const dW_lat = THREE.MathUtils.clamp((lateralVel * (forwardSpeed / 30.0) * 0.12), -0.45, 0.45);

    // Front/Rear and Left/Right weight distribution
    const frontLoad = THREE.MathUtils.clamp(1.0 - dW_long, 0.65, 1.45);
    const rearLoad = THREE.MathUtils.clamp(1.0 + dW_long, 0.65, 1.45);

    this.weightTransfer = {
      fl: THREE.MathUtils.clamp(frontLoad * (1.0 - dW_lat), 0.35, 1.65),
      fr: THREE.MathUtils.clamp(frontLoad * (1.0 + dW_lat), 0.35, 1.65),
      rl: THREE.MathUtils.clamp(rearLoad * (1.0 - dW_lat), 0.35, 1.65),
      rr: THREE.MathUtils.clamp(rearLoad * (1.0 + dW_lat), 0.35, 1.65),
      dW_lat,
      dW_long
    };

    // Lateral G estimation
    this.lateralG = Math.abs(lateralVel) * (forwardSpeed / 32.0) * 0.25;
    return this.weightTransfer;
  }

  steer(inputDir, dt, sensitivity = 1.0, counterAssist = 1.0) {
    this.steerInput = inputDir;
    this.vx = this.vx || 0;

    // 1. Calculate tire slip angle s = arctan(vx / vz) - steerAngle
    const forwardSpeed = Math.max(4.0, this.speed);
    const bodySlideAngle = Math.atan2(this.vx, forwardSpeed);
    this.slipAngle = bodySlideAngle - this.steerAngle;

    // 2. Pacejka Magic Formula lateral tire grip
    const pacejka = this.calculatePacejkaGrip(this.slipAngle, this.isDrifting);
    this.pacejkaMu = pacejka.mu;
    this.tireGrip = pacejka.mu;

    // 3. Counter-Steering Stabilization Assist
    // When oversteering during drift, natural caster counter-aligns wheels to stabilize slide
    const assistFactor = THREE.MathUtils.clamp(counterAssist ?? this.counterSteerAssist ?? 1.0, 0, 1.5);
    const isOversteering = this.isDrifting && (Math.sign(this.vx) !== Math.sign(inputDir) || inputDir === 0);
    const counterSteerTorque = isOversteering ? (-this.slipAngle * 0.44 * assistFactor) : 0;

    // 4. Progressive Lateral Steering Velocity with Grip & Drift Dynamics
    const handlingScale = this.isDrifting ? 0.68 : 0.54;
    const baseTargetVx = inputDir * (this.handling * handlingScale * sensitivity);
    const targetVx = baseTargetVx + (isOversteering ? counterSteerTorque * 2.5 : 0);

    // Anti-snapback recovery damping when transitioning out of drift
    if (this.driftExitTimer > 0) {
      this.driftExitTimer = Math.max(0, this.driftExitTimer - dt);
    }
    const recoveryFactor = this.driftExitTimer > 0 ? (this.driftExitTimer / 0.35) : 0;

    let damping;
    if (this.isDrifting) {
      damping = inputDir !== 0 ? 9.2 : 6.8;
    } else if (recoveryFactor > 0) {
      // Smoothly blend from sliding damping (7.5) to grip damping (14.0) without violent snap-back
      damping = THREE.MathUtils.lerp(14.0, 7.5, recoveryFactor);
    } else {
      damping = inputDir !== 0 ? 14.2 : 9.8;
    }

    this.vx += (targetVx - this.vx) * Math.min(1, dt * damping);
    this.x = THREE.MathUtils.clamp(this.x + this.vx * dt, -8.2, 8.2);
    this.mesh.position.x = this.x;

    // 5. Dynamic Weight Transfer (Axle & Corner Normal Loads)
    const accelRate = (this.speed - (this.prevSpeed || this.speed)) / Math.max(0.001, dt);
    this.prevSpeed = this.speed;
    this.calculateWeightTransfer(forwardSpeed, accelRate, this.vx, dt);

    // 6. Wheel Steering & Counter-Steer Visuals
    const maxSpeedHandling = Math.max(1, this.handling * handlingScale * sensitivity);
    const normTurn = THREE.MathUtils.clamp(this.vx / maxSpeedHandling, -1, 1);

    const targetWheelTurn = this.isDrifting
      ? (inputDir !== 0 && Math.sign(inputDir) !== Math.sign(normTurn)
          ? inputDir * 0.50 // crisp active counter-lock
          : (Math.abs(inputDir) > 0 ? normTurn * 0.42 : -normTurn * 0.35)) // natural caster counter-alignment
      : normTurn * 0.40;

    this.steerAngle += (targetWheelTurn - this.steerAngle) * Math.min(1, dt * 11.5);
    if (this.wheels.fl && this.wheels.fr) {
      const isInnerRotated = Boolean(this.carModel && this.carModel.children[0]?.rotation.y === Math.PI);
      const steerVal = isInnerRotated ? -this.steerAngle : this.steerAngle;
      this.wheels.fl.rotation.y = steerVal;
      this.wheels.fr.rotation.y = steerVal;
    }

    // 7. Dynamic Suspension Body Roll (Coupled with Lateral Weight Transfer)
    // Outward chassis roll with spring damping
    const rollFromG = this.weightTransfer.dW_lat * 0.18;
    const targetRoll = -normTurn * (this.isDrifting ? 0.24 : 0.12) - rollFromG;
    this.suspensionRoll += (targetRoll - this.suspensionRoll) * Math.min(1, dt * 8.5);

    // 8. Vehicle Yaw Slide with Anti-Snapback Alignment
    // During drift recovery, targetYaw smoothly straightens back to neutral forward alignment
    const targetYaw = this.isDrifting
      ? -normTurn * 0.44
      : (-normTurn * 0.08 * (1.0 - recoveryFactor));
    this.driftAngle = this.mesh.rotation.y;
    this.mesh.rotation.y += (targetYaw - this.mesh.rotation.y) * Math.min(1, dt * 7.8);
  }

  setDrift(drifting) {
    const isNowDrifting = Boolean(drifting);
    if (this.isDrifting && !isNowDrifting) {
      // Exiting drift: initiate smooth anti-snapback damping recovery window (350ms)
      this.driftExitTimer = 0.35;
    }
    this.isDrifting = isNowDrifting;
  }

  setBraking(braking, intensity = 1.0) {
    this.isBraking = Boolean(braking) && intensity > 0.01;
    this.brakeIntensity = this.isBraking ? Math.max(0.05, Math.min(1.0, intensity)) : 0;
  }

  setThrottle(throttle = 1.0) {
    this.throttleInput = Math.max(0.25, Math.min(1.0, throttle));
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
    // Armor mitigation: armor rating reduces incoming damage up to 35%
    const armorMitigation = Math.max(0.65, 1.0 - ((this.armor || 100) - 80) * 0.0035);
    const effectiveDamage = Math.max(1, Math.round(amount * armorMitigation));
    this.hull = Math.max(0, this.hull - effectiveDamage);
    // Impact nose dive pitch proportional to damage
    this.suspensionPitch = Math.min(0.35, 0.15 + (effectiveDamage / 40) * 0.20);
    return effectiveDamage;
  }

  repair(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  addNitro(amount) {
    this.nitro = Math.min(this.maxNitro, this.nitro + amount);
  }

  getPowertrainTelemetry() {
    return {
      gear: this.gear,
      rpm: Math.round(this.rpm),
      speedKmh: Math.round(this.speed * 9.0),
      isDctCut: this.isDctCut,
      dctShiftTimer: Math.max(0, this.dctShiftTimer),
      revMatchTimer: Math.max(0, this.revMatchTimer),
      brakeRotorTemp: Math.round(this.brakeRotorTemp),
      brakeFadeFactor: parseFloat(this.brakeFadeFactor.toFixed(3)),
      brakeGlow: parseFloat(this.brakeGlow.toFixed(3))
    };
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
    this.prevX = this.x;
    this.prevZ = this.mesh.position.z;

    // 1. Acceleration & Nitro Dynamics (Calibrated: 80-120 Stock, 150-160 Boost)
    // Ceramic brake rotor thermal simulation & fade
    if (this.isBraking) {
      const heatRate = (this.speed / 24.0) * 85.0 * (this.brakeIntensity ?? 1.0);
      this.brakeRotorTemp = Math.min(950, this.brakeRotorTemp + heatRate * dt);
    } else {
      const coolRate = 12.0 + (this.speed / 28.0) * 36.0;
      this.brakeRotorTemp = Math.max(45, this.brakeRotorTemp - coolRate * dt);
    }

    if (this.brakeRotorTemp > 600) {
      const fadeProgress = (this.brakeRotorTemp - 600) / 350;
      this.brakeFadeFactor = Math.max(0.80, 1.0 - fadeProgress * 0.20);
    } else {
      this.brakeFadeFactor = 1.0;
    }
    this.brakeGlow = Math.max(0, (this.brakeRotorTemp - 550) / 400);

    // 6-Speed Dual-Clutch Transmission Simulation with Hysteresis
    const speedKmh = Math.round(this.speed * 9.0);
    let targetGear = this.gear;
    const currentGear = this.gear;
    if (currentGear === 1 && speedKmh > 68) targetGear = 2;
    else if (currentGear === 2) {
      if (speedKmh > 125) targetGear = 3;
      else if (speedKmh < 52) targetGear = 1;
    } else if (currentGear === 3) {
      if (speedKmh > 180) targetGear = 4;
      else if (speedKmh < 110) targetGear = 2;
    } else if (currentGear === 4) {
      if (speedKmh > 235) targetGear = 5;
      else if (speedKmh < 165) targetGear = 3;
    } else if (currentGear === 5) {
      if (speedKmh > 290) targetGear = 6;
      else if (speedKmh < 218) targetGear = 4;
    } else if (currentGear === 6) {
      if (speedKmh < 272) targetGear = 5;
    }
    if (speedKmh <= 4) targetGear = 1;

    if (this.shiftCooldown > 0) {
      this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    }

    if (targetGear > this.gear && this.shiftCooldown <= 0) {
      this.gear = targetGear;
      this.isDctCut = true;
      this.dctShiftTimer = 0.045; // 45ms torque dip
      this.shiftCooldown = 0.12;
      this.lastShiftType = 'up';
    } else if (targetGear < this.gear && this.shiftCooldown <= 0) {
      this.gear = targetGear;
      this.revMatchTimer = 0.12; // 120ms throttle blip rev match
      this.shiftCooldown = 0.12;
      this.lastShiftType = 'down';
      this.triggerBackfire('downshift');
    }

    if (this.isBoosting && !this.prevBoosting) {
      this.triggerBackfire('nitro');
    }
    this.prevBoosting = Boolean(this.isBoosting);

    if (this.backfireTimer > 0) {
      this.backfireTimer = Math.max(0, this.backfireTimer - dt);
    }

    if (this.isDctCut) {
      this.dctShiftTimer -= dt;
      if (this.dctShiftTimer <= 0) {
        this.isDctCut = false;
      }
    }

    if (this.revMatchTimer > 0) {
      this.revMatchTimer = Math.max(0, this.revMatchTimer - dt);
    }

    // RPM model inside gear
    const gearMinSpeed = [0, 0, 52, 110, 165, 218, 272][this.gear] || 0;
    const gearMaxSpeed = [0, 68, 125, 180, 235, 290, 380][this.gear] || 68;
    const gearSpan = Math.max(20, gearMaxSpeed - gearMinSpeed);
    const gearProgress = Math.max(0, Math.min(1, (speedKmh - gearMinSpeed) / gearSpan));
    let baseRpm = 1400 + gearProgress * 5800;
    if (this.isDctCut) baseRpm *= 0.65;
    if (this.revMatchTimer > 0) baseRpm = Math.min(7800, baseRpm + 1800 * (this.revMatchTimer / 0.12));
    if (this.isBoosting) baseRpm = Math.min(8400, baseRpm + 1050);
    if (this.isBraking && this.revMatchTimer <= 0) baseRpm = Math.max(1200, baseRpm * 0.72);
    this.rpm += (baseRpm - this.rpm) * Math.min(1, dt * 14.0);

    if (this.isBrakingToHalt) {
      this.targetSpeed = 0;
      this.isBoosting = false;
      this.speed = Math.max(0, this.speed - dt * 42);
      this.suspensionPitch = 0.12; // Forward brake dive
    } else if (this.isBraking) {
      // ACTIVE CERAMIC BRAKING: Progressive LT/brake intensity + thermal fade factor
      const bForce = this.brakeIntensity ?? 1.0;
      this.targetSpeed = Math.min(this.speed, this.topSpeed * (1.0 - 0.72 * bForce));
      this.isBoosting = false;
      const effectiveDecel = 36.0 * bForce * this.brakeFadeFactor;
      this.speed = Math.max(6.0, this.speed - dt * effectiveDecel);
      this.suspensionPitch = 0.10 * bForce * this.brakeFadeFactor; // Forward brake dive
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
      const tInput = this.throttleInput ?? 1.0;
      this.targetSpeed = this.topSpeed * tInput;
      this.suspensionPitch *= 0.9;
    }

    // Smooth ground speed acceleration (only when not braking or halting)
    if (!this.isBrakingToHalt && !this.isBraking) {
      const torqueFactor = this.isDctCut ? 0.40 : 1.0;
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * (this.isBoosting ? 5.5 : 3.2) * torqueFactor);
    }

    // 2. Wheel Spinning Animation & High-Speed Motion Blur
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

    // Real-time Wheel Motion Blur opacity scaling (> 120 km/h)
    const kmh = this.speed * 9;
    this.currentWheelBlurFactor = calculateWheelBlurFactor(kmh);
    if (this.wheelBlurMeshes && this.wheelBlurMeshes.length > 0) {
      const targetOpacity = this.currentWheelBlurFactor * 0.85;
      this.wheelBlurMeshes.forEach(m => {
        if (m && m.material) {
          m.material.opacity = targetOpacity;
        }
      });
    }

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
    if (this.isDrifting && this.speed > 10 && !this.isAirborne) {
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

    // 5. Exhaust Nitro Flames FX, Backfire Flare & Embers
    if (this.underglowLight) {
      this.underglowLight.intensity = this.isBoosting ? 5.5 : (this.backfireTimer > 0 ? 4.2 : 3.0);
    }
    const isFlaring = this.isBoosting || this.backfireTimer > 0;
    const isBackfireOnly = !this.isBoosting && this.backfireTimer > 0;

    this.exhaustFlames.forEach(f => {
      if (f.light) {
        f.light.intensity = this.isBoosting
          ? (5.0 + Math.random() * 2.5)
          : (isBackfireOnly ? 6.5 : 0);
        if (isBackfireOnly) {
          f.light.color.setHex(0xff7700);
        } else {
          f.light.color.setHex(0x00d9ff);
        }
      }
      if (f.cone) {
        f.cone.material.opacity = isFlaring ? 0.95 : 0;
        f.cone.scale.y = this.isBoosting ? (1.0 + Math.random() * 0.55) : (isBackfireOnly ? 0.75 : 0.1);
        if (f.cone.material.color) {
          f.cone.material.color.setHex(isBackfireOnly ? 0xff5500 : 0x00f0ff);
        }
      }
      if (f.core) {
        f.core.material.opacity = isFlaring ? 1.0 : 0;
        f.core.scale.y = this.isBoosting ? (0.8 + Math.random() * 0.4) : (isBackfireOnly ? 0.55 : 0.1);
        if (f.core.material.color) {
          f.core.material.color.setHex(isBackfireOnly ? 0xffdd44 : 0xffffff);
        }
      }
      if (f.intensity !== undefined) f.intensity = this.isBoosting ? 6.5 : (isBackfireOnly ? 5.0 : 0.8);
      if (f.userData && f.userData.cone) {
        f.userData.cone.material.opacity = isFlaring ? 0.92 : 0;
        f.userData.cone.scale.y = this.isBoosting ? (1.0 + Math.random() * 0.45) : (isBackfireOnly ? 0.7 : 0.1);
      }
    });

    // Update Exhaust Backfire Embers (InstancedMesh with zero heap allocations)
    if (this.emberMesh && this.emberParticles) {
      let anyEmberUpdated = false;
      for (let i = 0; i < this.maxEmbers; i++) {
        const p = this.emberParticles[i];
        if (p.active) {
          anyEmberUpdated = true;
          p.life -= dt;
          if (p.life <= 0) {
            p.active = false;
            this._emberMatrix.makeScale(0, 0, 0);
            this.emberMesh.setMatrixAt(i, this._emberMatrix);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 5.0 * dt; // gravity
            const currentScale = (p.life / p.maxLife) * p.scale;
            this._emberPos.set(p.x, p.y, p.z);
            this._emberScale.setScalar(Math.max(0.001, currentScale));
            this._emberMatrix.compose(this._emberPos, this._emberQuat, this._emberScale);
            this.emberMesh.setMatrixAt(i, this._emberMatrix);
          }
        }
      }
      if (anyEmberUpdated) {
        this.emberMesh.instanceMatrix.needsUpdate = true;
      }
    }

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

  getMaterialTelemetry() {
    let hasPhysicalClearcoat = false;
    let clearcoatVal = 0;
    let clearcoatRoughnessVal = 0;
    let carbonCount = 0;
    let hasCockpit = false;
    const blurMeshCount = this.wheelBlurMeshes ? this.wheelBlurMeshes.length : 0;

    if (this.carModel) {
      this.carModel.traverse(node => {
        if (node.name === 'CockpitInterior') {
          hasCockpit = true;
        }
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => {
            if (m.clearcoat !== undefined && m.clearcoat > 0) {
              hasPhysicalClearcoat = true;
              clearcoatVal = Math.max(clearcoatVal, m.clearcoat);
              clearcoatRoughnessVal = m.clearcoatRoughness;
            }
            if (m.map && m.map.name === 'CarbonFiberProcedural') {
              carbonCount++;
            }
          });
        }
      });
    }

    return {
      hasPhysicalClearcoat,
      clearcoat: clearcoatVal,
      clearcoatRoughness: clearcoatRoughnessVal,
      carbonMeshCount: carbonCount,
      hasCockpit,
      wheelBlurFactor: parseFloat((this.currentWheelBlurFactor || 0).toFixed(3)),
      activeBlurMeshes: blurMeshCount,
      vehicleId: this.currentVehicleId
    };
  }

  getVfxTelemetry() {
    let activeEmbers = 0;
    if (this.emberParticles) {
      for (let i = 0; i < this.emberParticles.length; i++) {
        if (this.emberParticles[i].active) activeEmbers++;
      }
    }
    return {
      backfireActive: Boolean(this.backfireTimer && this.backfireTimer > 0),
      backfireTimer: parseFloat((this.backfireTimer || 0).toFixed(3)),
      backfireCount: this.backfireCount || 0,
      activeEmbers,
      maxEmbers: this.maxEmbers || 24
    };
  }
}
