// Road Riot 3D - Procedural Highway, Cyber Billboards, Stunt Ramps & Speed Dash Panels
import * as THREE from 'three';

export const LIGHTING_PRESETS = {
  day: {
    sunPos: new THREE.Vector3(-45, 60, -90),
    sunColor: new THREE.Color(0xfff6ea),
    sunIntensity: 3.2,
    hemiSky: new THREE.Color(0x8cd6ff),
    hemiGround: new THREE.Color(0x18243b),
    hemiIntensity: 2.2,
    moonColor: new THREE.Color(0x4095ff),
    moonIntensity: 0.3,
    skyTop: new THREE.Color(0x061126),
    skyMid: new THREE.Color(0x28123a),
    skyBot: new THREE.Color(0x60b8ff),
    fogColor: new THREE.Color(0x122036),
    starsOpacity: 0.0,
    headlightsRequired: false
  },
  sunset: {
    sunPos: new THREE.Vector3(-75, 18, -120),
    sunColor: new THREE.Color(0xff6622),
    sunIntensity: 3.6,
    hemiSky: new THREE.Color(0xb04470),
    hemiGround: new THREE.Color(0x281008),
    hemiIntensity: 1.8,
    moonColor: new THREE.Color(0x5599ff),
    moonIntensity: 0.5,
    skyTop: new THREE.Color(0x120822),
    skyMid: new THREE.Color(0x882830),
    skyBot: new THREE.Color(0xff7722),
    fogColor: new THREE.Color(0x2c0f20),
    starsOpacity: 0.2,
    headlightsRequired: true
  },
  night: {
    sunPos: new THREE.Vector3(-45, -35, -90),
    sunColor: new THREE.Color(0x111c2e),
    sunIntensity: 0.4,
    hemiSky: new THREE.Color(0x08152e),
    hemiGround: new THREE.Color(0x02050e),
    hemiIntensity: 0.85,
    moonColor: new THREE.Color(0x4095ff),
    moonIntensity: 1.25,
    skyTop: new THREE.Color(0x02040a),
    skyMid: new THREE.Color(0x070e1c),
    skyBot: new THREE.Color(0x0c1e38),
    fogColor: new THREE.Color(0x050a14),
    starsOpacity: 1.0,
    headlightsRequired: true
  },
  dawn: {
    sunPos: new THREE.Vector3(60, 20, -100),
    sunColor: new THREE.Color(0xffa07a),
    sunIntensity: 2.6,
    hemiSky: new THREE.Color(0x8070aa),
    hemiGround: new THREE.Color(0x1c1420),
    hemiIntensity: 1.6,
    moonColor: new THREE.Color(0x4095ff),
    moonIntensity: 0.4,
    skyTop: new THREE.Color(0x080e22),
    skyMid: new THREE.Color(0x381a38),
    skyBot: new THREE.Color(0xffaa88),
    fogColor: new THREE.Color(0x18182a),
    starsOpacity: 0.1,
    headlightsRequired: false
  }
};

/**
 * ScreenDropletSystem: Screen-space camera lens / windshield water droplet refraction
 * and Arctic blizzard edge frost vignette. Zero per-frame heap allocations.
 */
export class ScreenDropletSystem {
  constructor(canvasElement = null) {
    this.canvas = canvasElement || (typeof document !== 'undefined' ? document.getElementById('weather-screen-fx') : null);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.dropletCount = 55;
    this.droplets = [];
    this.time = 0;
    this.frostAlpha = 0;

    // Pre-allocate 55 static droplets to guarantee 0 per-frame heap allocations
    for (let i = 0; i < this.dropletCount; i++) {
      this.droplets.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        radius: 2.0 + Math.random() * 3.2,
        speedY: 75 + Math.random() * 180,
        length: 12 + Math.random() * 26,
        alpha: 0.35 + Math.random() * 0.45,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleFreq: 1.5 + Math.random() * 2.0
      });
    }

    if (typeof window !== 'undefined' && this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth || 1280;
    this.canvas.height = window.innerHeight || 720;
  }

  update(dt, weatherType, roadSpeedKmh = 0) {
    this.time += dt;

    if (weatherType === 'rain') {
      this.frostAlpha = Math.max(0, this.frostAlpha - dt * 2.0);
    } else if (weatherType === 'snow') {
      const targetFrost = Math.min(0.65, 0.25 + (roadSpeedKmh / 240.0) * 0.4);
      this.frostAlpha += (targetFrost - this.frostAlpha) * Math.min(1, dt * 2.0);
    } else {
      this.frostAlpha = Math.max(0, this.frostAlpha - dt * 3.0);
    }

    if (!this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (weatherType === 'rain') {
      const speedFactor = 1.0 + Math.min(2.5, roadSpeedKmh / 120.0);

      for (let i = 0; i < this.dropletCount; i++) {
        const d = this.droplets[i];
        d.y += d.speedY * dt * speedFactor;
        d.x += Math.sin(this.time * d.wobbleFreq + d.wobblePhase) * 0.45;

        // Draw bead trail
        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(180, 230, 255, ${d.alpha * 0.28})`;
        this.ctx.lineWidth = d.radius * 0.6;
        this.ctx.lineCap = 'round';
        this.ctx.moveTo(d.x, d.y - d.length);
        this.ctx.lineTo(d.x, d.y);
        this.ctx.stroke();

        // Draw head refraction droplet
        const grad = this.ctx.createRadialGradient(d.x - d.radius * 0.3, d.y - d.radius * 0.3, 0.5, d.x, d.y, d.radius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${d.alpha * 0.95})`);
        grad.addColorStop(0.5, `rgba(140, 210, 255, ${d.alpha * 0.55})`);
        grad.addColorStop(1, `rgba(40, 90, 140, ${d.alpha * 0.25})`);
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Recycle offscreen droplets
        if (d.y > h + 25) {
          d.y = -10 - Math.random() * 20;
          d.x = Math.random() * w;
          d.radius = 2.0 + Math.random() * 3.2;
          d.speedY = 75 + Math.random() * 180;
        }
      }
    } else if (weatherType === 'snow') {
      // Windshield corner frost accumulation during blizzard
      if (this.frostAlpha > 0.01) {
        const frostGrad = this.ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.68);
        frostGrad.addColorStop(0, 'rgba(200, 235, 255, 0)');
        frostGrad.addColorStop(0.7, `rgba(215, 240, 255, ${this.frostAlpha * 0.3})`);
        frostGrad.addColorStop(1, `rgba(240, 250, 255, ${this.frostAlpha * 0.85})`);
        this.ctx.fillStyle = frostGrad;
        this.ctx.fillRect(0, 0, w, h);
      }
    }
  }
}

/**
 * TireWaterSprayPlumeSystem: High-velocity atomized asphalt water spray plumes
 * trailing behind vehicle tires at speeds > 140 km/h.
 * Built with pre-allocated THREE.InstancedMesh to guarantee 0 per-frame allocations.
 */
export class TireWaterSprayPlumeSystem {
  constructor(scene) {
    this.scene = scene;
    this.maxInstances = 120; // 60 left rear, 60 right rear
    this.instances = [];
    this.spawnIndex = 0;
    this.sprayIntensity = 0;

    // Zero-allocation scratch objects
    this._dummyMatrix = new THREE.Matrix4();
    this._dummyPos = new THREE.Vector3();
    this._dummyScale = new THREE.Vector3();
    this._dummyQuat = new THREE.Quaternion();
    this._dummyColor = new THREE.Color();

    // Create particle sprite texture
    let sprayTex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.35, 'rgba(180, 225, 255, 0.6)');
      grad.addColorStop(0.7, 'rgba(120, 190, 240, 0.2)');
      grad.addColorStop(1, 'rgba(100, 170, 230, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      sprayTex = new THREE.CanvasTexture(c);
    } else {
      sprayTex = new THREE.Texture();
    }

    const geo = new THREE.PlaneGeometry(0.85, 0.85);
    const mat = new THREE.MeshBasicMaterial({
      map: sprayTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // Pre-allocate instance state objects
    for (let i = 0; i < this.maxInstances; i++) {
      this.instances.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0.1,
        maxScale: 1.8,
        life: 0,
        maxLife: 0.45,
        alpha: 0
      });
      // Hide initially
      this._dummyMatrix.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._dummyMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, playerX = 0, playerZ = -8, speedKmh = 0, isWetRoad = false) {
    // Activate only above 140 km/h (speed > 15.55) on wet/rain roads
    if (isWetRoad && speedKmh > 140) {
      this.sprayIntensity = Math.min(1.0, Math.max(0.0, (speedKmh - 140) / 75.0));
    } else {
      this.sprayIntensity = Math.max(0, this.sprayIntensity - dt * 3.5);
    }

    if (this.sprayIntensity <= 0.001) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    // Spawn 2 new spray particles per frame (one for left tire, one for right tire)
    const tireOffsets = [-0.95, 0.95];
    tireOffsets.forEach(ox => {
      const p = this.instances[this.spawnIndex];
      p.active = true;
      p.x = playerX + ox + (Math.random() - 0.5) * 0.18;
      p.y = 0.12 + Math.random() * 0.15;
      p.z = playerZ + 2.15 + Math.random() * 0.2;
      p.vx = (ox < 0 ? -1 : 1) * (0.8 + Math.random() * 1.5);
      p.vy = 1.6 + Math.random() * 2.8;
      p.vz = 8.0 + Math.random() * 12.0; // Pushed backward with road slipstream
      p.scale = 0.25;
      p.maxScale = 1.4 + Math.random() * 1.2;
      p.life = 0.35 + Math.random() * 0.2;
      p.maxLife = p.life;
      this.spawnIndex = (this.spawnIndex + 1) % this.maxInstances;
    });

    // Update active instances and write directly into instanced matrix buffer
    for (let i = 0; i < this.maxInstances; i++) {
      const p = this.instances[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummyMatrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._dummyMatrix);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const progress = 1.0 - (p.life / p.maxLife);
      const curScale = p.scale + (p.maxScale - p.scale) * progress;

      this._dummyPos.set(p.x, p.y, p.z);
      this._dummyScale.set(curScale, curScale, curScale);
      this._dummyMatrix.compose(this._dummyPos, this._dummyQuat, this._dummyScale);
      this.mesh.setMatrixAt(i, this._dummyMatrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class WorldManager {
  constructor(scene, renderer = null) {
    this.scene = scene;
    this.renderer = renderer;
    this.segments = [];
    this.segmentLength = 15;
    this.segmentCount = 30;
    this.roadWidth = 18;
    this.currentTheme = 'cyberpunk';

    // Interactive World Objects (Dash Panels & Jump Ramps)
    this.speedPanels = [];
    this.jumpRamps = [];

    // Billboards and props
    this.billboardTextures = [];

    // Weather & Sky
    this.skyMesh = null;
    this.sunMesh = null;
    this.hemiLight = null;
    this.dirLight = null;

    // Day/Night Diurnal Lighting Cycle
    this.lightingCycleDistance = 3600; // 3.6 km per complete day-sunset-night-dawn cycle
    this.cycleProgress = 0;
    this.currentLightingPhase = 'day';
    this.timeOfDay = 'day';
    this.headlightsRequired = false;
    this.baseSunIntensity = 3.2;
    this.baseHemiIntensity = 2.2;
    this.baseMoonIntensity = 0.85;

    // Subterranean Concrete Highway Tunnel System
    this.tunnelSegments = [];
    this.tunnelLights = [];
    this.isInsideTunnel = false;
    this.tunnelTransition = 0;

    // Day 11: Neo-Tokyo Biome Overhaul, Wet Asphalt, Monorail & Highway Infrastructures
    this.roadWetness = 0.0;
    this.targetWetness = 0.0;
    this.baseRoadRoughness = 0.35;
    this.wetRoadRoughness = 0.09;
    this.baseRoadMetalness = 0.28;
    this.wetRoadMetalness = 0.78;
    this.holographicBillboards = [];
    this.hologramGlitchTimer = 0.0;
    this.hologramScanlinePhase = 0.0;
    this.soundBarriers = [];
    this.gantries = [];
    this.monorailTrain = null;
    this.monorailSpeed = 34.0; // ~306 km/h overhead cruising speed
    this.monorailPylons = [];
    this.puddleNoiseTexture = null;

    // Day 12: Red Rock Canyon & Arctic Tundra Biome Overhaul, Black Ice & Cat's Eyes
    this.canyonCliffs = [];
    this.canyonArchways = [];
    this.dustDevils = [];
    this.tumbleweeds = [];
    this.blackIcePatches = [];
    this.roadReflectors = [];
    this.lastPlayerOnBlackIce = false;
    this.lastSurfaceFriction = 1.0;
    this.activeCatEyesCount = 0;

    // Scratch color objects for zero-allocation lighting lerp
    this._targetSunColor = new THREE.Color();
    this._targetHemiSky = new THREE.Color();
    this._targetHemiGround = new THREE.Color();
    this._targetSkyTop = new THREE.Color();
    this._targetSkyMid = new THREE.Color();
    this._targetSkyBot = new THREE.Color();
    this._targetFogColor = new THREE.Color();

    // Challenge Marker
    this.challengeDistance = null;
    this.challengeMarker = null;
    this.challengePassed = false;

    // Environmental Dynamic Weather Particles (Rain / Snow / Canyon Dust)
    this.weatherType = 'none';
    this.weatherParticleCount = 800;
    this.weatherParticles = null;
    this.weatherPositions = null;
    this.weatherVelocities = null;
    this.pedestrians = [];

    this.initLighting();
    this.initSky();
    if (this.renderer) {
      this.initEnvironmentMap(this.renderer);
    }
    this.initBillboardCanvases();
    this.initHighwayMaterials();
    this.initWeatherParticles();
    this.screenDroplets = new ScreenDropletSystem();
    this.tireSpray = new TireWaterSprayPlumeSystem(this.scene);
    this.initMonorailTrain();
    this.initDynamicDustDevils();
    this.initBlowingTumbleweeds();
    this.buildInitialHighway();
  }

  initHighwayMaterials() {
    this.concreteBeamMat = new THREE.MeshStandardMaterial({ color: 0x161e2b, roughness: 0.85, metalness: 0.25 });
    this.maglevRailMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    this.soundBarrierPostMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 });
    this.soundBarrierPanelMat = new THREE.MeshStandardMaterial({
      color: 0x0e3b4a,
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.65
    });
    this.gantryTrussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });
    this.hologramAuraMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    // Day 12 Materials
    this.canyonRockMat = new THREE.MeshStandardMaterial({ color: 0xc4542d, roughness: 0.88, metalness: 0.10 });
    this.canyonArchMat = new THREE.MeshStandardMaterial({ color: 0xdb6235, roughness: 0.82, metalness: 0.12 });
    this.tumbleweedMat = new THREE.MeshStandardMaterial({ color: 0x9e784f, roughness: 0.95, metalness: 0.05 });
    this.dustDevilMat = new THREE.MeshBasicMaterial({
      color: 0xdf9c68,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.blackIceMat = new THREE.MeshStandardMaterial({
      color: 0x08121c,
      roughness: 0.04,
      metalness: 0.88,
      transparent: true,
      opacity: 0.85
    });
    this.catEyeStudMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.35 });
    this.catEyeLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe066,
      emissiveIntensity: 0.2,
      roughness: 0.1,
      metalness: 0.9
    });

    if (typeof document === 'undefined' || !document.createElement) {
      this.roadMaterial = new THREE.MeshStandardMaterial({ color: 0x111722, roughness: this.baseRoadRoughness, metalness: this.baseRoadMetalness });
      this.curbMat = new THREE.MeshStandardMaterial({ color: 0x1e2838, roughness: 0.6, metalness: 0.2 });
      this.walkMat = new THREE.MeshStandardMaterial({ color: 0x0c121e, roughness: 0.8, metalness: 0.15 });
      this.buildingMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x0a101d, roughness: 0.35, metalness: 0.65 }),
        new THREE.MeshStandardMaterial({ color: 0x0f1523, roughness: 0.35, metalness: 0.65 })
      ];
      this.tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x121822, roughness: 0.85, metalness: 0.2 });
      this.tunnelRoofMat = new THREE.MeshStandardMaterial({ color: 0x0e131c, roughness: 0.90, metalness: 0.15 });
      this.tunnelPortalMat = new THREE.MeshStandardMaterial({ color: 0x222a36, roughness: 0.70, metalness: 0.4 });
      return;
    }

    // Procedural Sandstone Sedimentary Strata Texture
    const sc = document.createElement('canvas');
    sc.width = 512;
    sc.height = 512;
    const sctx = sc.getContext('2d');
    const strataColors = ['#9e3c1b', '#c4542d', '#b04523', '#d96e43', '#823015', '#e08358', '#6b250e'];
    let sy = 0;
    while (sy < 512) {
      const sh = 10 + Math.floor(Math.random() * 26);
      sctx.fillStyle = strataColors[Math.floor(Math.random() * strataColors.length)];
      sctx.fillRect(0, sy, 512, sh);
      sy += sh;
    }
    this.sandstoneTexture = new THREE.CanvasTexture(sc);
    this.sandstoneTexture.wrapS = THREE.RepeatWrapping;
    this.sandstoneTexture.wrapT = THREE.RepeatWrapping;
    this.canyonRockMat.map = this.sandstoneTexture;
    this.canyonArchMat.map = this.sandstoneTexture;

    this.tunnelWallMat = new THREE.MeshStandardMaterial({ color: 0x121822, roughness: 0.85, metalness: 0.2 });
    this.tunnelRoofMat = new THREE.MeshStandardMaterial({ color: 0x0e131c, roughness: 0.90, metalness: 0.15 });
    this.tunnelPortalMat = new THREE.MeshStandardMaterial({ color: 0x222a36, roughness: 0.70, metalness: 0.4 });

    // 0. Procedural Puddle Specular / Noise Texture (512x256)
    const pc = document.createElement('canvas');
    pc.width = 512;
    pc.height = 256;
    const pctx = pc.getContext('2d');
    pctx.fillStyle = '#111722';
    pctx.fillRect(0, 0, 512, 256);
    // Draw smooth organic puddle patches
    pctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
    for (let p = 0; p < 18; p++) {
      const px = ((p * 79 + 37) % 480) + 16;
      const py = ((p * 47 + 23) % 220) + 16;
      const pr = 14 + (p % 5) * 8;
      pctx.beginPath();
      pctx.ellipse(px, py, pr * 1.6, pr, 0, 0, Math.PI * 2);
      pctx.fill();
    }
    this.puddleNoiseTexture = new THREE.CanvasTexture(pc);
    this.puddleNoiseTexture.wrapS = THREE.RepeatWrapping;
    this.puddleNoiseTexture.wrapT = THREE.RepeatWrapping;

    // 1. Ultra High-Res Anti-Aliased Highway Surface Texture (2048x1024)
    // Eliminates geometric line aliasing and pixel crawling down the road
    const rc = document.createElement('canvas');
    rc.width = 1024;
    rc.height = 512;
    const rctx = rc.getContext('2d');

    // Deep rich asphalt base
    rctx.fillStyle = '#111722';
    rctx.fillRect(0, 0, 1024, 512);

    // Fine asphalt aggregate speckling
    rctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 3000; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 512;
      rctx.fillRect(rx, ry, 2, 2);
    }

    // Glowing Neon Lane Divider Dashes at X = -3m and X = +3m (lanes at -6, 0, +6)
    // 1024 px width corresponds to 21m road width (-10.5m to +10.5m)
    const dashX1 = Math.round((7.5 / 21) * 1024);
    const dashX2 = Math.round((13.5 / 21) * 1024);

    rctx.shadowColor = '#00f0ff';
    rctx.shadowBlur = 10;
    rctx.fillStyle = '#00d9ff';

    // Anti-aliased smooth dashes along Z (512px height corresponds to 15m segment length)
    [dashX1, dashX2].forEach(dx => {
      rctx.fillRect(dx - 5, 50, 10, 140);
      rctx.fillRect(dx - 5, 310, 10, 140);
    });

    // High-visibility Neon Shoulder Border Strips
    rctx.shadowBlur = 12;
    rctx.shadowColor = '#ff2a85';
    rctx.fillStyle = '#ff2a85';
    rctx.fillRect(10, 0, 8, 512); // Left shoulder neon

    rctx.shadowColor = '#00d9ff';
    rctx.fillStyle = '#00d9ff';
    rctx.fillRect(1006, 0, 8, 512); // Right shoulder neon

    this.roadTexture = new THREE.CanvasTexture(rc);
    this.roadTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.roadTexture.wrapT = THREE.RepeatWrapping;
    this.roadTexture.colorSpace = THREE.SRGBColorSpace;
    this.roadTexture.anisotropy = 16;
    this.roadTexture.generateMipmaps = true;
    this.roadTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.roadTexture.magFilter = THREE.LinearFilter;

    this.roadMaterial = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: this.baseRoadRoughness,
      metalness: this.baseRoadMetalness
    });

    this.curbMat = new THREE.MeshStandardMaterial({ color: 0x1e2838, roughness: 0.6, metalness: 0.2 });
    this.walkMat = new THREE.MeshStandardMaterial({ color: 0x0c121e, roughness: 0.8, metalness: 0.15 });

    // 2. High-Resolution Skyscraper Façade Textures
    // Consolidates ~2,700 individual window boxes into unified high-res textures (<80 total scene draw calls)
    const fa = document.createElement('canvas');
    fa.width = 512;
    fa.height = 512;
    const fctxA = fa.getContext('2d');
    fctxA.fillStyle = '#0a101d';
    fctxA.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) {
      fctxA.fillStyle = '#162033';
      fctxA.fillRect(x, 0, 4, 512);
    }
    for (let y = 16; y < 512; y += 32) {
      for (let x = 6; x < 512; x += 32) {
        if ((x + y) % 5 !== 0) {
          const isBright = (x * 3 + y) % 7 === 0;
          fctxA.fillStyle = isBright ? '#a5f3fc' : '#0284c7';
          fctxA.fillRect(x, y, 20, 16);
        }
      }
    }
    const texA = new THREE.CanvasTexture(fa);
    texA.wrapS = THREE.RepeatWrapping;
    texA.wrapT = THREE.RepeatWrapping;
    texA.colorSpace = THREE.SRGBColorSpace;
    texA.anisotropy = 16;

    const fb = document.createElement('canvas');
    fb.width = 512;
    fb.height = 512;
    const fctxB = fb.getContext('2d');
    fctxB.fillStyle = '#0d131a';
    fctxB.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) {
      fctxB.fillStyle = '#1c2430';
      fctxB.fillRect(x, 0, 4, 512);
    }
    for (let y = 16; y < 512; y += 32) {
      for (let x = 6; x < 512; x += 32) {
        if ((x + y) % 4 !== 0) {
          const isBright = (x + y * 2) % 9 === 0;
          fctxB.fillStyle = isBright ? '#fef08a' : '#d97706';
          fctxB.fillRect(x, y, 20, 16);
        }
      }
    }
    const texB = new THREE.CanvasTexture(fb);
    texB.wrapS = THREE.RepeatWrapping;
    texB.wrapT = THREE.RepeatWrapping;
    texB.colorSpace = THREE.SRGBColorSpace;
    texB.anisotropy = 16;

    this.buildingMaterials = [
      new THREE.MeshStandardMaterial({ map: texA, roughness: 0.35, metalness: 0.65 }),
      new THREE.MeshStandardMaterial({ map: texB, roughness: 0.35, metalness: 0.65 })
    ];
  }

  initWeatherParticles() {
    // 1. 3D Laser Rain Streaks (True Line Segments for Realistic Torrential Rain)
    this.rainDropCount = 1400;
    this.rainPositions = new Float32Array(this.rainDropCount * 6); // 2 vertices (x,y,z) per drop
    this.rainVelocities = new Float32Array(this.rainDropCount * 3);
    this.rainLengths = new Float32Array(this.rainDropCount);

    for (let i = 0; i < this.rainDropCount; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 32 + 2;
      const z = (Math.random() - 0.5) * 90 - 15;
      const len = 1.6 + Math.random() * 1.4;
      this.rainLengths[i] = len;

      // Head (bottom)
      this.rainPositions[i * 6] = x;
      this.rainPositions[i * 6 + 1] = y;
      this.rainPositions[i * 6 + 2] = z;

      // Tail (top)
      this.rainPositions[i * 6 + 3] = x + 0.15;
      this.rainPositions[i * 6 + 4] = y + len;
      this.rainPositions[i * 6 + 5] = z + 0.35;

      this.rainVelocities[i * 3] = -2.0 + (Math.random() - 0.5) * 1.5;
      this.rainVelocities[i * 3 + 1] = -72 - Math.random() * 24; // Fast torrential fall
      this.rainVelocities[i * 3 + 2] = -4 + (Math.random() - 0.5) * 2;
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x7fe3ff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.rainMesh = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);

    // 2. Soft Snow Particle Sprites for Arctic Frostway
    const geo = new THREE.BufferGeometry();
    this.weatherPositions = new Float32Array(this.weatherParticleCount * 3);
    this.weatherVelocities = new Float32Array(this.weatherParticleCount * 3);

    for (let i = 0; i < this.weatherParticleCount; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 55;
      this.weatherPositions[i * 3 + 1] = Math.random() * 30 + 1;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 15;

      this.weatherVelocities[i * 3] = (Math.random() - 0.5) * 3.5;
      this.weatherVelocities[i * 3 + 1] = -7 - Math.random() * 5;
      this.weatherVelocities[i * 3 + 2] = (Math.random() - 0.5) * 5.0;
    }

    // High quality soft circular particle texture for snow
    let particleTex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 32;
      pCanvas.height = 32;
      const pctx = pCanvas.getContext('2d');
      const grad = pctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, 32, 32);
      particleTex = new THREE.CanvasTexture(pCanvas);
    } else {
      particleTex = new THREE.Texture();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      map: particleTex,
      color: 0xe8f4ff,
      size: 0.95,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.weatherParticles = new THREE.Points(geo, this.weatherMat);
    this.weatherParticles.visible = false;
    this.scene.add(this.weatherParticles);
  }

  setWeatherType(type) {
    this.weatherType = type;
    if (type === 'rain') {
      if (this.rainMesh) this.rainMesh.visible = true;
      if (this.weatherParticles) this.weatherParticles.visible = false;
    } else if (type === 'snow') {
      if (this.rainMesh) this.rainMesh.visible = false;
      if (this.weatherParticles) {
        this.weatherParticles.visible = true;
        this.weatherMat.opacity = 0.65;
        this.weatherMat.size = 0.95;
        this.weatherMat.color.setHex(0xe8f4ff);
      }
    } else {
      if (this.rainMesh) this.rainMesh.visible = false;
      if (this.weatherParticles) this.weatherParticles.visible = false;
    }
  }

  initLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x8cd6ff, 0x0c1424, 2.2);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffb566, 3.2);
    this.dirLight.position.set(-45, 60, -90);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 280;
    this.dirLight.shadow.camera.left = -35;
    this.dirLight.shadow.camera.right = 35;
    this.dirLight.shadow.camera.top = 35;
    this.dirLight.shadow.camera.bottom = -35;
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.025;
    this.dirLight.shadow.radius = 3.6;
    this.scene.add(this.dirLight);

    this.ambientMoon = new THREE.DirectionalLight(0x4095ff, 0.85);
    this.ambientMoon.position.set(45, 30, 45);
    this.scene.add(this.ambientMoon);
  }

  initEnvironmentMap(renderer, horizonHex = 0xd94b76, topHex = 0x061126) {
    if (!renderer) return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(120, 32, 16);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(topHex) },
          horizonColor: { value: new THREE.Color(horizonHex) },
          groundColor: { value: new THREE.Color(0x040812) }
        },
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 groundColor;
          varying vec3 vWorldPos;
          void main() {
            float h = normalize(vWorldPos).y;
            vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.55)) : mix(horizonColor, groundColor, pow(-h, 0.55));
            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      // Specular High-Luminance Neon Billboard Accents
      const neonBillboards = [
        { c: 0x00f0ff, p: [-40, 22, -60] },
        { c: 0xff2a85, p: [40, 22, -60] },
        { c: 0xffea00, p: [0, 38, 45] }
      ];
      neonBillboards.forEach(nb => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(26, 10, 2),
          new THREE.MeshBasicMaterial({ color: nb.c })
        );
        mesh.position.set(...nb.p);
        envScene.add(mesh);
      });

      const envMap = pmrem.fromScene(envScene).texture;
      this.scene.environment = envMap;
      pmrem.dispose();
    } catch (e) {
      console.warn('Environment map generation failed:', e);
    }
  }

  initSky() {
    const skyGeo = new THREE.SphereGeometry(260, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x050c1e) },
        midColor: { value: new THREE.Color(0x28123a) },
        botColor: { value: new THREE.Color(0xd94b76) },
        offset: { value: 0.15 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform float offset;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 col = mix(botColor, midColor, smoothstep(-0.1, 0.35, h));
          col = mix(col, topColor, smoothstep(0.35, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyMesh);

    // Glowing Retro Sun Disc
    const sunGeo = new THREE.SphereGeometry(12, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(-65, 52, -220);
    this.scene.add(this.sunMesh);

    // Stars particle field with smooth circular pinpoint texture (eliminates square pixel boxes)
    let starTex = null;
    if (typeof document !== 'undefined' && document.createElement) {
      const starCanvas = document.createElement('canvas');
      starCanvas.width = 32;
      starCanvas.height = 32;
      const sctx = starCanvas.getContext('2d');
      const sGrad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      sGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      sGrad.addColorStop(0.3, 'rgba(180, 230, 255, 0.8)');
      sGrad.addColorStop(1, 'rgba(180, 230, 255, 0)');
      sctx.fillStyle = sGrad;
      sctx.fillRect(0, 0, 32, 32);
      starTex = new THREE.CanvasTexture(starCanvas);
    } else {
      starTex = new THREE.Texture();
    }

    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9);
      const r = 240;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.max(20, r * Math.cos(phi));
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      map: starTex,
      color: 0x99ddff,
      size: 1.2,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  initBillboardCanvases() {
    if (typeof document === 'undefined' || !document.createElement) {
      this.billboardTextures = [new THREE.Texture()];
      this.gantryTexture = new THREE.Texture();
      return;
    }

    const ads = [
      {
        header: 'NEO-TOKYO // 新宿',
        sub: 'MIDNIGHT EXPRESSWAY',
        tag: 'VALIXIS AUTONOMOUS AI',
        bg: '#040b17',
        accent: '#00e5ff',
        glow: '#00aacc'
      },
      {
        header: 'CYBER DYNAMICS',
        sub: 'HYPER-DRIVE NITRO // 電脳',
        tag: '750 KW TURBINE HYBRID',
        bg: '#180412',
        accent: '#ff007f',
        glow: '#cc0066'
      },
      {
        header: 'SOUL EMBER // 魂の炎',
        sub: 'SURVIVORS ROGUELIKE',
        tag: 'PLAY FREE NOW • 8 HEROES',
        bg: '#200a05',
        accent: '#ff6a00',
        glow: '#ff4400'
      },
      {
        header: 'DEAD SIGNAL // 孤立',
        sub: 'ZOMBIE SURVIVAL FPS',
        tag: 'HOLD THE RELAY STATION',
        bg: '#08180c',
        accent: '#9dff4d',
        glow: '#66cc22'
      },
      {
        header: 'KINETIC // 磁気浮上',
        sub: 'MAGLEV TRANSIT NETWORK',
        tag: 'NEO EXPRESS LINE 01',
        bg: '#161204',
        accent: '#ffea00',
        glow: '#cca000'
      }
    ];

    this.billboardTextures = ads.map(ad => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, ad.bg);
      grad.addColorStop(1, '#04060a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 496, 240);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 20; x < 512; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, 240);
        ctx.stroke();
      }

      ctx.shadowColor = ad.glow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ad.header, 256, 88);

      ctx.shadowBlur = 10;
      ctx.fillStyle = ad.accent;
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(ad.sub, 256, 138);

      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(70, 172, 372, 46);
      ctx.strokeStyle = ad.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(70, 172, 372, 46);

      ctx.fillStyle = '#f0f6fc';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(ad.tag, 256, 202);

      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      return texture;
    });

    // Overhead Highway Gantry Electronic Signs
    const gc = document.createElement('canvas');
    gc.width = 1024;
    gc.height = 256;
    const gctx = gc.getContext('2d');
    gctx.fillStyle = '#050c18';
    gctx.fillRect(0, 0, 1024, 256);
    gctx.strokeStyle = '#00d9ff';
    gctx.lineWidth = 8;
    gctx.strokeRect(8, 8, 1008, 240);

    // Subtle LED matrix grid background
    gctx.fillStyle = 'rgba(0, 217, 255, 0.05)';
    for (let x = 16; x < 1008; x += 16) {
      for (let y = 16; y < 240; y += 16) {
        gctx.fillRect(x, y, 4, 4);
      }
    }

    gctx.fillStyle = '#00f0ff';
    gctx.font = 'bold 64px "Orbitron", sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('VALIXIS EXPRESSWAY', 512, 95);

    gctx.fillStyle = '#ffea00';
    gctx.font = 'bold 36px "JetBrains Mono", monospace';
    gctx.fillText('SPEED LIMIT 320 KM/H • ALL LANES OPEN', 512, 175);

    gctx.fillStyle = '#00ff88';
    gctx.font = 'bold 22px "JetBrains Mono", monospace';
    gctx.fillText('▲ LANE 1: CLEAR ▲   ▲ LANE 2: EXPRESS ▲   ▲ LANE 3: CLEAR ▲', 512, 222);

    this.gantryTexture = new THREE.CanvasTexture(gc);
    this.gantryTexture.colorSpace = THREE.SRGBColorSpace;
    this.gantryTexture.anisotropy = 16;
  }

  setBiome(biomeId = 'midnight') {
    this.currentTheme = biomeId;
    if (!this.skyMat) return;

    const isCanyon = (biomeId === 'canyon');
    const isArctic = (biomeId === 'arctic');

    // Toggle segment group visibility based on active biome
    for (const seg of this.segments) {
      if (seg.userData.canyonGroup) seg.userData.canyonGroup.visible = isCanyon;
      if (seg.userData.arcticGroup) seg.userData.arcticGroup.visible = isArctic;
      if (seg.userData.cityGroup) seg.userData.cityGroup.visible = !isCanyon;
    }
    if (this.dustDevils) {
      for (const dd of this.dustDevils) dd.visible = isCanyon;
    }
    if (this.tumbleweeds) {
      for (const tw of this.tumbleweeds) tw.visible = isCanyon;
    }

    if (biomeId === 'canyon') {
      // Sunset Canyon: Amber twilight, rich gold sun, warm red sky (stars hidden in daytime twilight)
      this.skyMat.uniforms.topColor.value.setHex(0x1a0826);
      this.skyMat.uniforms.midColor.value.setHex(0xb84318);
      this.skyMat.uniforms.botColor.value.setHex(0xffaa33);
      if (this.dirLight) this.dirLight.color.setHex(0xff8833);
      if (this.hemiLight) this.hemiLight.color.setHex(0xffaa66);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0xffcc00);
      if (this.scene.fog) this.scene.fog.color.setHex(0x280e1a);
      if (this.stars) this.stars.visible = false;
      this.setWeatherType('none');
      this.targetWetness = 0.0;
      if (this.renderer) this.initEnvironmentMap(this.renderer, 0xffaa33, 0x1a0826);
    } else if (biomeId === 'neotokyo') {
      // Neo-Tokyo Rain: Moody teal and violet skyline, rainy atmosphere
      this.skyMat.uniforms.topColor.value.setHex(0x020712);
      this.skyMat.uniforms.midColor.value.setHex(0x180b2a);
      this.skyMat.uniforms.botColor.value.setHex(0x00d9ff);
      if (this.dirLight) this.dirLight.color.setHex(0x40a0ff);
      if (this.hemiLight) this.hemiLight.color.setHex(0x20e0ff);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0x00f0ff);
      if (this.scene.fog) this.scene.fog.color.setHex(0x061120);
      if (this.stars) this.stars.visible = false;
      this.setWeatherType('rain');
      this.targetWetness = 1.0;
      if (this.renderer) this.initEnvironmentMap(this.renderer, 0x00d9ff, 0x020712);
    } else if (biomeId === 'arctic') {
      // Arctic Frostway: Polar ice horizon, pale frost sun, swirling blizzard
      this.skyMat.uniforms.topColor.value.setHex(0x040e1c);
      this.skyMat.uniforms.midColor.value.setHex(0x163450);
      this.skyMat.uniforms.botColor.value.setHex(0x8ce2ff);
      if (this.dirLight) this.dirLight.color.setHex(0xa0e0ff);
      if (this.hemiLight) this.hemiLight.color.setHex(0x60c0ff);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0xccf0ff);
      if (this.scene.fog) this.scene.fog.color.setHex(0x0c223c);
      if (this.stars) this.stars.visible = false;
      this.setWeatherType('snow');
      this.targetWetness = 0.0;
      if (this.renderer) this.initEnvironmentMap(this.renderer, 0x8ce2ff, 0x040e1c);
    } else {
      // Midnight Metropolis (Default night sky with circular stars)
      this.skyMat.uniforms.topColor.value.setHex(0x050c1e);
      this.skyMat.uniforms.midColor.value.setHex(0x28123a);
      this.skyMat.uniforms.botColor.value.setHex(0xd94b76);
      if (this.dirLight) this.dirLight.color.setHex(0xffa550);
      if (this.hemiLight) this.hemiLight.color.setHex(0x75c8ff);
      if (this.sunMesh) this.sunMesh.material.color.setHex(0xffaa33);
      if (this.scene.fog) this.scene.fog.color.setHex(0x0c1322);
      if (this.stars) this.stars.visible = true;
      this.setWeatherType('none');
      this.targetWetness = 0.0;
      if (this.renderer) this.initEnvironmentMap(this.renderer, 0xd94b76, 0x050c1e);
    }
  }

  buildInitialHighway() {
    for (let i = 0; i < this.segmentCount; i++) {
      this.createSegment(i);
    }

    const foundationGeo = new THREE.BoxGeometry(this.roadWidth + 4, 0.4, 4000);
    const foundationMat = new THREE.MeshStandardMaterial({ color: 0x0c121e, roughness: 0.9 });
    this.foundation = new THREE.Mesh(foundationGeo, foundationMat);
    this.foundation.position.set(0, -0.4, -1800);
    this.scene.add(this.foundation);
  }

  createSegment(index) {
    const group = new THREE.Group();
    group.position.z = -index * this.segmentLength;

    // Road Surface (Unified High-Res Anti-Aliased Surface Texture)
    const roadGeo = new THREE.BoxGeometry(this.roadWidth, 0.3, this.segmentLength);
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMaterial);
    roadMesh.position.y = -0.15;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Guard Rails & Sidewalks (Curbs & Walks)
    [-this.roadWidth / 2, this.roadWidth / 2].forEach((x, side) => {
      const curbGeo = new THREE.BoxGeometry(0.8, 0.35, this.segmentLength);
      const curb = new THREE.Mesh(curbGeo, this.curbMat);
      curb.position.set(x + (side === 0 ? -0.4 : 0.4), 0.05, 0);
      curb.receiveShadow = true;
      group.add(curb);

      const walkGeo = new THREE.BoxGeometry(7, 0.2, this.segmentLength);
      const walk = new THREE.Mesh(walkGeo, this.walkMat);
      walk.position.set(x + (side === 0 ? -4.3 : 4.3), -0.05, 0);
      walk.receiveShadow = true;
      group.add(walk);
    });

    // Day 12: Retro-Reflective Highway Cat's Eyes (Embedded along all segments)
    this.createRoadReflectors(group, index);

    const isTunnel = (index >= 18 && index <= 21);
    if (isTunnel) {
      this.createTunnelSegment(group, index, index === 18, index === 21);
    } else {
      // 1. City / Metropolis Scenery Group
      const cityGroup = new THREE.Group();
      cityGroup.name = `CityGroup_${index}`;
      cityGroup.visible = (this.currentTheme !== 'canyon');
      group.userData.cityGroup = cityGroup;

      // Street Lights (every 3 segments)
      if (index % 3 === 0) {
        this.createStreetLight(cityGroup, -10.2, 1);
        this.createStreetLight(cityGroup, 10.2, -1);
      }

      // Elevated Monorail Track Guideway (continuous elevated rail at Y = 13.5m)
      this.createMonorailGuideway(cityGroup, index);

      // Roadside Highway Acoustic Sound Barriers (segments % 4 === 1 or 2, outside tunnel)
      if (index % 4 === 1 || index % 4 === 2) {
        this.createSoundBarriers(cityGroup, index);
      }

      // Overhead Expressway Gantry Signs (every 10 segments at index % 10 === 5, outside tunnel)
      if (index % 10 === 5) {
        this.createOverheadGantry(cityGroup, index);
      }

      // Neon Cyber Holographic Billboard (every 5 segments)
      if (index % 5 === 2) {
        const side = (index % 10 === 2) ? -1 : 1;
        this.createCyberBillboard(cityGroup, side * 15.5, (index / 5) % this.billboardTextures.length);
      }

      // Roadside Buildings
      this.createRoadsideBuildings(cityGroup, index);

      // Pedestrian Sidewalk Spectators & Cheerers (every 3 segments)
      if (index % 3 === 1) {
        this.createSidewalkPedestrians(cityGroup, index);
      }

      // Modern Elevated Glass Pedestrian Skywalk (every 14 segments)
      if (index % 14 === 7) {
        this.createPedestrianSkywalk(cityGroup, index);
      }
      group.add(cityGroup);

      // 2. Canyon Scenery Group (Sandstone Cliffs & Natural Rock Archways)
      const canyonGroup = new THREE.Group();
      canyonGroup.name = `CanyonGroup_${index}`;
      canyonGroup.visible = (this.currentTheme === 'canyon');
      group.userData.canyonGroup = canyonGroup;
      this.createCanyonCliffs(canyonGroup, index);
      if (index % 12 === 4) {
        this.createCanyonArchway(canyonGroup, index);
      }
      group.add(canyonGroup);

      // 3. Arctic Scenery Group (Black Ice Patches)
      const arcticGroup = new THREE.Group();
      arcticGroup.name = `ArcticGroup_${index}`;
      arcticGroup.visible = (this.currentTheme === 'arctic');
      group.userData.arcticGroup = arcticGroup;
      if (index % 4 === 1 || index % 4 === 2) {
        this.createBlackIcePatches(arcticGroup, index);
      }
      group.add(arcticGroup);
    }

    // Interactive Highway Objects:
    // Stunt Jump Ramp (every 11 segments, in one lane)
    if (index % 11 === 4 && !isTunnel) {
      const rampLane = [-6, 0, 6][(index * 2) % 3];
      this.createJumpRamp(group, rampLane);
    }

    // Highway Speed Booster Panel (every 7 segments, in one lane)
    if (index % 7 === 3 && !isTunnel) {
      const boostLane = [-6, 0, 6][(index * 3) % 3];
      this.createSpeedPanel(group, boostLane);
    }

    this.scene.add(group);
    this.segments.push(group);
  }

  createTunnelSegment(parent, index, isEntrance = false, isExit = false) {
    parent.userData.isTunnel = true;
    this.tunnelSegments.push(parent);

    // 1. Reinforced Concrete Side Vault Walls
    const wallGeo = new THREE.BoxGeometry(0.9, 5.8, this.segmentLength);
    const leftWall = new THREE.Mesh(wallGeo, this.tunnelWallMat);
    leftWall.position.set(-10.2, 2.75, 0);
    leftWall.receiveShadow = true;
    parent.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, this.tunnelWallMat);
    rightWall.position.set(10.2, 2.75, 0);
    rightWall.receiveShadow = true;
    parent.add(rightWall);

    // 2. Concrete Ceiling Vault Slab & Angled Chamfers
    const roofGeo = new THREE.BoxGeometry(16.0, 0.45, this.segmentLength);
    const roof = new THREE.Mesh(roofGeo, this.tunnelRoofMat);
    roof.position.set(0, 5.65, 0);
    roof.receiveShadow = true;
    parent.add(roof);

    const chamferGeo = new THREE.BoxGeometry(4.2, 0.45, this.segmentLength);
    const leftChamfer = new THREE.Mesh(chamferGeo, this.tunnelRoofMat);
    leftChamfer.position.set(-8.8, 5.1, 0);
    leftChamfer.rotation.z = -0.38;
    leftChamfer.receiveShadow = true;
    parent.add(leftChamfer);

    const rightChamfer = new THREE.Mesh(chamferGeo, this.tunnelRoofMat);
    rightChamfer.position.set(8.8, 5.1, 0);
    rightChamfer.rotation.z = 0.38;
    rightChamfer.receiveShadow = true;
    parent.add(rightChamfer);

    // 3. Structural Heavy Rib Beams along Segment Center and Edges
    [-this.segmentLength / 2.2, 0, this.segmentLength / 2.2].forEach(z => {
      const ribArch = new THREE.Group();
      ribArch.position.z = z;

      const topRib = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.5, 0.9), this.tunnelPortalMat);
      topRib.position.y = 5.4;
      ribArch.add(topRib);

      [-9.8, 9.8].forEach(x => {
        const sideRib = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.4, 0.9), this.tunnelPortalMat);
        sideRib.position.set(x, 2.7, 0);
        ribArch.add(sideRib);
      });
      parent.add(ribArch);
    });

    // 4. Overhead Amber Sodium Luminaire Strip & Dynamic Point Light
    const luminaireGeo = new THREE.BoxGeometry(0.7, 0.18, 6.5);
    const luminaireMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
    const luminaire = new THREE.Mesh(luminaireGeo, luminaireMat);
    luminaire.position.set(0, 5.4, 0);
    parent.add(luminaire);

    const sodiumLight = new THREE.PointLight(0xff9900, 3.8, 24);
    sodiumLight.position.set(0, 5.0, 0);
    parent.add(sodiumLight);
    this.tunnelLights.push(sodiumLight);

    // 5. Monumental Portal Collar for Entrance & Exit
    if (isEntrance || isExit) {
      const portalZ = isEntrance ? -this.segmentLength / 2 : this.segmentLength / 2;
      const portalGroup = new THREE.Group();
      portalGroup.position.z = portalZ;

      const collarTop = new THREE.Mesh(new THREE.BoxGeometry(24.0, 1.8, 2.2), this.tunnelPortalMat);
      collarTop.position.y = 6.4;
      portalGroup.add(collarTop);

      [-11.2, 11.2].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.4, 2.2), this.tunnelPortalMat);
        pillar.position.set(x, 3.2, 0);
        portalGroup.add(pillar);
      });

      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(12.0, 0.8, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffb800 })
      );
      signMesh.position.set(0, 5.8, isEntrance ? -1.15 : 1.15);
      portalGroup.add(signMesh);

      parent.add(portalGroup);
    }
  }

  createJumpRamp(parent, lane) {
    const rampGroup = new THREE.Group();
    const w = 2.8;
    const l = 4.8;
    const hw = w / 2;
    const hl = l / 2;
    const h0 = 0.03; // Flush with asphalt at entrance (+Z)
    const h1 = 1.35; // Elevated takeoff lip at (-Z)

    // Mathematically exact forward-launching wedge geometry
    // Entrance at +Z (hl), Takeoff Lip at -Z (-hl)
    const positions = [
      // Top incline deck (2 triangles)
      -hw, h0, hl,   hw, h0, hl,   hw, h1, -hl,
      -hw, h0, hl,   hw, h1, -hl,  -hw, h1, -hl,
      // Back vertical drop face at takeoff lip (-hl)
      -hw, h1, -hl,  hw, h1, -hl,  hw, 0, -hl,
      -hw, h1, -hl,  hw, 0, -hl,   -hw, 0, -hl,
      // Left side triangular wall
      -hw, 0, hl,    -hw, h0, hl,  -hw, h1, -hl,
      -hw, 0, hl,    -hw, h1, -hl, -hw, 0, -hl,
      // Right side triangular wall
      hw, 0, hl,     hw, h1, -hl,  hw, h0, hl,
      hw, 0, hl,     hw, 0, -hl,   hw, h1, -hl,
      // Bottom face flush on asphalt
      -hw, 0, hl,    hw, 0, hl,    hw, 0, -hl,
      -hw, 0, hl,    hw, 0, -hl,   -hw, 0, -hl
    ];

    const rampGeo = new THREE.BufferGeometry();
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rampGeo.computeVertexNormals();

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0xff6a00,
      roughness: 0.4,
      metalness: 0.65
    });
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    // Glowing Runway Chevrons on incline pointing forward up to takeoff (-Z)
    const inclineAngle = Math.atan2(h1 - h0, l); // ~15.3 degrees
    const chevMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    [-1.2, 0.0, 1.2].forEach(relZ => {
      // Calculate height on incline for each chevron
      const t = (hl - relZ) / l;
      const yPos = h0 + t * (h1 - h0) + 0.025;
      const chev = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.4), chevMat);
      chev.position.set(0, yPos, relZ);
      chev.rotation.x = -inclineAngle;
      rampGroup.add(chev);
    });

    // Elevated Glowing Takeoff Lip across -Z edge
    const lipMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const lipMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, 0.16), lipMat);
    lipMesh.position.set(0, h1 + 0.04, -hl);
    rampGroup.add(lipMesh);

    // Left and Right Caution Guardrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.8, roughness: 0.3 });
    [-hw - 0.06, hw + 0.06].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, l), railMat);
      rail.position.set(x, (h1 + h0) / 2 + 0.18, 0);
      rail.rotation.x = -inclineAngle;
      rampGroup.add(rail);

      // Warning hazard stripe on rail
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, l), chevMat);
      stripe.position.set(x, (h1 + h0) / 2 + 0.25, 0);
      stripe.rotation.x = -inclineAngle;
      rampGroup.add(stripe);
    });

    rampGroup.position.set(lane, 0, 0);
    parent.add(rampGroup);

    this.jumpRamps.push({ parent, lane, mesh: rampGroup, triggered: false });
  }

  createSpeedPanel(parent, lane) {
    const panelGroup = new THREE.Group();

    // Dark Carbon Foundation Pad
    const padMat = new THREE.MeshStandardMaterial({ color: 0x07111a, roughness: 0.7, metalness: 0.4 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 4.4), padMat);
    pad.position.set(0, 0.01, 0);
    panelGroup.add(pad);

    // Glowing Electric Cyan Border Frame
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    [-1.25, 1.25].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 4.4), borderMat);
      rail.position.set(x, 0.025, 0);
      panelGroup.add(rail);
    });

    // 4 High-Speed Forward Chevrons pointing toward -Z
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    [-1.3, -0.4, 0.5, 1.4].forEach(z => {
      const chev = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 0.4), arrowMat);
      chev.position.set(0, 0.03, z);
      panelGroup.add(chev);
    });

    // Twin Energy Beacon Pylons with Pulsing Cyan Glow
    [-1.4, 1.4].forEach(x => {
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), pylonMat);
      pylon.position.set(x, 0.35, 0);
      panelGroup.add(pylon);

      const beaconOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), borderMat);
      beaconOrb.position.set(x, 0.72, 0);
      panelGroup.add(beaconOrb);
    });

    panelGroup.position.set(lane, 0, 0);
    parent.add(panelGroup);

    this.speedPanels.push({ parent, lane, mesh: panelGroup, triggered: false });
  }

  createStreetLight(parent, x, dir) {
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.4, 0);
    parent.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), poleMat);
    arm.position.set(x + dir * 0.5, 4.7, 0);
    parent.add(arm);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe099 }));
    lamp.position.set(x + dir * 1.0, 4.65, 0);
    parent.add(lamp);
  }

  createOverheadGantry(parent, index = 0) {
    const gantry = new THREE.Group();
    const frameMat = this.gantryTrussMat || new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });

    [-10, 10].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 8), frameMat);
      post.position.set(x, 3.25, 0);
      gantry.add(post);
    });

    const truss = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.4, 0.4), frameMat);
    truss.position.set(0, 6.2, 0);
    gantry.add(truss);

    // Dark housing backing
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 2.3, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x09101a, roughness: 0.8, metalness: 0.5 })
    );
    housing.position.set(0, 5.0, 0);
    gantry.add(housing);

    // Front high-res LED Matrix face facing approaching driver (+Z)
    const signMat = new THREE.MeshBasicMaterial({ map: this.gantryTexture });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 2.0), signMat);
    signMesh.position.set(0, 5.0, 0.14);
    gantry.add(signMesh);

    // Electronic Toll Collection (ETC) Optical Sensor Arrays
    [-4.5, 0, 4.5].forEach(sx => {
      const sensor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.3, 0.4),
        frameMat
      );
      sensor.position.set(sx, 4.0, 0.2);
      gantry.add(sensor);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      beacon.position.set(sx, 3.9, 0.42);
      gantry.add(beacon);
    });

    parent.add(gantry);
    this.gantries.push(gantry);
  }

  createCyberBillboard(parent, x, adIndex) {
    const group = new THREE.Group();
    const texture = this.billboardTextures[adIndex] || this.billboardTextures[0];
    const boardMat = new THREE.MeshBasicMaterial({ map: texture });
    const boardGeo = new THREE.BoxGeometry(8.5, 4.25, 0.3);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(x, 5.8, 0);
    board.rotation.y = x < 0 ? 0.2 : -0.2;
    group.add(board);

    // Glowing Semi-Transparent Holographic Aura Plane
    const auraGeo = new THREE.PlaneGeometry(9.2, 4.8);
    const auraMesh = new THREE.Mesh(auraGeo, this.hologramAuraMat);
    auraMesh.position.set(x, 5.8, x < 0 ? 0.16 : -0.16);
    auraMesh.rotation.y = x < 0 ? 0.2 : -0.2;
    group.add(auraMesh);

    // Holographic Emitter Projector Rails (Top & Bottom)
    [-2.2, 2.2].forEach(ey => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 8.8, 8),
        this.maglevRailMat
      );
      rail.rotation.z = Math.PI / 2;
      rail.position.set(x, 5.8 + ey, 0.1);
      rail.rotation.y = x < 0 ? 0.2 : -0.2;
      group.add(rail);
    });

    // Carbon-fiber Support Pylon
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4.0, 8), pylonMat);
    pylon.position.set(x, 2.0, 0);
    group.add(pylon);

    parent.add(group);
    this.holographicBillboards.push({
      group,
      boardMesh: board,
      auraMesh,
      boardMat,
      adIndex,
      glitchTimer: 0
    });
  }

  createMonorailGuideway(parent, index) {
    const guideway = new THREE.Group();

    // 1. Concrete Structural Beam
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.0, this.segmentLength),
      this.concreteBeamMat
    );
    beam.position.set(-12.5, 13.5, 0);
    beam.receiveShadow = true;
    guideway.add(beam);

    // 2. Dual Glowing Cyan Maglev Induction Rails
    [-0.76, 0.76].forEach(rx => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, this.segmentLength),
        this.maglevRailMat
      );
      rail.position.set(-12.5 + rx, 14.04, 0);
      guideway.add(rail);
    });

    // 3. Support Pylons (every 6 segments)
    if (index % 6 === 0) {
      this.createMonorailPylon(guideway, -12.5, 13.5);
    }

    parent.add(guideway);
  }

  createMonorailPylon(parent, x, y) {
    const pylon = new THREE.Group();

    // Heavy Cylindrical Concrete Pier Column
    const colGeo = new THREE.CylinderGeometry(0.75, 1.05, y, 8);
    const col = new THREE.Mesh(colGeo, this.concreteBeamMat);
    col.position.set(x, y / 2, 0);
    col.receiveShadow = true;
    col.castShadow = true;
    pylon.add(col);

    // Cantilevered T-Crosshead Beam
    const headGeo = new THREE.BoxGeometry(3.2, 1.1, 2.2);
    const head = new THREE.Mesh(headGeo, this.concreteBeamMat);
    head.position.set(x, y - 0.55, 0);
    head.receiveShadow = true;
    head.castShadow = true;
    pylon.add(head);

    // Yellow/Black Hazard Striping on Pylon Base
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.12, 0.4, 8), hazardMat);
    ring.position.set(x, 0.8, 0);
    pylon.add(ring);

    parent.add(pylon);
    this.monorailPylons.push(pylon);
  }

  initMonorailTrain() {
    this.monorailTrain = new THREE.Group();
    const trainMat = new THREE.MeshStandardMaterial({ color: 0x182436, roughness: 0.25, metalness: 0.8 });
    const darkAccMat = new THREE.MeshStandardMaterial({ color: 0x090f18, roughness: 0.6, metalness: 0.3 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    // 1. Lead Locomotive Car
    const leadCar = new THREE.Group();
    const leadBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 9.0), trainMat);
    leadBody.position.set(0, 1.0, 0);
    leadCar.add(leadBody);

    // Aerodynamic Nose Wedge
    const noseGeo = new THREE.ConeGeometry(1.6, 3.2, 4);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.rotateY(Math.PI / 4);
    const nose = new THREE.Mesh(noseGeo, trainMat);
    nose.position.set(0, 0.9, -5.4);
    nose.scale.set(1.1, 0.85, 1.0);
    leadCar.add(nose);

    // Tinted Cockpit Canopy Glass
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 2.8), windowMat);
    canopy.position.set(0, 1.7, -3.2);
    leadCar.add(canopy);

    // Dual Forward Xenon Projector Headlights
    [-0.8, 0.8].forEach(hx => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), headlightMat);
      lamp.position.set(hx, 0.7, -6.6);
      leadCar.add(lamp);
    });
    this.monorailTrain.add(leadCar);

    // 2. Articulated Center Passenger Coach
    const midCar = new THREE.Group();
    midCar.position.set(0, 0, 10.5);
    const midBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 10.0), trainMat);
    midBody.position.set(0, 1.0, 0);
    midCar.add(midBody);

    // Connecting Accordion Bellows
    const bellows = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 1.5), darkAccMat);
    bellows.position.set(0, 1.0, -5.5);
    midCar.add(bellows);

    // Panoramic Illuminated Cabin Windows (Left & Right)
    [-1.26, 1.26].forEach(wx => {
      for (let wz = -3.6; wz <= 3.6; wz += 1.8) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.2), windowMat);
        win.position.set(wx, 1.25, wz);
        midCar.add(win);
      }
    });
    this.monorailTrain.add(midCar);

    // 3. Rear Trailer Car
    const rearCar = new THREE.Group();
    rearCar.position.set(0, 0, 21.0);
    const rearBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 9.0), trainMat);
    rearBody.position.set(0, 1.0, 0);
    rearCar.add(rearBody);

    const rearBellows = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 1.5), darkAccMat);
    rearBellows.position.set(0, 1.0, -5.0);
    rearCar.add(rearBellows);

    // Trailing Glowing Red LED Marker Lights
    [-0.9, 0.9].forEach(tx => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), taillightMat);
      tail.position.set(tx, 1.0, 4.54);
      rearCar.add(tail);
    });

    // Flashing Aviation Warning Beacon on Roof
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.25, 8), beaconMat);
    beacon.position.set(0, 2.15, 0);
    rearCar.add(beacon);

    this.monorailTrain.add(rearCar);

    // 4. Wrap-Around Maglev Bogie Guidance Skids
    [0, 10.5, 21.0].forEach(cz => {
      [-1.4, 1.4].forEach(bx => {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 4.0), darkAccMat);
        skid.position.set(bx, 0.2, cz);
        this.monorailTrain.add(skid);
      });
    });

    // Set initial position: elevated along highway verge
    this.monorailTrain.position.set(-12.5, 14.05, -220);
    this.scene.add(this.monorailTrain);
  }

  updateMonorail(dt, speed, playerZ) {
    if (!this.monorailTrain) return;

    // Train cruises along Z relative to highway motion
    this.monorailTrain.position.z += (this.monorailSpeed - speed) * dt;

    // Subtle magnetic levitation floating bob
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.003;
    this.monorailTrain.position.y = 14.05 + Math.sin(now) * 0.06;

    // When train passes far behind camera, loop back to distance horizon
    if (this.monorailTrain.position.z > 80) {
      this.monorailTrain.position.z = -380;
    } else if (this.monorailTrain.position.z < -420) {
      this.monorailTrain.position.z = 60;
    }
  }

  createSoundBarriers(parent, index) {
    const barrierGroup = new THREE.Group();
    const isLeft = (index % 2 === 0);
    const xPos = isLeft ? -10.8 : 10.8;

    // 4 Vertical Galvanized Steel Posts per 15m segment
    [-5.6, -1.85, 1.85, 5.6].forEach(pz => {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 3.2, 0.14),
        this.soundBarrierPostMat
      );
      post.position.set(xPos, 1.6, pz);
      post.receiveShadow = true;
      barrierGroup.add(post);
    });

    // 3 Transparent Tinted Acoustic Polymer Noise Panels
    [-3.75, 0, 3.75].forEach(pz => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 2.6, 3.65),
        this.soundBarrierPanelMat
      );
      panel.position.set(xPos, 1.7, pz);
      panel.receiveShadow = true;
      barrierGroup.add(panel);

      // Acoustic Horizontal Baffle Ribs
      [-0.6, 0, 0.6].forEach(ry => {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.04, 3.65),
          this.soundBarrierPostMat
        );
        rib.position.set(xPos, 1.7 + ry, pz);
        barrierGroup.add(rib);
      });
    });

    // Concrete Deflector Crash Guard Baseboard
    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, this.segmentLength),
      this.curbMat
    );
    baseboard.position.set(xPos, 0.22, 0);
    barrierGroup.add(baseboard);

    parent.add(barrierGroup);
    this.soundBarriers.push(barrierGroup);
  }

  updateHolograms(dt, now) {
    this.hologramScanlinePhase += dt * 3.5;

    // Periodic glitch triggers
    this.hologramGlitchTimer -= dt;
    if (this.hologramGlitchTimer <= -2.5) {
      this.hologramGlitchTimer = 0.18; // active glitch duration
    }

    const isGlitching = (this.hologramGlitchTimer > 0);
    const pulseAlpha = 0.25 + Math.sin(now * 3.8) * 0.12;

    for (let i = 0; i < this.holographicBillboards.length; i++) {
      const b = this.holographicBillboards[i];
      if (b.auraMesh && b.auraMesh.material) {
        b.auraMesh.material.opacity = isGlitching ? 0.65 : pulseAlpha;
      }
      if (isGlitching && b.boardMesh) {
        b.boardMesh.position.x = (b.group.position.x || 0) + (Math.random() - 0.5) * 0.08;
      }
    }
  }

  createRoadsideBuildings(parent, index) {
    const palette = [0x0e1726, 0x141f33, 0x1a243b, 0x0a121f];
    [-24, 24].forEach((x, side) => {
      // 1. Detailed Kenney 3D Buildings & Trees if available
      const bKey = (index % 2 === 0) ? 'building-a' : 'building-b';
      const treeKey = (index % 2 === 0) ? 'tree-large' : 'tree-small';

      if (this.assetPrototypes && this.assetPrototypes[bKey]) {
        const b = this.assetPrototypes[bKey].clone(true);
        b.scale.setScalar(4.5);
        b.position.set(x + (side === 0 ? 3 : -3), 0, 0);
        b.rotation.y = (side === 0 ? Math.PI / 2 : -Math.PI / 2);
        b.traverse(n => {
          if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
            if (n.material && n.material.map) {
              n.material.map.flipY = false;
              n.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        });
        parent.add(b);

        // Add Highway Verge Tree
        if (this.assetPrototypes[treeKey] && index % 2 === 1) {
          const tree = this.assetPrototypes[treeKey].clone(true);
          tree.scale.setScalar(2.8);
          tree.position.set(x + (side === 0 ? 8 : -8), 0, (side === 0 ? -4 : 4));
          parent.add(tree);
        }
      } else {
        const height = 14 + ((index * 7 + side * 5) % 24);
        const width = 8 + (index % 4) * 2;
        const bGeo = new THREE.BoxGeometry(width, height, 11);
        const bMat = this.buildingMaterials[(index + side) % 2];
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(x, height / 2 - 0.2, 0);
        parent.add(building);
      }
    });
  }

  createCanyonCliffs(parent, index) {
    [-31.0, 31.0].forEach((x, side) => {
      // 1. Towering monolithic sandstone cliff pillar
      const h1 = 28.0 + ((index * 7 + side * 5) % 18);
      const w1 = 16.0 + ((index * 3) % 8);
      const cliff1 = new THREE.Mesh(
        new THREE.BoxGeometry(w1, h1, 15),
        this.canyonRockMat
      );
      cliff1.position.set(x, h1 / 2 - 2, 0);
      cliff1.rotation.y = (side === 0 ? 1 : -1) * (((index * 13) % 20) * 0.04);
      cliff1.castShadow = true;
      cliff1.receiveShadow = true;
      parent.add(cliff1);
      this.canyonCliffs.push(cliff1);

      // 2. Flanking jagged stepped rock butte
      const h2 = 18.0 + ((index * 11 + side * 7) % 14);
      const cliff2 = new THREE.Mesh(
        new THREE.BoxGeometry(11, h2, 11),
        this.canyonRockMat
      );
      cliff2.position.set(x + (side === 0 ? 8.5 : -8.5), h2 / 2 - 2, (index % 2 === 0 ? 3.5 : -3.5));
      cliff2.castShadow = true;
      cliff2.receiveShadow = true;
      parent.add(cliff2);
      this.canyonCliffs.push(cliff2);
    });
  }

  createCanyonArchway(parent, index) {
    const archGroup = new THREE.Group();
    archGroup.name = `CanyonArch_${index}`;

    // Left and Right Sandstone Buttress Pillars
    const leftPillar = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 22.0, 9.5),
      this.canyonRockMat
    );
    leftPillar.position.set(-18.5, 10.0, 0);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    archGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 22.0, 9.5),
      this.canyonRockMat
    );
    rightPillar.position.set(18.5, 10.0, 0);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    archGroup.add(rightPillar);

    // Spanning Natural Rock Arch Bridge
    const archBridge = new THREE.Mesh(
      new THREE.BoxGeometry(32.0, 5.8, 8.5),
      this.canyonArchMat
    );
    archBridge.position.set(0, 18.5, 0);
    archBridge.castShadow = true;
    archBridge.receiveShadow = true;
    archGroup.add(archBridge);

    // Eroded Crest Crown Rock Formation
    const crownRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(4.2),
      this.canyonRockMat
    );
    crownRock.position.set(0, 22.2, 0);
    crownRock.scale.set(3.2, 1.2, 1.5);
    crownRock.castShadow = true;
    crownRock.receiveShadow = true;
    archGroup.add(crownRock);

    parent.add(archGroup);
    this.canyonArchways.push(archGroup);
  }

  createBlackIcePatches(parent, index) {
    const laneX = [-5.5, 0.0, 5.5][(index * 3) % 3];
    const iceMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.015, 12.0),
      this.blackIceMat
    );
    iceMesh.position.set(laneX, 0.008, -this.segmentLength / 2);
    iceMesh.receiveShadow = true;
    parent.add(iceMesh);
    this.blackIcePatches.push({
      mesh: iceMesh,
      segment: parent,
      localX: laneX,
      localZ: -this.segmentLength / 2,
      width: 3.6,
      length: 12.0
    });
  }

  createRoadReflectors(parent, index) {
    // 2 Z rows along segment, 4 lateral positions across lane markers and verge
    const zOffsets = [-3.75, -11.25];
    const xPositions = [-8.8, -3.0, 3.0, 8.8];

    for (let rz of zOffsets) {
      for (let rx of xPositions) {
        const marker = new THREE.Group();
        marker.position.set(rx, 0.015, rz);

        // Cast casing stud
        const casing = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.035, 0.12),
          this.catEyeStudMat
        );
        casing.receiveShadow = true;
        marker.add(casing);

        // Retro-reflective faceted glass bead lens
        const lensMat = this.catEyeLensMat.clone();
        const lens = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.02, 0.03),
          lensMat
        );
        lens.position.set(0, 0.016, -0.04);
        marker.add(lens);

        parent.add(marker);
        this.roadReflectors.push({
          mesh: marker,
          lensMesh: lens,
          parent,
          localX: rx,
          localZ: rz
        });
      }
    }
  }

  initDynamicDustDevils() {
    this.dustDevils = [];
    for (let d = 0; d < 3; d++) {
      const group = new THREE.Group();
      group.name = `DustDevil_${d}`;

      // 5 vertical rotating spiral tiers
      for (let t = 0; t < 5; t++) {
        const radius = 1.6 + t * 0.85;
        const y = 0.5 + t * 2.6;
        const ringGeo = new THREE.TorusGeometry(radius, 0.22 + t * 0.08, 6, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, this.dustDevilMat);
        ring.position.y = y;
        ring.rotation.z = (t * Math.PI) / 3;
        group.add(ring);
      }

      // Conical vortex core
      const coreGeo = new THREE.ConeGeometry(3.8, 13.5, 8, 1, true);
      coreGeo.rotateX(Math.PI);
      const core = new THREE.Mesh(coreGeo, this.dustDevilMat);
      core.position.y = 6.75;
      group.add(core);

      const initX = [-12.0, 5.0, -4.0][d];
      const initZ = -60 - d * 75;
      group.position.set(initX, 0, initZ);
      group.userData = {
        driftVx: (d % 2 === 0 ? 1.4 : -1.4),
        swirlSpeed: 6.8 + d * 1.2,
        wobblePhase: d * 2.1
      };
      group.visible = (this.currentTheme === 'canyon');
      this.scene.add(group);
      this.dustDevils.push(group);
    }
  }

  initBlowingTumbleweeds() {
    this.tumbleweeds = [];
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.IcosahedronGeometry(0.65, 1);
      const mesh = new THREE.Mesh(geo, this.tumbleweedMat);
      mesh.name = `Tumbleweed_${i}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const initX = -18.0 + (i * 7) % 36;
      const initZ = -40 - i * 45;
      mesh.position.set(initX, 0.65, initZ);
      mesh.userData = {
        vx: 3.8 + (i % 3) * 0.9,
        vy: 1.5 + (i % 2) * 2.0,
        vz: -2.0 - (i % 2) * 1.5,
        radius: 0.65
      };
      mesh.visible = (this.currentTheme === 'canyon');
      this.scene.add(mesh);
      this.tumbleweeds.push(mesh);
    }
  }

  updateBiomeProps(dt, speed, playerX, playerZ, currentDistance, callbacks) {
    const isCanyon = (this.currentTheme === 'canyon');
    const isArctic = (this.currentTheme === 'arctic');

    // 1. Dust Devils Physics & Vortex Animation (Canyon)
    if (this.dustDevils && this.dustDevils.length > 0) {
      for (const dd of this.dustDevils) {
        if (!isCanyon) {
          dd.visible = false;
          continue;
        }
        dd.visible = true;
        dd.userData.wobblePhase += dt * 2.5;
        dd.rotation.y += dt * dd.userData.swirlSpeed;
        dd.rotation.z = Math.sin(dd.userData.wobblePhase) * 0.08;

        // Relative road scrolling & crosswind drift
        dd.position.z += speed * dt;
        dd.position.x += dd.userData.driftVx * dt;
        if (dd.position.x > 15.0) dd.userData.driftVx = -Math.abs(dd.userData.driftVx);
        if (dd.position.x < -15.0) dd.userData.driftVx = Math.abs(dd.userData.driftVx);

        // Recycle when passing behind player
        if (dd.position.z > 30.0) {
          dd.position.z = -260.0 - Math.random() * 60.0;
          dd.position.x = (Math.random() - 0.5) * 24.0;
        }
      }
    }

    // 2. Blowing Tumbleweeds Rolling Physics (Canyon)
    if (this.tumbleweeds && this.tumbleweeds.length > 0) {
      for (const tw of this.tumbleweeds) {
        if (!isCanyon) {
          tw.visible = false;
          continue;
        }
        tw.visible = true;
        // Crosswind movement
        tw.position.x += tw.userData.vx * dt;
        // Relative forward scrolling
        tw.position.z += (speed + tw.userData.vz) * dt;
        // Gravity & bouncing
        tw.userData.vy -= 18.0 * dt;
        tw.position.y += tw.userData.vy * dt;
        if (tw.position.y <= tw.userData.radius) {
          tw.position.y = tw.userData.radius;
          tw.userData.vy = Math.abs(tw.userData.vy) * 0.68 + (Math.random() - 0.5) * 0.8;
          if (tw.userData.vy < 0.6) tw.userData.vy = 2.4; // keep bouncing lively
        }

        // True physical rolling: omega_z = -vx / r
        tw.rotation.z -= (tw.userData.vx / tw.userData.radius) * dt;
        tw.rotation.x += dt * 3.2;

        // Recycle when crossing off highway or behind player
        if (tw.position.x > 22.0 || tw.position.z > 35.0) {
          tw.position.x = -18.0 - Math.random() * 6.0;
          tw.position.z = (playerZ || -8.0) - 70.0 - Math.random() * 110.0;
          tw.position.y = 0.65;
          tw.userData.vy = 2.5;
        }
      }
    }

    // 3. Arctic Black Ice Friction & Traction Slip Detection
    this.lastPlayerOnBlackIce = false;
    this.lastSurfaceFriction = 1.0;
    if (isArctic && this.blackIcePatches && this.blackIcePatches.length > 0) {
      for (const patch of this.blackIcePatches) {
        const patchWorldZ = patch.segment.position.z + patch.localZ;
        const dx = Math.abs(playerX - patch.localX);
        const dz = Math.abs(playerZ - patchWorldZ);
        if (dx < (patch.width / 2 + 0.3) && dz < (patch.length / 2)) {
          this.lastPlayerOnBlackIce = true;
          this.lastSurfaceFriction = 0.45;
          if (callbacks && callbacks.player) {
            callbacks.player.onBlackIce = true;
            callbacks.player.surfaceFriction = 0.45;
          }
          break;
        }
      }
      if (!this.lastPlayerOnBlackIce && callbacks && callbacks.player) {
        callbacks.player.onBlackIce = false;
      }
    } else if (callbacks && callbacks.player && !isArctic) {
      callbacks.player.onBlackIce = false;
    }

    // 4. Retro-Reflective Highway Cat's Eyes
    let activeGlints = 0;
    if (this.roadReflectors && this.roadReflectors.length > 0) {
      const isLowLight = (this.currentLightingPhase === 'night' || this.currentLightingPhase === 'sunset' || this.isInsideTunnel || this.currentTheme === 'neotokyo');
      for (const ref of this.roadReflectors) {
        const worldZ = ref.parent.position.z + ref.localZ;
        const relZ = worldZ - playerZ;
        // Within forward headlights cone (0 to -65m)
        if (relZ < 0 && relZ > -65.0) {
          const distNorm = 1.0 - (-relZ / 65.0);
          const glint = Math.pow(distNorm, 1.8) * (isLowLight ? 2.6 : 1.3);
          ref.lensMesh.material.emissiveIntensity = glint;
          activeGlints++;
        } else {
          ref.lensMesh.material.emissiveIntensity = 0.15;
        }
      }
    }
    this.activeCatEyesCount = activeGlints;
  }

  reset() {
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].position.z = -i * this.segmentLength;
    }
    this.jumpRamps.forEach(r => { r.triggered = false; });
    this.speedPanels.forEach(p => { p.triggered = false; });
    if (this.challengeMarker && this.challengeDistance) {
      this.challengeMarker.position.set(0, 0, -this.challengeDistance);
      this.challengePassed = false;
    }
  }

  setChallengeTarget(distance, challengerName = 'Rival') {
    this.challengeDistance = distance;
    this.challengePassed = false;

    const beaconGroup = new THREE.Group();
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 80, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffb800,
      transparent: true,
      opacity: 0.75
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 40;
    beaconGroup.add(beam);

    [5, 12, 22].forEach(h => {
      const ringGeo = new THREE.TorusGeometry(1.6, 0.15, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = h;
      ring.rotation.x = Math.PI / 2;
      beaconGroup.add(ring);
    });

    beaconGroup.position.set(0, 0, -distance);
    this.scene.add(beaconGroup);
    this.challengeMarker = beaconGroup;
  }

  update(dt, speed, currentDistance, callbacks = {}) {
    const trackTotalLength = this.segmentCount * this.segmentLength;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.position.z += speed * dt;
      if (seg.position.z > this.segmentLength) {
        seg.position.z -= trackTotalLength;
        // Reset interactive triggers for recycled segment
        this.jumpRamps.forEach(r => { if (r.parent === seg) r.triggered = false; });
        this.speedPanels.forEach(p => { if (p.parent === seg) p.triggered = false; });
      }
    }

    // Challenger Beacon
    if (this.challengeMarker) {
      this.challengeMarker.position.z += speed * dt;
      this.challengeMarker.rotation.y += dt * 1.5;

      if (!this.challengePassed && this.challengeMarker.position.z > -8) {
        this.challengePassed = true;
        if (callbacks.onChallengeDefeated) callbacks.onChallengeDefeated();
      }
    }

    if (this.skyMesh) {
      this.skyMesh.rotation.y += dt * 0.01;
    }
    if (this.stars) {
      this.stars.rotation.y += dt * 0.005;
    }

    // Extract dynamic telemetry inputs from callbacks
    const kmh = callbacks.speedKmh !== undefined ? callbacks.speedKmh : (speed * 9);
    const playerX = callbacks.playerX !== undefined ? callbacks.playerX : 0;
    const playerZ = callbacks.playerZ !== undefined ? callbacks.playerZ : -8;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.0018;

    // 0. Subterranean Highway Tunnel Detection & Ambient Occlusion
    let inTunnelNow = false;
    for (let i = 0; i < this.tunnelSegments.length; i++) {
      const seg = this.tunnelSegments[i];
      if (Math.abs(seg.position.z - playerZ) < this.segmentLength * 0.55) {
        inTunnelNow = true;
        break;
      }
    }
    this.isInsideTunnel = inTunnelNow;
    const targetTransition = this.isInsideTunnel ? 1.0 : 0.0;
    this.tunnelTransition += (targetTransition - this.tunnelTransition) * Math.min(1, dt * 8.0);

    // 0.1 Progressive Day-to-Sunset-to-Night Lighting Cycle
    this.updateLightingCycle(currentDistance, dt);

    // 0.2 Day 11: Wet Asphalt Surface Friction & Specular Reflection Dynamics
    const wantsWet = (this.weatherType === 'rain' || this.currentTheme === 'neotokyo');
    this.targetWetness = wantsWet ? 1.0 : 0.0;
    this.roadWetness += (this.targetWetness - this.roadWetness) * Math.min(1.0, dt * 2.5);
    if (this.roadMaterial) {
      this.roadMaterial.roughness = THREE.MathUtils.lerp(this.baseRoadRoughness, this.wetRoadRoughness, this.roadWetness);
      this.roadMaterial.metalness = THREE.MathUtils.lerp(this.baseRoadMetalness, this.wetRoadMetalness, this.roadWetness);
    }

    // 0.3 Day 11: Holographic Billboard Scanning & Chromatic Glitch Cycles
    this.updateHolograms(dt, now);

    // 0.4 Day 11: Elevated Monorail Train Overhead Cruising & Wrap Cycles
    this.updateMonorail(dt, speed, playerZ);

    // 0.5 Day 12: Canyon & Arctic Biome Props (Dust Devils, Tumbleweeds, Black Ice & Cat's Eyes)
    this.updateBiomeProps(dt, speed, playerX, playerZ, currentDistance, callbacks);

    // 1. Dynamic Weather Particle Physics & Recycling (High-Speed Rain Streaks with Slant)
    if (this.weatherType === 'rain' && this.rainMesh && this.rainPositions) {
      const pos = this.rainPositions;
      const vel = this.rainVelocities;
      const lens = this.rainLengths;
      const stretch = 1.0 + Math.min(1.4, kmh / 140.0);

      for (let i = 0; i < this.rainDropCount; i++) {
        const i6 = i * 6;
        const i3 = i * 3;

        // Head position update
        pos[i6] += vel[i3] * dt;
        pos[i6 + 1] += vel[i3 + 1] * dt;
        pos[i6 + 2] += (vel[i3 + 2] + speed) * dt;

        // Tail position matches head + streak offset slanted by forward speed
        pos[i6 + 3] = pos[i6] - vel[i3] * 0.022;
        pos[i6 + 4] = pos[i6 + 1] + lens[i] * stretch;
        pos[i6 + 5] = pos[i6 + 2] - (vel[i3 + 2] + speed) * 0.028 * stretch;

        // Recycle raindrops hitting asphalt or passing behind camera
        if (pos[i6 + 1] < 0 || pos[i6 + 2] > 20) {
          const rx = (Math.random() - 0.5) * 60;
          const ry = Math.random() * 24 + 14;
          const rz = -Math.random() * 90 - 10;
          pos[i6] = rx;
          pos[i6 + 1] = ry;
          pos[i6 + 2] = rz;
          pos[i6 + 3] = rx - vel[i3] * 0.022;
          pos[i6 + 4] = ry + lens[i] * stretch;
          pos[i6 + 5] = rz - (vel[i3 + 2] + speed) * 0.028 * stretch;
        }
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
    } else if (this.weatherType === 'snow' && this.weatherParticles && this.weatherPositions) {
      // 2. Arctic Blizzard Swirling Particle Dynamics with Turbulent Crosswind
      const pos = this.weatherPositions;
      const vel = this.weatherVelocities;
      const blizzardCrosswind = -14.0 + Math.sin(now * 2.8) * 4.5;

      for (let i = 0; i < this.weatherParticleCount; i++) {
        const idx = i * 3;
        pos[idx] += (vel[idx] + blizzardCrosswind * 0.45) * dt;
        pos[idx + 1] += vel[idx + 1] * dt;
        pos[idx + 2] += (vel[idx + 2] + speed) * dt;

        // Recycle snow particles with diagonal crosswind drift
        if (pos[idx + 1] < 0 || pos[idx + 2] > 18 || pos[idx] < -35) {
          pos[idx] = (Math.random() - 0.5) * 55 + 10;
          pos[idx + 1] = Math.random() * 22 + 8;
          pos[idx + 2] = -Math.random() * 90 - 10;
        }
      }
      this.weatherParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Asphalt Water Spray Plumes Trailing Rear Tires (> 140 km/h)
    if (this.tireSpray) {
      this.tireSpray.update(dt, playerX, playerZ, kmh, this.weatherType === 'rain');
    }

    // 4. Screen-Space Raindrop Refraction & Windshield Frost System
    if (this.screenDroplets) {
      this.screenDroplets.update(dt, this.weatherType, kmh);
    }

    // Dynamic Pedestrian Animation (Smooth Crowd Cheering, Arm Waves & Head Motion)
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.userData && p.userData.isCheering) {
        const t = now + p.userData.phase;
        if (p.userData.leftArmGroup) p.userData.leftArmGroup.rotation.x = -0.4 + Math.sin(t * 2.2) * 0.35;
        if (p.userData.rightArmGroup) p.userData.rightArmGroup.rotation.x = -0.4 + Math.cos(t * 2.2) * 0.35;
        p.position.y = p.userData.baseY + Math.abs(Math.sin(t * 2.0)) * 0.04;
      }
    }
  }

  createPedestrian(colorHex, isCheering = false) {
    const group = new THREE.Group();

    // Humanoid materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdcb285, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x181e28, roughness: 0.6 });
    const hoodieMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45, metalness: 0.25 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x141b27, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.3 });
    const shadesMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Shoes & Legs
    [-0.10, 0.10].forEach(lx => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.20), shoeMat);
      shoe.position.set(lx, 0.04, 0.02);
      group.add(shoe);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.60, 8), pantsMat);
      leg.position.set(lx, 0.36, 0);
      group.add(leg);
    });

    // Torso with streetwear hoodie / jacket
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.22), hoodieMat);
    torso.position.set(0, 0.88, 0);
    group.add(torso);

    // Head, Hair & Holographic Cyber Shades
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), skinMat);
    head.position.set(0, 1.24, 0);
    group.add(head);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.22), hairMat);
    hair.position.set(0, 1.32, -0.01);
    group.add(hair);

    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.06), shadesMat);
    shades.position.set(0, 1.25, -0.11);
    group.add(shades);

    // Dual Arms with articulate shoulder pivots
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.24, 1.06, 0);
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.045, 0.38, 6), hoodieMat);
    leftArm.position.y = -0.16;
    leftArmGroup.add(leftArm);
    group.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.24, 1.06, 0);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.045, 0.38, 6), hoodieMat);
    rightArm.position.y = -0.16;
    rightArmGroup.add(rightArm);
    group.add(rightArmGroup);

    if (isCheering) {
      leftArmGroup.rotation.z = Math.PI * 0.75;
      rightArmGroup.rotation.z = -Math.PI * 0.75;
      leftArmGroup.rotation.x = -0.25;
      rightArmGroup.rotation.x = -0.25;
    }

    group.userData = {
      isCheering,
      leftArmGroup,
      rightArmGroup,
      baseY: 0,
      phase: Math.random() * Math.PI * 2
    };

    return group;
  }

  createSidewalkPedestrians(parent, index) {
    const palette = [0x00d9ff, 0xff2a85, 0xffb800, 0x00ff88, 0xff6600, 0x9d4edd, 0xffffff];
    [-1, 1].forEach(side => {
      const count = 1 + (index % 3);
      for (let i = 0; i < count; i++) {
        const color = palette[(index * 3 + i + (side > 0 ? 2 : 0)) % palette.length];
        const isCheering = (index + i) % 2 === 0;
        const p = this.createPedestrian(color, isCheering);

        const xPos = side * (this.roadWidth / 2 + 1.8 + Math.random() * 2.2);
        const zPos = (Math.random() - 0.5) * (this.segmentLength * 0.7);
        p.position.set(xPos, 0.05, zPos);
        p.rotation.y = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * 0.6;
        p.userData.baseY = 0.05;

        parent.add(p);
        this.pedestrians.push(p);
      }
    });
  }

  createPedestrianSkywalk(parent, index) {
    const skywalkGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x141b27, roughness: 0.4, metalness: 0.8 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1c2433, roughness: 0.6, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      metalness: 0.9,
      roughness: 0.08,
      transparent: true,
      opacity: 0.45
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const bridgeHeight = 6.4;
    const spanWidth = this.roadWidth + 8; // ~28m span

    // 1. Dual Heavy Vertical Support Columns
    [-spanWidth / 2 + 1.2, spanWidth / 2 - 1.2].forEach(x => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, bridgeHeight, 1.4), frameMat);
      col.position.set(x, bridgeHeight / 2, 0);
      col.castShadow = true;
      skywalkGroup.add(col);

      // Neon column accent strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, bridgeHeight * 0.9, 0.12), neonMat);
      strip.position.set(x + (x < 0 ? 0.62 : -0.62), bridgeHeight / 2, 0);
      skywalkGroup.add(strip);
    });

    // 2. Walkway Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(spanWidth, 0.45, 4.2), deckMat);
    deck.position.set(0, bridgeHeight, 0);
    deck.receiveShadow = true;
    skywalkGroup.add(deck);

    // 3. Transparent Safety Glass Railings (Front & Back)
    [-2.0, 2.0].forEach(z => {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(spanWidth - 1, 1.2, 0.08), glassMat);
      glass.position.set(0, bridgeHeight + 0.7, z);
      skywalkGroup.add(glass);

      // Handrail bar
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(spanWidth, 0.08, 0.14), frameMat);
      handrail.position.set(0, bridgeHeight + 1.32, z);
      skywalkGroup.add(handrail);
    });

    // 4. Overhead Canopy Arch
    const roof = new THREE.Mesh(new THREE.BoxGeometry(spanWidth + 0.6, 0.25, 4.8), frameMat);
    roof.position.set(0, bridgeHeight + 2.8, 0);
    skywalkGroup.add(roof);

    // Glowing Neon Under-Deck Lightstrip
    const underLight = new THREE.Mesh(new THREE.BoxGeometry(spanWidth * 0.85, 0.06, 0.2), neonMat);
    underLight.position.set(0, bridgeHeight - 0.26, 0);
    skywalkGroup.add(underLight);

    // 5. Spectators Cheering on Bridge Deck Looking Down at Highway
    const palette = [0x00d9ff, 0xff2a85, 0xffb800, 0x00ff88, 0xff3b00, 0xffffff];
    const bridgeSpectators = [-6.5, -2.5, 0.8, 4.2, 7.0];
    bridgeSpectators.forEach((x, i) => {
      const p = this.createPedestrian(palette[i % palette.length], true);
      p.position.set(x, bridgeHeight + 0.22, 1.4);
      p.rotation.y = Math.PI; // Looking toward approaching cars (+Z)
      p.userData.baseY = bridgeHeight + 0.22;
      skywalkGroup.add(p);
      this.pedestrians.push(p);
    });

    parent.add(skywalkGroup);
  }

  getWeatherTelemetry() {
    return {
      weatherType: this.weatherType,
      currentTheme: this.currentTheme,
      rainDropCount: this.weatherType === 'rain' ? this.rainDropCount : 0,
      snowParticleCount: this.weatherType === 'snow' ? this.weatherParticleCount : 0,
      sprayActive: Boolean(this.tireSpray && this.tireSpray.sprayIntensity > 0.01),
      sprayIntensity: parseFloat((this.tireSpray ? this.tireSpray.sprayIntensity : 0).toFixed(3)),
      sprayInstances: this.tireSpray ? this.tireSpray.maxInstances : 0,
      screenDropletsCount: this.screenDroplets ? this.screenDroplets.dropletCount : 0,
      windshieldFrostAlpha: parseFloat((this.screenDroplets ? this.screenDroplets.frostAlpha : 0).toFixed(3)),
      hasZeroAllocationPool: true
    };
  }

  updateLightingCycle(distance = 0, dt = 0.016) {
    if (!this.dirLight || !this.hemiLight) return;

    // Continuous distance-driven diurnal cycle (3600m full loop)
    const cycleDist = this.lightingCycleDistance || 3600;
    this.cycleProgress = ((distance % cycleDist) + cycleDist) % cycleDist / cycleDist;
    const p = this.cycleProgress;

    let phaseName = 'day';
    let blendT = 0;
    let fromState = LIGHTING_PRESETS.day;
    let toState = LIGHTING_PRESETS.day;

    if (p < 0.35) {
      phaseName = 'day';
      fromState = LIGHTING_PRESETS.day;
      toState = (p > 0.22) ? LIGHTING_PRESETS.sunset : LIGHTING_PRESETS.day;
      blendT = (p > 0.22) ? (p - 0.22) / 0.13 : 0;
    } else if (p < 0.60) {
      phaseName = 'sunset';
      fromState = LIGHTING_PRESETS.sunset;
      toState = (p > 0.48) ? LIGHTING_PRESETS.night : LIGHTING_PRESETS.sunset;
      blendT = (p > 0.48) ? (p - 0.48) / 0.12 : 0;
    } else if (p < 0.88) {
      phaseName = 'night';
      fromState = LIGHTING_PRESETS.night;
      toState = (p > 0.78) ? LIGHTING_PRESETS.dawn : LIGHTING_PRESETS.night;
      blendT = (p > 0.78) ? (p - 0.78) / 0.10 : 0;
    } else {
      phaseName = 'dawn';
      fromState = LIGHTING_PRESETS.dawn;
      toState = LIGHTING_PRESETS.day;
      blendT = (p - 0.88) / 0.12;
    }

    this.currentLightingPhase = phaseName;
    this.timeOfDay = phaseName;
    this.headlightsRequired = (phaseName === 'sunset' || phaseName === 'night' || this.isInsideTunnel);

    // Smooth cosine non-linear blending
    const smoothT = (1.0 - Math.cos(blendT * Math.PI)) * 0.5;

    // Directional Sunlight / Moonlight
    this._targetSunColor.copy(fromState.sunColor).lerp(toState.sunColor, smoothT);
    this.dirLight.color.copy(this._targetSunColor);
    this.dirLight.position.lerpVectors(fromState.sunPos, toState.sunPos, smoothT);

    let targetSunIntensity = THREE.MathUtils.lerp(fromState.sunIntensity, toState.sunIntensity, smoothT);
    let targetHemiIntensity = THREE.MathUtils.lerp(fromState.hemiIntensity, toState.hemiIntensity, smoothT);
    let targetMoonIntensity = THREE.MathUtils.lerp(fromState.moonIntensity, toState.moonIntensity, smoothT);

    // Subterranean tunnel occlusion dims direct sunlight & skylight
    if (this.tunnelTransition > 0.01) {
      targetSunIntensity = THREE.MathUtils.lerp(targetSunIntensity, 0.25, this.tunnelTransition);
      targetHemiIntensity = THREE.MathUtils.lerp(targetHemiIntensity, 0.45, this.tunnelTransition);
      targetMoonIntensity = THREE.MathUtils.lerp(targetMoonIntensity, 0.15, this.tunnelTransition);
    }

    this.dirLight.intensity = targetSunIntensity;
    this.hemiLight.intensity = targetHemiIntensity;
    if (this.ambientMoon) this.ambientMoon.intensity = targetMoonIntensity;

    // Hemisphere sky and ground colors
    this._targetHemiSky.copy(fromState.hemiSky).lerp(toState.hemiSky, smoothT);
    this._targetHemiGround.copy(fromState.hemiGround).lerp(toState.hemiGround, smoothT);
    this.hemiLight.color.copy(this._targetHemiSky);
    this.hemiLight.groundColor.copy(this._targetHemiGround);

    // Sky shader gradient uniforms
    if (this.skyMat && this.skyMat.uniforms) {
      this._targetSkyTop.copy(fromState.skyTop).lerp(toState.skyTop, smoothT);
      this._targetSkyMid.copy(fromState.skyMid).lerp(toState.skyMid, smoothT);
      this._targetSkyBot.copy(fromState.skyBot).lerp(toState.skyBot, smoothT);
      this.skyMat.uniforms.topColor.value.copy(this._targetSkyTop);
      this.skyMat.uniforms.midColor.value.copy(this._targetSkyMid);
      this.skyMat.uniforms.botColor.value.copy(this._targetSkyBot);
    }

    // Fog
    if (this.scene.fog) {
      this._targetFogColor.copy(fromState.fogColor).lerp(toState.fogColor, smoothT);
      if (this.tunnelTransition > 0.01) {
        this._targetFogColor.lerp(new THREE.Color(0x120c08), this.tunnelTransition * 0.85);
      }
      this.scene.fog.color.copy(this._targetFogColor);
    }

    // Celestial Sun Disc
    if (this.sunMesh) {
      const sunP = this.dirLight.position;
      this.sunMesh.position.set(sunP.x * 1.5, Math.max(-20, sunP.y * 1.2), -220);
      this.sunMesh.material.color.copy(this._targetSunColor);
      this.sunMesh.visible = (sunP.y > -10 && this.tunnelTransition < 0.9);
    }

    // Stars particle field
    if (this.stars) {
      this.stars.visible = (phaseName === 'night' || phaseName === 'sunset' || phaseName === 'dawn') && (this.tunnelTransition < 0.9);
      if (this.stars.material) {
        this.stars.material.opacity = THREE.MathUtils.lerp(fromState.starsOpacity, toState.starsOpacity, smoothT);
      }
    }
  }

  getLightingTelemetry() {
    return {
      timeOfDay: this.timeOfDay || 'day',
      cycleProgress: parseFloat((this.cycleProgress || 0).toFixed(3)),
      currentPhase: this.currentLightingPhase || 'day',
      sunIntensity: this.dirLight ? parseFloat(this.dirLight.intensity.toFixed(2)) : 0,
      sunColorHex: this.dirLight ? '#' + this.dirLight.color.getHexString() : '#000000',
      hemiIntensity: this.hemiLight ? parseFloat(this.hemiLight.intensity.toFixed(2)) : 0,
      moonIntensity: this.ambientMoon ? parseFloat(this.ambientMoon.intensity.toFixed(2)) : 0,
      isInsideTunnel: Boolean(this.isInsideTunnel),
      tunnelTransition: parseFloat((this.tunnelTransition || 0).toFixed(3)),
      tunnelSegmentCount: this.tunnelSegments ? this.tunnelSegments.length : 0,
      tunnelLightCount: this.tunnelLights ? this.tunnelLights.length : 0,
      headlightsRequired: Boolean(this.headlightsRequired)
    };
  }

  getBiomeTelemetry() {
    return {
      currentTheme: this.currentTheme,
      wetness: parseFloat((this.roadWetness || 0).toFixed(3)),
      isWetAsphalt: Boolean(this.roadWetness > 0.05),
      asphaltRoughness: parseFloat((this.roadMaterial ? this.roadMaterial.roughness : 0.35).toFixed(3)),
      asphaltMetalness: parseFloat((this.roadMaterial ? this.roadMaterial.metalness : 0.28).toFixed(3)),
      holographicBillboardsCount: this.holographicBillboards ? this.holographicBillboards.length : 0,
      hologramGlitchActive: Boolean(this.hologramGlitchTimer > 0),
      monorail: {
        active: Boolean(this.monorailTrain),
        positionZ: this.monorailTrain ? parseFloat(this.monorailTrain.position.z.toFixed(2)) : 0,
        speedKmh: this.monorailSpeed ? Math.round(this.monorailSpeed * 9) : 0,
        heightY: this.monorailTrain ? parseFloat(this.monorailTrain.position.y.toFixed(2)) : 0,
        pylonCount: this.monorailPylons ? this.monorailPylons.length : 0
      },
      soundBarriersCount: this.soundBarriers ? this.soundBarriers.length : 0,
      gantriesCount: this.gantries ? this.gantries.length : 0,
      canyon: {
        cliffsCount: this.canyonCliffs ? this.canyonCliffs.length : 0,
        archwaysCount: this.canyonArchways ? this.canyonArchways.length : 0,
        dustDevilsCount: this.dustDevils ? this.dustDevils.length : 0,
        tumbleweedsCount: this.tumbleweeds ? this.tumbleweeds.length : 0
      },
      arctic: {
        blackIcePatchesCount: this.blackIcePatches ? this.blackIcePatches.length : 0,
        playerOnBlackIce: Boolean(this.lastPlayerOnBlackIce),
        surfaceFriction: parseFloat((this.lastSurfaceFriction || 1.0).toFixed(3))
      },
      catEyes: {
        totalReflectors: this.roadReflectors ? this.roadReflectors.length : 0,
        activeGlintCount: this.activeCatEyesCount || 0
      }
    };
  }
}
