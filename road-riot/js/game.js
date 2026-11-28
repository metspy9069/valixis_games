// Road Riot 3D - Flagship Game Engine & State Controller
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { audio } from './audio.js';
import { WorldManager } from './world.js';
import { PlayerCar, VEHICLE_ROSTER } from './player.js';
import { TrafficManager, updateEvasionTracking } from './traffic.js';
import { progression, ACHIEVEMENTS } from './progression.js';

import { shop } from './shop.js';
import { NPCCar } from './npcCar.js';
import { PedestrianManager } from './pedestrians.js';
import { loadJSON } from './utils/loadJSON.js';
import { TouchInputTracker, normalizeGamepadState, HapticController } from './input.js';

class RoadRiotGame {
  constructor() {
    this.canvas = document.querySelector('#game-canvas');
    this.mobileDevice = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

    // Three.js Core with High-Precision Native Multi-Sampling & Anti-Aliasing
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    this.isMobileDevice = typeof window !== 'undefined' && (
      window.matchMedia('(max-width: 768px)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    );
    // Safe DPR ceiling to prevent GPU memory exhaust and 4K FBO stalls on high-DPI displays
    const maxDpr = this.isMobileDevice ? 1.0 : 1.25;
    const dpr = Math.max(0.85, Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isMobileDevice;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // Graceful WebGL Context Lost recovery
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[Road Riot] WebGL context lost. Pausing to prevent tab crash.');
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.info('[Road Riot] WebGL context restored.');
      this.initPostProcessing();
    }, false);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0c1322, 130, 480);

    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 700);
    this.defaultCamPos = new THREE.Vector3(0, 3.8, 1.2);
    this.introCamPos = new THREE.Vector3(-4.2, 2.8, -13);
    this.scratchVec = new THREE.Vector3();
    this.camera.position.set(-0.5, 1.85, -3.2);
    this.camera.lookAt(-0.5, 0.75, -8);

    // State Machine: 'MENU', 'COUNTDOWN', 'RUNNING', 'PAUSED', 'GAMEOVER', 'GARAGE'
    this.state = 'MENU';
    this.distance = 0;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.isFever = false;
    this.camShake = 0;
    this.keys = new Set();
    this.mouseTargetX = 0;
    this.countdownStep = 3;
    this.countdownTimer = 0;

    // Game Mode & Biome
    this.gameMode = 'ENDLESS'; // 'ENDLESS' | 'SPRINT'
    this.sprintTargetDistance = 3000;
    this.rivalCars = [];
    this.racePosition = 1;
    this.currentBiome = 'midnight';

    // 3D Turntable Drag Rotation (Default hero 3/4 pose facing player)
    this.turntableAngle = 2.45;
    this.isDraggingTurntable = false;
    this.lastDragX = 0;

    // Assets Prototypes
    this.assetPrototypes = {};
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./assets/draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Subsystems
    this.world = new WorldManager(this.scene, this.renderer);
    this.traffic = new TrafficManager(this.scene, this.assetPrototypes);
    this.player = new PlayerCar(this.scene, this.assetPrototypes);
    this.initPostProcessing();

    // Wandering Pedestrian Manager on Sidewalks
    this.pedestrianManager = new PedestrianManager(this.scene);

    // NPC Traffic Loop Cars using NPCCar
    this.npcCars = [];
    const npcLoopPoints = [
      new THREE.Vector3(-6, 0, -15),
      new THREE.Vector3(-6, 0, -180),
      new THREE.Vector3(0, 0, -250),
      new THREE.Vector3(6, 0, -180),
      new THREE.Vector3(6, 0, -15),
      new THREE.Vector3(0, 0, 0)
    ];
    this.npcCars.push(new NPCCar(this.scene, npcLoopPoints, 0x00d9ff, 19));
    this.npcCars.push(new NPCCar(this.scene, npcLoopPoints, 0xff2a85, 23));
    this.npcCars.push(new NPCCar(this.scene, npcLoopPoints, 0xffb800, 16));

    // Pure Racing Speed Checkpoint Milestones
    this.checkpointDistance = 380;
    this.checkpointInterval = 850;
    this.isDynoTesting = false;

    // 3D Turntable Showcase Platform
    this.turntableMesh = this.buildTurntableMesh();
    this.scene.add(this.turntableMesh);
    this.turntableMesh.visible = true;
    this.turntableMesh.position.set(-0.5, 0, -8);
    this.player.mesh.position.set(-0.5, 0.19, -8);
    this.player.x = -0.5;

    // Supercar roster & menu 3D interactive controls
    this.garageVehicleList = Object.keys(VEHICLE_ROSTER);
    const selCar = progression.data.selectedVehicle || 'apex';
    this.garageIndex = Math.max(0, this.garageVehicleList.indexOf(selCar));
    this.menuVehicleIndex = this.garageIndex;
    this.mouseMenuX = 0;
    this.mouseMenuY = 0;
    this.isDraggingMenuTurntable = false;
    this.lastGear = 1;
    this.keyboardDownKeys = new Set();
    this.touchTracker = new TouchInputTracker();
    this.haptics = new HapticController();
    this.gamepadPrevButtons = { pause: false, emp: false };
    this._wasDrifting = false;
    this._lastGamepadState = null;

    // New Mechanisms State: Heat Level, Slipstream Drafting, Apex Flow, Speed Trap
    this.heatLevel = 0;
    this.heatTimer = 0;
    this.draftCharge = 0;
    this.isDrafting = false;
    this.apexFlowTimer = 0;
    this.nearMissChain = 0;
    this.nearMissChainTimer = 0;
    this.nextSpeedTrapDistance = 450;
    this.policeActive = false;
    this.evasionTimer = 0;
    this.minPoliceDist = 999;
    this.empCooldown = 0;

    // Bind UI & Inputs
    this.cacheDomElements();
    this.bindShopEvents();
    this.bindEvents();
    this.applySavedSettings();
    this.updateMenuVehicleDisplay();
    this.loadAssets();
    this.checkUrlChallenge();
    this.initSpeedLines();

    // Start render loop
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  cacheDomElements() {
    this.ui = {
      hud: document.querySelector('#hud'),
      distance: document.querySelector('#hud-distance'),
      score: document.querySelector('#hud-score'),
      multiplier: document.querySelector('#hud-multiplier'),
      coins: document.querySelector('#hud-coins'),
      hullBar: document.querySelector('#hud-hull-fill'),
      hullBox: document.querySelector('#hud-hull-box'),
      speedNum: document.querySelector('#hud-speed'),
      speedMph: document.querySelector('#hud-mph'),
      speedBar: document.querySelector('#hud-speed-fill'),
      gearBadge: document.querySelector('#hud-gear'),
      shiftLeds: document.querySelectorAll('#hud-shift-lights .shift-led'),
      rpmNum: document.querySelector('#hud-rpm'),
      rpmBar: document.querySelector('#hud-rpm-fill'),
      nitroBar: document.querySelector('#hud-nitro-fill'),
      nitroTrack: document.querySelector('#hud-nitro-track'),
      nitroTag: document.querySelector('#nitro-status-tag'),
      announcer: document.querySelector('#announcer-zone'),
      floatingScores: document.querySelector('#floating-scores-layer'),
      countdownOverlay: document.querySelector('#countdown-overlay'),
      countdownText: document.querySelector('#countdown-text'),

      // Radar & Checkpoint Progress
      radarProgress: document.querySelector('#radar-progress'),
      radarPinPlayer: document.querySelector('#radar-pin-player'),
      radarPinBeacon: document.querySelector('#radar-pin-beacon'),
      checkpointFill: document.querySelector('#hud-checkpoint-fill'),
      checkpointRem: document.querySelector('#hud-checkpoint-rem'),
      spatialRadar: document.querySelector('#highway-spatial-radar'),
      blipsLeft: document.querySelector('#blips-lane-left'),
      blipsCenter: document.querySelector('#blips-lane-center'),
      blipsRight: document.querySelector('#blips-lane-right'),
      spatialPlayerMarker: document.querySelector('#spatial-player-marker'),
      proximityAlert: document.querySelector('#hud-proximity-alert'),
      proximityText: document.querySelector('#hud-proximity-text'),
      rampCue: document.querySelector('#hud-ramp-cue'),

      // New Gameplay Telemetry & Mechanisms
      heatStars: document.querySelectorAll('.heat-star'),
      evasionBar: document.querySelector('#hud-evasion-bar'),
      evasionFill: document.querySelector('#hud-evasion-fill'),
      evasionText: document.querySelector('#hud-evasion-text'),
      draftingContainer: document.querySelector('#hud-drafting-container'),
      draftingFill: document.querySelector('#hud-drafting-fill'),
      draftingPct: document.querySelector('#hud-drafting-pct'),
      draftingHint: document.querySelector('#hud-drafting-slingshot-hint'),
      speedTrapFlash: document.querySelector('#hud-speed-trap-flash'),
      apexFlowOverlay: document.querySelector('#hud-apex-flow-overlay'),
      empBtn: document.querySelector('#hud-emp-btn'),
      hudGamepadBadge: document.querySelector('#hud-gamepad-badge'),
      mobileControls: document.querySelector('#mobile-controls'),
      touchJoystickZone: document.querySelector('#touch-joystick-zone'),
      virtualJoystickBase: document.querySelector('#virtual-joystick-base'),
      virtualJoystickKnob: document.querySelector('#virtual-joystick-knob'),

      // Screen Overlays
      overlayDamage: document.querySelector('#overlay-damage'),
      overlayWarp: document.querySelector('#overlay-warp'),
      overlayShield: document.querySelector('#overlay-shield'),
      overlayRedAlert: document.querySelector('#overlay-red-alert'),

      // Modals & Navigation
      menuModal: document.querySelector('#menu-modal'),
      menuEquippedCar: document.querySelector('#menu-equipped-car'),
      menuCoins: document.querySelector('#menu-coins'),
      startBtn: document.querySelector('#start-btn'),
      garageBtn: document.querySelector('#garage-btn'),
      shopBtn: document.querySelector('#shop-btn'),
      menuSettingsBtn: document.querySelector('#menu-settings-btn'),
      menuView3dBtn: document.querySelector('#menu-view-3d-btn'),
      menuPrevCarBtn: document.querySelector('#menu-prev-car-btn'),
      menuNextCarBtn: document.querySelector('#menu-next-car-btn'),
      menuCarTierBadge: document.querySelector('#menu-car-tier-badge'),
      menuCarThumb: document.querySelector('#menu-car-thumb'),
      menuStatSpeed: document.querySelector('#menu-stat-speed'),
      menuStatAccel: document.querySelector('#menu-stat-accel'),
      menuStatHandling: document.querySelector('#menu-stat-handling'),
      menuStatNitro: document.querySelector('#menu-stat-nitro'),
      menuStatArmor: document.querySelector('#menu-stat-armor'),
      menuValSpeed: document.querySelector('#menu-val-speed'),
      menuValAccel: document.querySelector('#menu-val-accel'),
      menuValHandling: document.querySelector('#menu-val-handling'),
      menuValNitro: document.querySelector('#menu-val-nitro'),
      menuValArmor: document.querySelector('#menu-val-armor'),
      pauseBtn: document.querySelector('#pause-btn'),
      settingsBtn: document.querySelector('#settings-btn'),
      audioBtn: document.querySelector('#audio-btn'),
      networkBtn: document.querySelector('#network-btn'),

      // Garage
      garageModal: document.querySelector('#garage-modal'),
      garageCloseBtn: document.querySelector('#garage-close-btn'),
      garageRaceNowBtn: document.querySelector('#garage-race-now-btn'),
      garageCarChips: document.querySelector('#garage-car-chips'),
      garageCarPrice: document.querySelector('#garage-car-price'),
      garageCarTitle: document.querySelector('#garage-car-title'),
      garageCarTier: document.querySelector('#garage-car-tier'),
      garageCarDesc: document.querySelector('#garage-car-desc'),
      garagePrevBtn: document.querySelector('#garage-prev-btn'),
      garageNextBtn: document.querySelector('#garage-next-btn'),
      garageBuyBtn: document.querySelector('#garage-buy-btn'),
      garageCoins: document.querySelector('#garage-coins'),
      garageStatsList: document.querySelector('#garage-stats-list'),
      tabCarsBtn: document.querySelector('#tab-cars-btn'),
      tabAchievementsBtn: document.querySelector('#tab-achievements-btn'),
      tabViewCarBtn: document.querySelector('#tab-view-car-btn'),
      garageTuningPanel: document.querySelector('#garage-tuning-panel'),
      garageViewCars: document.querySelector('#garage-view-cars'),
      garageViewAchievements: document.querySelector('#garage-view-achievements'),
      achievementsContainer: document.querySelector('#achievements-container'),
      paintSwatches: document.querySelectorAll('.paint-swatch'),
      glowSwatches: document.querySelectorAll('.glow-swatch'),

      // Settings Modal
      settingsModal: document.querySelector('#settings-modal'),
      settingsCloseBtn: document.querySelector('#settings-close-btn'),
      sliderVolMaster: document.querySelector('#slider-vol-master'),
      sliderVolEngine: document.querySelector('#slider-vol-engine'),
      sliderVolSfx: document.querySelector('#slider-vol-sfx'),
      sliderVolMusic: document.querySelector('#slider-vol-music'),
      sliderSensitivity: document.querySelector('#slider-sensitivity'),
      toggleTouchMode: document.querySelector('#toggle-touch-mode'),
      toggleHaptics: document.querySelector('#toggle-haptics'),
      toggleMouseSteer: document.querySelector('#toggle-mouse-steer'),
      toggleGamepadRumble: document.querySelector('#toggle-gamepad-rumble'),
      qualityBtns: document.querySelectorAll('.quality-btn'),

      // Pause Modal
      pauseModal: document.querySelector('#pause-modal'),
      pauseResumeBtn: document.querySelector('#pause-resume-btn'),
      pauseRestartBtn: document.querySelector('#pause-restart-btn'),
      pauseSettingsBtn: document.querySelector('#pause-settings-btn'),

      // Game Over Screen
      gameoverModal: document.querySelector('#gameover-modal'),
      gameoverStatusEyebrow: document.querySelector('#gameover-status-eyebrow'),
      gameoverStatusTitle: document.querySelector('#gameover-status-title'),
      restartBtn: document.querySelector('#restart-btn'),
      gameoverGarageBtn: document.querySelector('#gameover-garage-btn'),
      runDist: document.querySelector('#run-distance'),
      runScore: document.querySelector('#run-score'),
      runSpeed: document.querySelector('#run-speed'),
      runNearMiss: document.querySelector('#run-nearmiss'),
      runRank: document.querySelector('#run-rank'),
      runCoinsAwarded: document.querySelector('#run-coins-awarded'),
      hudGarageBtn: document.querySelector('#hud-garage-btn'),
      racePosBox: document.querySelector('#hud-race-pos-box'),
      racePosNum: document.querySelector('#hud-race-pos'),
      modeEndlessBtn: document.querySelector('#mode-endless-btn'),
      modeSprintBtn: document.querySelector('#mode-sprint-btn'),
      biomeBtns: document.querySelectorAll('.biome-btn'),
      runDriftPts: document.querySelector('#run-drift-pts'),
      runRampsJumped: document.querySelector('#run-ramps-jumped'),
      runDamageTaken: document.querySelector('#run-damage-taken'),

      // Checkpoint HUD
      checkpointBanner: document.querySelector('#hud-checkpoint-banner'),
      garageDynoBtn: document.querySelector('#garage-dyno-btn'),

      // Network Modal
      networkModal: document.querySelector('#network-modal'),
      networkCloseBtn: document.querySelector('#network-close-btn')
    };
  }

  buildTurntableMesh() {
    const group = new THREE.Group();

    // Beveled dark carbon base
    const baseGeo = new THREE.CylinderGeometry(4.2, 4.5, 0.16, 48);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x070c14, roughness: 0.6, metalness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.08;
    base.receiveShadow = true;
    group.add(base);

    // Glowing Neon Ring
    const ringGeo = new THREE.TorusGeometry(4.1, 0.06, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.165;
    group.add(ring);

    // Center circular brushed metal plate
    const plateGeo = new THREE.CylinderGeometry(3.95, 3.95, 0.04, 48);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x111b2b, roughness: 0.35, metalness: 0.85 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.17;
    plate.receiveShadow = true;
    group.add(plate);

    // Studio Spotlights illuminating car
    const spotKey = new THREE.SpotLight(0xffffff, 5.5, 22, Math.PI / 4, 0.3);
    spotKey.position.set(-3, 7, -4);
    spotKey.target = base;
    spotKey.castShadow = !this.isMobileDevice;
    spotKey.shadow.bias = -0.0005;
    spotKey.shadow.mapSize.width = 1024;
    spotKey.shadow.mapSize.height = 1024;
    spotKey.shadow.radius = 2.0;
    group.add(spotKey);

    const spotFill = new THREE.SpotLight(0x00d9ff, 3.5, 20, Math.PI / 3, 0.4);
    spotFill.position.set(4, 5, -5);
    spotFill.target = base;
    group.add(spotFill);

    // Automotive Rim & Glint Specular Light to accentuate PBR clearcoat
    const spotRim = new THREE.SpotLight(0xfff0dd, 4.8, 22, Math.PI / 4, 0.4);
    spotRim.position.set(-2, 6, -12);
    spotRim.target = base;
    group.add(spotRim);

    return group;
  }

  applySavedSettings() {
    const s = progression.data.settings;
    if (this.ui.sliderVolMaster) this.ui.sliderVolMaster.value = s.masterVolume;
    if (this.ui.sliderVolEngine) this.ui.sliderVolEngine.value = s.engineVolume;
    if (this.ui.sliderVolSfx) this.ui.sliderVolSfx.value = s.sfxVolume;
    if (this.ui.sliderVolMusic) this.ui.sliderVolMusic.value = s.musicVolume;
    if (this.ui.sliderSensitivity) this.ui.sliderSensitivity.value = s.steeringSensitivity;

    audio.setMasterVolume(s.masterVolume);
    audio.setEngineVolume(s.engineVolume);
    audio.setSfxVolume(s.sfxVolume);
    audio.setMusicVolume(s.musicVolume);

    if (this.ui.toggleTouchMode) {
      const mode = s.touchControlMode || 'joystick';
      this.ui.toggleTouchMode.textContent = mode.toUpperCase();
      this.ui.toggleTouchMode.classList.toggle('active', mode === 'joystick');
    }
    if (this.ui.mobileControls) {
      const mode = s.touchControlMode || 'joystick';
      this.ui.mobileControls.classList.toggle('joystick-mode', mode === 'joystick');
      this.ui.mobileControls.classList.toggle('buttons-mode', mode !== 'joystick');
    }
    if (this.ui.toggleHaptics) {
      const enabled = s.hapticFeedbackEnabled !== false;
      this.ui.toggleHaptics.textContent = enabled ? 'ON' : 'OFF';
      this.ui.toggleHaptics.classList.toggle('active', enabled);
    }
    if (this.ui.toggleMouseSteer) {
      this.ui.toggleMouseSteer.textContent = s.mouseSteerEnabled ? 'ON' : 'OFF';
      this.ui.toggleMouseSteer.classList.toggle('active', s.mouseSteerEnabled);
    }
    if (this.ui.toggleGamepadRumble) {
      this.ui.toggleGamepadRumble.textContent = s.gamepadRumbleEnabled ? 'ON' : 'OFF';
      this.ui.toggleGamepadRumble.classList.toggle('active', s.gamepadRumbleEnabled);
    }

    this.applyGraphicsQuality(s.graphicsQuality || 'high');
  }

  initPostProcessing() {
    this.bloomEnabled = false;
    this.composer = null;
    this.bloomPass = null;
    this.renderPass = null;

    if (typeof window === 'undefined' || !this.renderer || this.isMobileDevice) return;

    try {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        0.48, // bloom strength
        0.35, // bloom radius
        0.82  // bloom threshold
      );
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloomPass);

      const q = (progression && progression.data && progression.data.settings && progression.data.settings.graphicsQuality) || 'med';
      this.bloomEnabled = (q === 'high' || q === 'ultra');
    } catch (e) {
      console.warn('EffectComposer post-processing init skipped or unsupported in environment:', e);
      this.composer = null;
      this.bloomPass = null;
      this.bloomEnabled = false;
    }
  }

  applyGraphicsQuality(quality) {
    progression.data.settings.graphicsQuality = quality;
    progression.save();

    this.ui.qualityBtns?.forEach(b => {
      b.classList.toggle('active', b.dataset.quality === quality);
    });

    if (this.isMobileDevice || quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
      this.bloomEnabled = false;
    } else if (quality === 'med') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
      this.bloomEnabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.bloomEnabled = true;
      if (this.bloomPass) this.bloomPass.strength = 0.42;
    }
  }

  bindShopEvents() {
    this.ui.garageBtn?.addEventListener('click', () => this.openGarage());
    document.querySelector('#shop-btn')?.addEventListener('click', () => this.openGarage());
    this.ui.hudGarageBtn?.addEventListener('click', () => this.openGarage());
  }

  bindEvents() {
    // Keyboard
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
      this.keyboardDownKeys.add(e.key);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') {
        this.triggerKineticEmp();
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', e => {
      this.keyboardDownKeys.delete(e.key);
      if (!this.touchTracker.hasActiveKey(e.key)) {
        this.keys.delete(e.key);
      }
    });

    this.ui.empBtn?.addEventListener('click', () => this.triggerKineticEmp());

    // Mouse Pointer Steering
    window.addEventListener('mousemove', e => {
      if (this.state === 'RUNNING' && progression.data.settings.mouseSteerEnabled) {
        const norm = (e.clientX / window.innerWidth) * 2 - 1; // -1 to +1
        this.mouseTargetX = norm * 7.2;
      }
    });

    // Window Resize with Exact 1:1 Pixel Mapping
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      const maxDpr = this.isMobileDevice ? 1.35 : 2.0;
      const newDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, maxDpr));
      this.renderer.setPixelRatio(newDpr);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) {
        this.composer.setSize(window.innerWidth, window.innerHeight);
      }
      if (this.bloomPass && this.bloomPass.resolution) {
        this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
      }
    });

    // Mobile Virtual Floating Steering Joystick
    const joyZone = this.ui.touchJoystickZone;
    const joyBase = this.ui.virtualJoystickBase;
    const joyKnob = this.ui.virtualJoystickKnob;
    const JOY_RADIUS = 56;
    const resetJoystickVisual = () => {
      if (joyBase) {
        joyBase.classList.remove('active');
        joyBase.classList.add('idle');
        joyBase.style.transform = 'translate3d(0, 0, 0)';
      }
      if (joyKnob) {
        joyKnob.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    if (joyZone) {
      joyZone.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        if (this.touchTracker.joystick.active) return;
        try { joyZone.setPointerCapture?.(ev.pointerId); } catch (e) {}
        this.touchTracker.startJoystick(ev.pointerId, ev.clientX, ev.clientY);
        if (joyBase) {
          joyBase.classList.remove('idle');
          joyBase.classList.add('active');
          // Dynamically center base smoothly within touch zone bounds
          const rect = joyZone.getBoundingClientRect();
          const localX = Math.max(54, Math.min(rect.width - 54, ev.clientX - rect.left));
          const localY = Math.max(54, Math.min(rect.height - 54, ev.clientY - rect.top));
          const restLeft = 68;
          const restTop = rect.height - 68;
          joyBase.style.transform = `translate3d(${localX - restLeft}px, ${localY - restTop}px, 0)`;
        }
        this.triggerHapticChannel('touch_tap', { vibratePattern: 10, durationMs: 12, cooldownMs: 80 });
      }, { passive: false });

      const onJoyMove = ev => {
        if (!this.touchTracker.joystick.active || ev.pointerId !== this.touchTracker.joystick.pointerId) return;
        ev.preventDefault();
        const out = this.touchTracker.moveJoystick(ev.pointerId, ev.clientX, ev.clientY, JOY_RADIUS, 0.14);
        if (out && joyKnob) {
          joyKnob.style.transform = `translate3d(${out.clampedDx}px, ${out.clampedDy}px, 0)`;
        }
      };

      const onJoyRelease = ev => {
        if (ev.pointerId !== this.touchTracker.joystick.pointerId) return;
        ev.preventDefault();
        try { joyZone.releasePointerCapture?.(ev.pointerId); } catch (e) {}
        this.touchTracker.releasePointer(ev.pointerId);
        resetJoystickVisual();
      };

      joyZone.addEventListener('pointermove', onJoyMove, { passive: false });
      joyZone.addEventListener('pointerup', onJoyRelease, { passive: false });
      joyZone.addEventListener('pointercancel', onJoyRelease, { passive: false });
      joyZone.addEventListener('lostpointercapture', onJoyRelease, { passive: false });
      joyZone.addEventListener('touchcancel', () => {
        this.touchTracker.joystick.active = false;
        this.touchTracker.joystick.pointerId = null;
        this.touchTracker.joystick.steer = 0;
        resetJoystickVisual();
      }, { passive: false });
    }

    // Mobile Touch Action & Steer Buttons with Per-Pointer Isolation (Zero Touch-Cancel Leaks)
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const key = btn.dataset.key;
      const onDown = ev => {
        ev.preventDefault();
        try { btn.setPointerCapture?.(ev.pointerId); } catch (e) {}
        this.touchTracker.pressButton(ev.pointerId, key);
        this.triggerHapticChannel('touch_tap', { vibratePattern: 16, durationMs: 18, cooldownMs: 50 });
        this.keys.add(key);
        btn.classList.add('is-pressed');
      };
      const onReleasePointer = ev => {
        ev.preventDefault();
        const { releasedKey } = this.touchTracker.releasePointer(ev.pointerId);
        const targetKey = releasedKey || key;
        if (!this.touchTracker.hasActiveKey(targetKey) && !this.keyboardDownKeys.has(targetKey)) {
          this.keys.delete(targetKey);
        }
        btn.classList.remove('is-pressed');
      };
      const onTouchCancel = ev => {
        ev.preventDefault();
        if (ev.changedTouches) {
          for (const t of ev.changedTouches) {
            this.touchTracker.releasePointer(t.identifier);
          }
        }
        if (!this.touchTracker.hasActiveKey(key) && !this.keyboardDownKeys.has(key)) {
          this.keys.delete(key);
        }
        btn.classList.remove('is-pressed');
      };
      btn.addEventListener('pointerdown', onDown, { passive: false });
      btn.addEventListener('pointerup', onReleasePointer, { passive: false });
      btn.addEventListener('pointercancel', onReleasePointer, { passive: false });
      btn.addEventListener('lostpointercapture', onReleasePointer, { passive: false });
      btn.addEventListener('touchcancel', onTouchCancel, { passive: false });
    });

    // Global safety cleanup ONLY for individual released pointerId, window blur, or backgrounding
    const releaseStalePointer = ev => {
      const { releasedKey, releasedJoystick } = this.touchTracker.releasePointer(ev.pointerId);
      if (releasedKey && !this.touchTracker.hasActiveKey(releasedKey) && !this.keyboardDownKeys.has(releasedKey)) {
        this.keys.delete(releasedKey);
      }
      if (releasedJoystick) resetJoystickVisual();
    };
    window.addEventListener('pointerup', releaseStalePointer);
    window.addEventListener('pointercancel', releaseStalePointer);

    const clearAllInputs = () => {
      this.touchTracker.resetAll();
      this.keys.clear();
      this.keyboardDownKeys.clear();
      resetJoystickVisual();
      document.querySelectorAll('.touch-btn.is-pressed').forEach(b => b.classList.remove('is-pressed'));
    };
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAllInputs();
    });

    // Gamepad API Connection Listeners
    window.addEventListener('gamepadconnected', e => {
      this.ui.hudGamepadBadge?.classList.remove('hidden');
      this.toast(`GAMEPAD CONNECTED: ${(e.gamepad?.id || 'CONTROLLER').slice(0, 26).toUpperCase()}`, 'cyan');
    });
    window.addEventListener('gamepaddisconnected', () => {
      const hasAny = navigator.getGamepads && Array.from(navigator.getGamepads()).some(g => g && g.connected);
      if (!hasAny) this.ui.hudGamepadBadge?.classList.add('hidden');
      this.toast('GAMEPAD DISCONNECTED', 'gold');
    });

    // Modal Triggers
    this.ui.startBtn?.addEventListener('click', () => this.startCountdown());
    this.ui.restartBtn?.addEventListener('click', () => this.startCountdown());
    this.ui.pauseRestartBtn?.addEventListener('click', () => {
      this.ui.pauseModal.classList.add('hidden');
      this.startCountdown();
    });

    this.ui.garageBtn?.addEventListener('click', () => this.openGarage());
    this.ui.hudGarageBtn?.addEventListener('click', () => this.openGarage());
    this.ui.garageCloseBtn?.addEventListener('click', () => this.closeGarage());
    this.ui.garageRaceNowBtn?.addEventListener('click', () => {
      this.closeGarage();
      this.startCountdown();
    });
    this.ui.gameoverGarageBtn?.addEventListener('click', () => {
      this.ui.gameoverModal.classList.add('hidden');
      this.openGarage();
    });

    this.ui.pauseBtn?.addEventListener('click', () => this.togglePause());
    this.ui.pauseResumeBtn?.addEventListener('click', () => this.togglePause());

    this.ui.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.ui.menuSettingsBtn?.addEventListener('click', () => this.openSettings());
    this.ui.pauseSettingsBtn?.addEventListener('click', () => this.openSettings());
    this.ui.settingsCloseBtn?.addEventListener('click', () => this.closeSettings());

    // Menu Spatial 3D Showcase & Quick Switchers
    this.ui.menuView3dBtn?.addEventListener('click', () => {
      const is3dActive = this.ui.menuModal.classList.toggle('view-3d-active');
      this.ui.menuView3dBtn.classList.toggle('active', is3dActive);
      this.ui.menuView3dBtn.textContent = is3dActive ? '🗂 SHOW INTERFACE' : '👁 3D VIEW';
      this.toast(is3dActive ? 'IMMERSIVE 3D SHOWCASE MODE' : 'RACE HUD RESTORED', 'cyan');
    });

    this.ui.menuPrevCarBtn?.addEventListener('click', () => {
      this.menuVehicleIndex = (this.menuVehicleIndex - 1 + this.garageVehicleList.length) % this.garageVehicleList.length;
      this.updateMenuVehicleDisplay();
      audio.play('gear_shift');
    });

    this.ui.menuNextCarBtn?.addEventListener('click', () => {
      this.menuVehicleIndex = (this.menuVehicleIndex + 1) % this.garageVehicleList.length;
      this.updateMenuVehicleDisplay();
      audio.play('gear_shift');
    });

    this.ui.networkBtn?.addEventListener('click', () => this.ui.networkModal.classList.remove('hidden'));
    this.ui.networkCloseBtn?.addEventListener('click', () => this.ui.networkModal.classList.add('hidden'));

    this.ui.audioBtn?.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      this.ui.audioBtn.innerHTML = isMuted
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    });

    // Garage Tabs
    this.ui.tabCarsBtn?.addEventListener('click', () => {
      this.ui.garageTuningPanel?.classList.remove('minimized');
      if (this.ui.tabViewCarBtn) {
        this.ui.tabViewCarBtn.textContent = '👁 3D VIEW';
        this.ui.tabViewCarBtn.classList.remove('active');
      }
      this.ui.tabCarsBtn.classList.add('active');
      this.ui.tabAchievementsBtn.classList.remove('active');
      this.ui.garageViewCars.classList.remove('hidden');
      this.ui.garageViewAchievements.classList.add('hidden');
    });

    this.ui.tabAchievementsBtn?.addEventListener('click', () => {
      this.ui.garageTuningPanel?.classList.remove('minimized');
      if (this.ui.tabViewCarBtn) {
        this.ui.tabViewCarBtn.textContent = '👁 3D VIEW';
        this.ui.tabViewCarBtn.classList.remove('active');
      }
      this.ui.tabAchievementsBtn.classList.add('active');
      this.ui.tabCarsBtn.classList.remove('active');
      this.ui.garageViewAchievements.classList.remove('hidden');
      this.ui.garageViewCars.classList.add('hidden');
      this.renderAchievementsList();
    });

    this.ui.tabViewCarBtn?.addEventListener('click', () => {
      if (!this.ui.garageTuningPanel) return;
      const isMin = this.ui.garageTuningPanel.classList.toggle('minimized');
      this.ui.tabViewCarBtn.textContent = isMin ? '🗂 PANEL' : '👁 3D VIEW';
      this.ui.tabViewCarBtn.classList.toggle('active', isMin);
    });

    // Garage Carousel & Swatches
    this.ui.garagePrevBtn?.addEventListener('click', () => {
      this.garageIndex = (this.garageIndex - 1 + this.garageVehicleList.length) % this.garageVehicleList.length;
      this.renderGarageCarousel();
    });

    this.ui.garageNextBtn?.addEventListener('click', () => {
      this.garageIndex = (this.garageIndex + 1) % this.garageVehicleList.length;
      this.renderGarageCarousel();
    });

    this.ui.paintSwatches?.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const hex = parseInt(swatch.dataset.color, 16);
        progression.data.selectedPaint = hex;
        progression.save();
        this.player.paintColor = hex;
        this.player.rebuildCarModel();
        this.ui.paintSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });

    this.ui.glowSwatches?.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const hex = parseInt(swatch.dataset.color, 16);
        progression.data.selectedGlow = hex;
        progression.save();
        this.player.underglowColor = hex;
        if (this.player.underglowLight) this.player.underglowLight.color.setHex(hex);
        this.ui.glowSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });

    // Settings Sliders & Toggles
    this.ui.sliderVolMaster?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      progression.data.settings.masterVolume = v;
      audio.setMasterVolume(v);
      progression.save();
    });

    this.ui.sliderVolEngine?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      progression.data.settings.engineVolume = v;
      audio.setEngineVolume(v);
      progression.save();
    });

    this.ui.sliderVolSfx?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      progression.data.settings.sfxVolume = v;
      audio.setSfxVolume(v);
      progression.save();
    });

    this.ui.sliderVolMusic?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      progression.data.settings.musicVolume = v;
      audio.setMusicVolume(v);
      progression.save();
    });

    this.ui.sliderSensitivity?.addEventListener('input', e => {
      progression.data.settings.steeringSensitivity = parseFloat(e.target.value);
      progression.save();
    });

    this.ui.toggleTouchMode?.addEventListener('click', () => {
      const current = progression.data.settings.touchControlMode || 'joystick';
      const next = current === 'joystick' ? 'buttons' : 'joystick';
      progression.data.settings.touchControlMode = next;
      this.ui.toggleTouchMode.textContent = next.toUpperCase();
      this.ui.toggleTouchMode.classList.toggle('active', next === 'joystick');
      if (this.ui.mobileControls) {
        this.ui.mobileControls.classList.toggle('joystick-mode', next === 'joystick');
        this.ui.mobileControls.classList.toggle('buttons-mode', next !== 'joystick');
      }
      progression.save();
    });

    this.ui.toggleHaptics?.addEventListener('click', () => {
      const next = !(progression.data.settings.hapticFeedbackEnabled !== false);
      progression.data.settings.hapticFeedbackEnabled = next;
      this.ui.toggleHaptics.textContent = next ? 'ON' : 'OFF';
      this.ui.toggleHaptics.classList.toggle('active', next);
      progression.save();
    });

    this.ui.toggleMouseSteer?.addEventListener('click', () => {
      const next = !progression.data.settings.mouseSteerEnabled;
      progression.data.settings.mouseSteerEnabled = next;
      this.ui.toggleMouseSteer.textContent = next ? 'ON' : 'OFF';
      this.ui.toggleMouseSteer.classList.toggle('active', next);
      progression.save();
    });

    this.ui.toggleGamepadRumble?.addEventListener('click', () => {
      const next = !progression.data.settings.gamepadRumbleEnabled;
      progression.data.settings.gamepadRumbleEnabled = next;
      this.ui.toggleGamepadRumble.textContent = next ? 'ON' : 'OFF';
      this.ui.toggleGamepadRumble.classList.toggle('active', next);
      progression.save();
    });

    this.ui.qualityBtns?.forEach(b => {
      b.addEventListener('click', () => {
        this.applyGraphicsQuality(b.dataset.quality);
      });
    });

    // Game Mode & Biome Selectors
    const cardEndless = document.querySelector('#mode-card-endless');
    const cardSprint = document.querySelector('#mode-card-sprint');
    const selectEndless = () => {
      this.gameMode = 'ENDLESS';
      this.ui.modeEndlessBtn?.classList.add('active');
      if (this.ui.modeEndlessBtn) this.ui.modeEndlessBtn.textContent = 'SELECTED • ENDLESS';
      this.ui.modeSprintBtn?.classList.remove('active');
      if (this.ui.modeSprintBtn) this.ui.modeSprintBtn.textContent = 'SELECT SPRINT';
      cardEndless?.style.setProperty('border-color', 'var(--neon-cyan)');
      cardSprint?.style.setProperty('border-color', 'rgba(255, 42, 133, 0.25)');
      this.toast('MODE: ENDLESS HIGHWAY', 'cyan');
    };
    const selectSprint = () => {
      this.gameMode = 'SPRINT';
      this.ui.modeSprintBtn?.classList.add('active');
      if (this.ui.modeSprintBtn) this.ui.modeSprintBtn.textContent = 'SELECTED • SPRINT';
      this.ui.modeEndlessBtn?.classList.remove('active');
      if (this.ui.modeEndlessBtn) this.ui.modeEndlessBtn.textContent = 'SELECT ENDLESS';
      cardSprint?.style.setProperty('border-color', 'var(--neon-magenta)');
      cardEndless?.style.setProperty('border-color', 'rgba(0, 217, 255, 0.25)');
      this.toast('MODE: 4-CAR RIVAL SPRINT (3,000M)', 'gold');
    };
    this.ui.modeEndlessBtn?.addEventListener('click', (e) => { e.stopPropagation(); selectEndless(); });
    cardEndless?.addEventListener('click', selectEndless);
    this.ui.modeSprintBtn?.addEventListener('click', (e) => { e.stopPropagation(); selectSprint(); });
    cardSprint?.addEventListener('click', selectSprint);

    this.ui.biomeBtns?.forEach(b => {
      b.addEventListener('click', () => {
        this.currentBiome = b.dataset.biome;
        this.ui.biomeBtns.forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        this.world.setBiome(this.currentBiome);
        this.toast(`BIOME: ${this.currentBiome.toUpperCase()}`, 'cyan');
      });
    });

    // 3D Turntable Drag Interaction & Spatial Parallax
    window.addEventListener('pointerdown', e => {
      if (this.state === 'MENU') {
        if (e.target.closest('#menu-left-card') || e.target.closest('#menu-right-card') || e.target.closest('#menu-bottom-dock') || e.target.closest('.menu-top-header')) {
          return;
        }
        this.isDraggingMenuTurntable = true;
        this.lastDragX = e.clientX;
      } else if (this.state === 'GARAGE') {
        if (e.target.closest('#garage-tuning-panel') || e.target.closest('#garage-car-dock') || e.target.closest('.garage-top-bar')) {
          return;
        }
        this.isDraggingTurntable = true;
        this.lastDragX = e.clientX;
      }
    });

    window.addEventListener('pointermove', e => {
      if (this.state === 'MENU') {
        if (this.isDraggingMenuTurntable && this.player.chassis) {
          const dx = e.clientX - this.lastDragX;
          this.lastDragX = e.clientX;
          this.turntableAngle += dx * 0.012;
          this.player.chassis.rotation.y = this.turntableAngle;
          if (this.turntableMesh) this.turntableMesh.rotation.y = this.turntableAngle;
        }
      } else if (this.state === 'GARAGE' && this.isDraggingTurntable && this.player.chassis) {
        const dx = e.clientX - this.lastDragX;
        this.lastDragX = e.clientX;
        this.turntableAngle += dx * 0.012;
        this.player.chassis.rotation.y = this.turntableAngle;
        if (this.turntableMesh) this.turntableMesh.rotation.y = this.turntableAngle;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingMenuTurntable = false;
      this.isDraggingTurntable = false;
    });

    // Garage Dyno Test Benchmark
    this.ui.garageDynoBtn?.addEventListener('click', () => this.runDynoBenchmark());
  }

  runDynoBenchmark() {
    if (this.isDynoTesting) return;
    this.isDynoTesting = true;
    this.toast('DYNO BENCHMARK ENGAGED — REV TO REDLINE', 'gold');
    audio.resume();
    audio.startEngine();

    let timer = 0;
    const interval = setInterval(() => {
      timer += 0.06;
      const progress = Math.min(1, timer / 3.2);
      const simulatedKmh = Math.floor(progress * 340);
      audio.updateEngine(simulatedKmh, progress > 0.6);

      if (this.player.chassis) this.player.chassis.rotation.y += 0.25;
      if (this.turntableMesh) this.turntableMesh.rotation.y += 0.25;

      if (timer >= 3.2) {
        clearInterval(interval);
        this.isDynoTesting = false;
        audio.stopEngine();
        audio.resetTransmission();
        this.lastGear = 1;

    // New Mechanisms State: Heat Level, Slipstream Drafting, Apex Flow, Speed Trap
    this.heatLevel = 0;
    this.heatTimer = 0;
    this.draftCharge = 0;
    this.isDrafting = false;
    this.apexFlowTimer = 0;
    this.nearMissChain = 0;
    this.nearMissChainTimer = 0;
    this.nextSpeedTrapDistance = 450;
    this.policeActive = false;
    this.evasionTimer = 0;
    this.minPoliceDist = 999;
    this.empCooldown = 0;
        const sel = progression.data.selectedVehicle || 'apex';
    const carDef = VEHICLE_ROSTER[sel] || VEHICLE_ROSTER.apex;
    audio.setEngineProfile(carDef.engineProfile || 'v8');
    this.updateHeatHud();
    if (this.ui.gearBadge) this.ui.gearBadge.textContent = 'GEAR 1';
        const zeroToHundred = (2.65 + Math.random() * 0.45).toFixed(2);
        const horsepower = Math.floor(680 + Math.random() * 140);
        this.toast(`DYNO TELEMETRY: 0-100 IN ${zeroToHundred}s | ${horsepower} BHP`, 'cyan');
        audio.play('fever');
      }
    }, 60);
  }

  loadAssets() {
    const assetsToLoad = [
      { key: 'apex', url: './assets/player-apex.glb' },
      { key: 'player', url: './assets/player-apex.glb' },
      { key: 'venom', url: './assets/venom.glb' },
      { key: 'sports', url: './assets/sports.glb' },
      { key: 'phantom', url: './assets/phantom.glb' },
      { key: 'sedan-sports', url: './assets/sedan-sports.glb' },
      { key: 'interceptor', url: './assets/interceptor.glb' },
      { key: 'police', url: './assets/police.glb' },
      { key: 'titan', url: './assets/titan.glb' },
      { key: 'suv', url: './assets/suv.glb' },
      { key: 'hyperion', url: './assets/player-hyperion.glb' },
      { key: 'valkyrie', url: './assets/player-lamborghini.glb' },
      { key: 'spectre', url: './assets/sports.glb' },
      { key: 'van', url: './assets/van.glb' },
      { key: 'taxi', url: './assets/taxi.glb' },
      { key: 'ambulance', url: './assets/ambulance.glb' },
      { key: 'delivery', url: './assets/delivery.glb' },
      { key: 'sedan', url: './assets/sedan.glb' },
      { key: 'barrier', url: './assets/construction-barrier.glb' },
      { key: 'cone', url: './assets/construction-cone.glb' },
      { key: 'coin', url: './assets/coin-gold.glb' },
      { key: 'building-a', url: './assets/building-a.glb' },
      { key: 'building-b', url: './assets/building-b.glb' },
      { key: 'tree-large', url: './assets/tree-large.glb' },
      { key: 'tree-small', url: './assets/tree-small.glb' }
    ];

    assetsToLoad.forEach(item => {
      this.gltfLoader.load(
        item.url,
        gltf => {
          this.assetPrototypes[item.key] = gltf.scene;
          this.player.assetPrototypes = this.assetPrototypes;
          this.traffic.assetPrototypes = this.assetPrototypes;
          this.world.assetPrototypes = this.assetPrototypes;
          if (item.key === progression.data.selectedVehicle || item.key === 'player') {
            this.player.rebuildCarModel();
          }
        },
        undefined,
        () => {}
      );
    });

    const sel = progression.data.selectedVehicle || 'apex';
    const upg = progression.data.upgrades[sel] || {};
    this.player.setVehicle(sel, upg, progression.data.selectedPaint, progression.data.selectedGlow);
  }

  checkUrlChallenge() {
    if (typeof window !== 'undefined' && (window.location.hash === '#garage' || window.location.hash === '#shop')) {
      setTimeout(() => this.openGarage(), 150);
    }
    const challenge = progression.getChallengeDataFromUrl();
    if (challenge) {
      this.world.setChallengeTarget(challenge.distance, challenge.name);
      setTimeout(() => {
        this.toast(`CHALLENGE: Beat ${challenge.name}'s mark at ${challenge.distance}m!`, 'gold');
      }, 1000);
    }
  }

  // --- 3-2-1-GO COUNTDOWN & RUN LIFECYCLE ---
  startCountdown() {
    audio.resume();
    audio.resetTransmission();
    audio.startEngine();

    this.state = 'COUNTDOWN';
    this.countdownStep = 3;
    this.countdownTimer = 0;
    this.distance = 0;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.isFever = false;
    this.camShake = 0;

    progression.resetRunStats();
    this.traffic.clear();
    this.world.reset();
    if (this.npcCars) this.npcCars.forEach((npc, i) => npc.reset(i * 35));
    this.turntableAngle = 0;
    if (this.turntableMesh) this.turntableMesh.visible = false;

    const sel = progression.data.selectedVehicle || 'apex';
    const upg = progression.data.upgrades[sel] || {};
    this.player.setVehicle(sel, upg, progression.data.selectedPaint, progression.data.selectedGlow);
    this.player.reset();
    this.player.mesh.position.set(0, 0, -8);
    this.player.x = 0;
    this.lastGear = 1;

    // New Mechanisms State: Heat Level, Slipstream Drafting, Apex Flow, Speed Trap
    this.heatLevel = 0;
    this.heatTimer = 0;
    this.draftCharge = 0;
    this.isDrafting = false;
    this.apexFlowTimer = 0;
    this.nearMissChain = 0;
    this.nearMissChainTimer = 0;
    this.nextSpeedTrapDistance = 450;
    this.policeActive = false;
    this.evasionTimer = 0;
    this.minPoliceDist = 999;
    this.empCooldown = 0;
    const carDef = VEHICLE_ROSTER[sel] || VEHICLE_ROSTER.apex;
    audio.setEngineProfile(carDef.engineProfile || 'v8');
    this.updateHeatHud();
    if (this.ui.gearBadge) this.ui.gearBadge.textContent = 'GEAR 1';

    if (this.gameMode === 'SPRINT') {
      if (this.ui.racePosBox) this.ui.racePosBox.classList.remove('hidden');
      this.racePosition = 1;
      this.rivalCars = [
        { name: 'Viper GT', dist: 0, speed: 25.0 + Math.random() * 2.0 },
        { name: 'Shadow Racer', dist: 0, speed: 24.5 + Math.random() * 2.0 },
        { name: 'Ghost Interceptor', dist: 0, speed: 24.0 + Math.random() * 2.0 }
      ];
    } else {
      if (this.ui.racePosBox) this.ui.racePosBox.classList.add('hidden');
      this.rivalCars = [];
    }

    this.ui.menuModal.classList.add('hidden');
    this.ui.gameoverModal.classList.add('hidden');
    this.ui.pauseModal.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    if (this.ui.overlayRedAlert) this.ui.overlayRedAlert.classList.add('hidden');
    this.updateHud(0);

    this.ui.countdownOverlay.classList.add('show');
    this.ui.countdownText.textContent = '3';
    this.ui.countdownText.classList.remove('go');
    audio.play('countdown_tick');

    // Pre-race beauty camera position
    this.camera.position.set(-4.2, 2.8, -13);
    this.camera.lookAt(0, 0.8, -8);
  }

  startRun() {
    this.state = 'RUNNING';
    this.ui.countdownOverlay.classList.remove('show');
    this.distance = 0;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.isFever = false;
    this.camShake = 0;
    this.turntableAngle = 0;
    this.player.mesh.rotation.set(0, 0, 0);
    if (this.player.chassis) this.player.chassis.rotation.set(0, 0, 0);

    // Calibrate Checkpoint Distance:
    // Sprint Mode: Exactly halfway through the 1,500m race (750m)!
    // Endless Mode: Quick to reach (380m, ~12-15s), repeats every 850m!
    if (this.gameMode === 'SPRINT') {
      this.sprintTargetDistance = 1500;
      this.checkpointDistance = 750;
      this.checkpointInterval = 2000;
    } else {
      this.checkpointDistance = 380;
      this.checkpointInterval = 850;
    }
    if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');

    audio.startMusic();
    audio.play('boost');
    this.toast('GREEN LIGHT! GO GO GO!', 'green');
    this.vibrate(100);
  }

  gameOver(isSprintFinish = false, isWinner = false) {
    this.state = 'GAMEOVER';
    if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');
    if (this.ui.overlayRedAlert) this.ui.overlayRedAlert.classList.add('hidden');
    if (this.ui.draftingContainer) this.ui.draftingContainer.classList.add('hidden');
    if (this.ui.apexFlowOverlay) this.ui.apexFlowOverlay.classList.add('hidden');
    if (this.ui.speedTrapFlash) this.ui.speedTrapFlash.classList.add('hidden');
    audio.stopPoliceSiren();
    audio.updateDraftingVortex(0);
    audio.stopEngine();
    audio.stopMusic();

    if (isSprintFinish) {
      audio.play('fever');
      this.vibrate([100, 100, 300]);
    } else {
      audio.play('collision');
      this.vibrate([100, 50, 200]);
    }

    if (this.ui.gameoverStatusEyebrow) {
      if (isSprintFinish) {
        this.ui.gameoverStatusEyebrow.textContent = isWinner ? '1ST PLACE FINISH — SPRINT CHAMPION' : `SPRINT FINISHED — ${this.racePosition}TH PLACE`;
        this.ui.gameoverStatusEyebrow.style.color = isWinner ? '#00ff88' : '#ffb800';
      } else {
        this.ui.gameoverStatusEyebrow.textContent = 'RUN TERMINATED';
        this.ui.gameoverStatusEyebrow.style.color = '#ff2a85';
      }
    }
    if (this.ui.gameoverStatusTitle) {
      this.ui.gameoverStatusTitle.textContent = isSprintFinish ? (isWinner ? 'VICTORY PODIUM' : 'RACE COMPLETE') : 'DRIVER RECORD';
    }

    progression.activeRunStats.distance = this.distance;
    progression.activeRunStats.score = this.score;
    progression.recordRunEnd();

    this.ui.runDist.textContent = `${Math.floor(this.distance)}m`;
    this.ui.runScore.textContent = this.score.toLocaleString();
    this.ui.runSpeed.textContent = `${Math.round(progression.activeRunStats.topSpeed)} KM/H`;
    this.ui.runNearMiss.textContent = progression.activeRunStats.nearMisses;
    this.ui.runCoinsAwarded.textContent = `+${progression.activeRunStats.coinsEarned} COINS`;

    if (this.ui.runDriftPts) this.ui.runDriftPts.textContent = progression.activeRunStats.driftPoints.toLocaleString();
    if (this.ui.runRampsJumped) this.ui.runRampsJumped.textContent = progression.activeRunStats.rampsJumped;
    if (this.ui.runDamageTaken) this.ui.runDamageTaken.textContent = `${Math.round(progression.activeRunStats.damageTaken)} HP`;

    const rank = progression.getRank(this.distance);
    this.ui.runRank.textContent = rank.title;
    this.ui.runRank.style.color = rank.color;

    this.ui.hud.classList.add('hidden');
    this.ui.gameoverModal.classList.remove('hidden');
  }

  togglePause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      audio.stopEngine();
      audio.stopMusic();
      this.ui.pauseModal.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      audio.startEngine();
      audio.startMusic();
      this.ui.pauseModal.classList.add('hidden');
    }
  }

  openSettings() {
    this.ui.settingsModal.classList.remove('hidden');
  }

  closeSettings() {
    this.ui.settingsModal.classList.add('hidden');
  }

  toast(text, theme = 'cyan') {
    const el = document.createElement('div');
    el.className = `floating-toast ${theme}`;
    el.textContent = text;
    this.ui.announcer.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  spawnScorePopup(text, color = '#00ff88') {
    // Suppressed center-screen score popups to keep road and car visibility 100% clean & unobstructed
    return;
  }

  triggerHapticChannel(channel, options = {}) {
    return this.haptics.trigger(channel, options, {
      hapticEnabled: progression.data.settings.hapticFeedbackEnabled !== false,
      gamepadRumbleEnabled: Boolean(progression.data.settings.gamepadRumbleEnabled)
    });
  }

  vibrate(pattern) {
    const dur = Array.isArray(pattern) ? pattern[0] : (pattern || 60);
    this.triggerHapticChannel('impact', {
      vibratePattern: pattern,
      weakMagnitude: 0.6,
      strongMagnitude: 0.8,
      durationMs: dur
    });
  }

  openGarage() {
    this.state = 'GARAGE';
    this.ui.hud.classList.add('hidden');
    this.ui.menuModal.classList.add('hidden');
    this.ui.gameoverModal.classList.add('hidden');
    this.ui.garageCoins.textContent = progression.data.coins.toLocaleString();

    // Show Turntable Platform & Frame 3D Car in the open left viewport
    if (this.turntableMesh) {
      this.turntableMesh.position.set(-1.4, 0, -8);
      this.turntableMesh.visible = true;
    }
    this.player.mesh.position.set(-1.4, 0.19, -8);
    this.player.x = -1.4;
    this.turntableAngle = 2.45;
    if (this.player.chassis) {
      this.player.chassis.position.set(0, 0, 0);
      this.player.chassis.rotation.set(0, 2.45, 0);
    }

    // Set Showroom Beauty View Camera framed for unobstructed car view
    this.camera.position.set(-1.4, 1.8, -3.2);
    this.camera.lookAt(-1.4, 0.75, -8);

    this.garageIndex = this.garageVehicleList.indexOf(progression.data.selectedVehicle);
    if (this.garageIndex < 0) this.garageIndex = 0;

    this.ui.garageTuningPanel?.classList.remove('minimized');
    if (this.ui.tabViewCarBtn) {
      this.ui.tabViewCarBtn.textContent = '👁 3D VIEW';
      this.ui.tabViewCarBtn.classList.remove('active');
    }

    this.ui.garageModal.classList.remove('hidden');
    this.renderGarageCarousel();
  }

  closeGarage() {
    this.ui.garageModal.classList.add('hidden');

    if (this.state === 'GARAGE') {
      this.state = 'MENU';
      if (this.turntableMesh) {
        this.turntableMesh.position.set(-0.5, 0, -8);
        this.turntableMesh.visible = true;
      }
      this.player.mesh.position.set(-0.5, 0.19, -8);
      this.player.x = -0.5;
      this.turntableAngle = 2.45;
      if (this.player.chassis) {
        this.player.chassis.position.set(0, 0, 0);
        this.player.chassis.rotation.set(0, 2.45, 0);
      }

      this.camera.position.set(-0.5, 1.85, -3.2);
      this.camera.lookAt(-0.5, 0.75, -8);
      this.ui.menuModal.classList.remove('hidden');
      this.menuVehicleIndex = this.garageVehicleList.indexOf(progression.data.selectedVehicle);
      if (this.menuVehicleIndex < 0) this.menuVehicleIndex = 0;
      this.updateMenuVehicleDisplay();
    } else {
      if (this.turntableMesh) this.turntableMesh.visible = false;
      this.player.mesh.position.set(0, 0, -8);
      this.player.mesh.rotation.set(0, 0, 0);
      this.player.x = 0;
    }
  }

  updateMenuHeader() {
    if (this.ui.menuCoins) this.ui.menuCoins.textContent = progression.data.coins.toLocaleString();
    if (this.ui.menuEquippedCar) {
      const curCar = VEHICLE_ROSTER[progression.data.selectedVehicle] || VEHICLE_ROSTER.apex;
      this.ui.menuEquippedCar.textContent = curCar.name.toUpperCase();
    }
  }

  updateMenuVehicleDisplay() {
    this.updateMenuHeader();
    const carId = this.garageVehicleList[this.menuVehicleIndex] || progression.data.selectedVehicle || 'apex';
    const car = VEHICLE_ROSTER[carId] || VEHICLE_ROSTER.apex;
    const isUnlocked = progression.data.unlockedVehicles.includes(carId);

    if (isUnlocked && progression.data.selectedVehicle !== carId) {
      progression.data.selectedVehicle = carId;
      progression.save();
    }

    this.player.setVehicle(
      carId,
      progression.data.upgrades[carId] || {},
      progression.data.selectedPaint,
      progression.data.selectedGlow
    );

    if (this.ui.menuEquippedCar) {
      this.ui.menuEquippedCar.textContent = car.name.toUpperCase();
    }
    if (this.ui.menuCarTierBadge) {
      this.ui.menuCarTierBadge.textContent = car.tier.toUpperCase();
    }
    if (this.ui.menuCarThumb) {
      this.ui.menuCarThumb.src = `./assets/previews/${carId}.png`;
      this.ui.menuCarThumb.alt = car.name;
    }

    const upg = progression.data.upgrades[carId] || { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 };
    const curSpeed = Math.round(car.baseStats.topSpeed * 9 + (upg.topSpeed || 0) * 15);
    const curAccel = Math.min(10, (car.baseStats.accel * 0.22 + (upg.accel || 0) * 0.4)).toFixed(1);
    const curHandling = (car.baseStats.handling * 0.24 + (upg.handling || 0) * 0.3);
    const curNitro = Math.round(car.baseStats.nitro + (upg.nitro || 0) * 12);
    const curArmor = Math.round(car.baseStats.armor + (upg.armor || 0) * 25);

    const speedPct = Math.min(100, Math.round((curSpeed / 390) * 100));
    const accelPct = Math.min(100, Math.round((curAccel / 10) * 100));
    const handlingPct = Math.min(100, Math.round((curHandling / 10) * 100));
    const nitroPct = Math.min(100, Math.round((curNitro / 120) * 100));
    const armorPct = Math.min(100, Math.round((curArmor / 280) * 100));

    if (this.ui.menuStatSpeed) this.ui.menuStatSpeed.style.width = `${speedPct}%`;
    if (this.ui.menuValSpeed) this.ui.menuValSpeed.textContent = `${curSpeed} KM/H`;

    if (this.ui.menuStatAccel) this.ui.menuStatAccel.style.width = `${accelPct}%`;
    if (this.ui.menuValAccel) this.ui.menuValAccel.textContent = `${(4.8 - (curAccel * 0.25)).toFixed(1)}s`;

    if (this.ui.menuStatHandling) this.ui.menuStatHandling.style.width = `${handlingPct}%`;
    if (this.ui.menuValHandling) this.ui.menuValHandling.textContent = curHandling > 8.0 ? 'PRECISION' : curHandling > 6.5 ? 'SPORT' : 'STANDARD';

    if (this.ui.menuStatNitro) this.ui.menuStatNitro.style.width = `${nitroPct}%`;
    if (this.ui.menuValNitro) this.ui.menuValNitro.textContent = `${curNitro} N2O`;

    if (this.ui.menuStatArmor) this.ui.menuStatArmor.style.width = `${armorPct}%`;
    if (this.ui.menuValArmor) this.ui.menuValArmor.textContent = `${curArmor} HP`;
  }

  renderGarageCarousel() {
    const carId = this.garageVehicleList[this.garageIndex] || 'apex';
    const car = VEHICLE_ROSTER[carId] || VEHICLE_ROSTER.apex;
    const isUnlocked = progression.data.unlockedVehicles.includes(carId);
    const isSelected = progression.data.selectedVehicle === carId;

    // Live 3D car preview on turntable
    this.player.setVehicle(
      carId,
      progression.data.upgrades[carId] || {},
      progression.data.selectedPaint,
      progression.data.selectedGlow
    );

    this.ui.garageCoins.textContent = progression.data.coins.toLocaleString();
    this.ui.garageCarTitle.textContent = car.name;
    this.ui.garageCarTier.textContent = car.tier;
    this.ui.garageCarDesc.textContent = car.desc;

    if (this.ui.garageCarPrice) {
      if (isSelected) {
        this.ui.garageCarPrice.textContent = 'CURRENTLY EQUIPPED';
        this.ui.garageCarPrice.style.color = '#ffb800';
        this.ui.garageCarPrice.style.borderColor = 'rgba(255, 184, 0, 0.5)';
        this.ui.garageCarPrice.style.background = 'rgba(255, 184, 0, 0.18)';
      } else if (isUnlocked) {
        this.ui.garageCarPrice.textContent = 'OWNED IN GARAGE';
        this.ui.garageCarPrice.style.color = '#00ff88';
        this.ui.garageCarPrice.style.borderColor = 'rgba(0, 255, 136, 0.5)';
        this.ui.garageCarPrice.style.background = 'rgba(0, 255, 136, 0.18)';
      } else {
        this.ui.garageCarPrice.textContent = `${car.cost.toLocaleString()} CREDITS`;
        this.ui.garageCarPrice.style.color = '#cbd5e1';
        this.ui.garageCarPrice.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.ui.garageCarPrice.style.background = 'rgba(255, 255, 255, 0.08)';
      }
    }

    // Render Supercar Showroom Forza-Style Visual Cards
    if (this.ui.garageCarChips) {
      this.ui.garageCarChips.innerHTML = this.garageVehicleList.map((cId, idx) => {
        const cData = VEHICLE_ROSTER[cId] || VEHICLE_ROSTER.apex;
        const isAct = idx === this.garageIndex;
        const isEq = progression.data.selectedVehicle === cId;
        const isOwn = progression.data.unlockedVehicles.includes(cId);

        let statusClass = 'locked';
        let statusText = `${cData.cost.toLocaleString()} CR`;
        if (isEq) {
          statusClass = 'equipped';
          statusText = 'EQUIPPED';
        } else if (isOwn) {
          statusClass = 'owned';
          statusText = 'OWNED';
        }

        const carUpg = progression.data.upgrades[cId] || {};
        const cardSpeed = Math.round(cData.baseStats.topSpeed * 9 + (carUpg.topSpeed || 0) * 15);

        return `
          <div class="garage-card ${isAct ? 'active' : ''}" data-index="${idx}">
            <div class="garage-card-top">
              <span class="garage-card-tier">${cData.tier}</span>
              <span class="garage-card-status ${statusClass}">${statusText}</span>
            </div>
            <div class="garage-card-img-zone">
              <img src="./assets/previews/${cId}.png" class="garage-card-thumb" alt="${cData.name}" loading="lazy" />
            </div>
            <div class="garage-card-bottom">
              <span class="garage-card-name" title="${cData.name}">${cData.name}</span>
              <span class="garage-card-spec">${cardSpeed} KM/H</span>
            </div>
          </div>
        `;
      }).join('');

      this.ui.garageCarChips.querySelectorAll('.garage-card').forEach(card => {
        card.addEventListener('click', () => {
          this.garageIndex = parseInt(card.dataset.index, 10);
          audio.play('gear_shift');
          this.renderGarageCarousel();
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
      });
    }

    // Visual Performance Upgrades (Stage 0 to 5)
    const upg = progression.data.upgrades[carId] || { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 };
    const statRows = [
      { key: 'topSpeed', icon: '🚀', label: 'TOP SPEED', base: car.baseStats.topSpeed, mult: 9, unit: 'KM/H', stepBonus: 15 },
      { key: 'accel', icon: '⚡', label: 'ACCELERATION', base: car.baseStats.accel, mult: 0.22, unit: '/ 10', stepBonus: 0.4 },
      { key: 'handling', icon: '🎯', label: 'HANDLING & DRIFT', base: car.baseStats.handling, mult: 0.24, unit: '/ 10', stepBonus: 0.3 },
      { key: 'nitro', icon: '💨', label: 'NITRO CAPACITY', base: car.baseStats.nitro, mult: 1, unit: '%', stepBonus: 12 },
      { key: 'armor', icon: '🛡️', label: 'HULL ARMOR', base: car.baseStats.armor, mult: 1, unit: 'HP', stepBonus: 25 }
    ];

    let statsHtml = '';
    statRows.forEach(s => {
      const lvl = upg[s.key] || 0;
      const upgradeCost = (lvl + 1) * 200;
      const canUpgrade = isUnlocked && lvl < 5 && progression.data.coins >= upgradeCost;

      // 5-Segmented Level Pips
      const pipsHtml = [1, 2, 3, 4, 5].map(i => `<div class="stat-pip ${lvl >= i ? 'filled' : ''}"></div>`).join('');

      // Calculated stats
      const currentVal = Math.round(s.base * s.mult + lvl * s.stepBonus);
      const nextVal = Math.round(s.base * s.mult + (lvl + 1) * s.stepBonus);

      const upgradeBtnHtml = lvl >= 5
        ? `<div class="stat-max-badge">&#9733; MAXED OUT (STAGE 5)</div>`
        : `<button class="upgrade-stat-btn ${canUpgrade ? 'affordable' : 'unaffordable'}" data-car="${carId}" data-stat="${s.key}" data-cost="${upgradeCost}" ${canUpgrade ? '' : 'disabled'}>
            + UPGRADE STAGE ${lvl + 1} &bull; ${upgradeCost.toLocaleString()} CREDITS
          </button>`;

      statsHtml += `
        <div class="upgrade-stat-card">
          <div class="stat-header-row">
            <div class="stat-name-group">
              <span>${s.icon}</span>
              <span>${s.label}</span>
            </div>
            <div class="stat-level-text">STAGE ${lvl} / 5</div>
          </div>
          <div class="stat-pips-row">
            ${pipsHtml}
          </div>
          <div class="stat-value-row">
            <span class="stat-curr-val">Current: ${currentVal} ${s.unit}</span>
            ${lvl < 5 ? `<span class="stat-next-boost">+${s.stepBonus} ${s.unit} NEXT</span>` : `<span class="stat-next-boost" style="color:#ffb800;">TOP SPEC</span>`}
          </div>
          ${upgradeBtnHtml}
        </div>
      `;
    });

    // Daily Quests
    let questsHtml = `
      <div style="margin-top:16px; padding:12px; background:rgba(0,0,0,0.35); border-radius:10px; border:1px solid rgba(0,217,255,0.2);">
        <div style="font-family:var(--font-mono); font-size:10px; font-weight:800; color:#ffb800; letter-spacing:1.5px; margin-bottom:8px;">DAILY RACING BOUNTIES</div>
    `;
    progression.data.dailyQuests.forEach(q => {
      const readyToClaim = !q.claimed && q.current >= q.target;
      questsHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-family:var(--font-mono); font-size:10px;">
          <span style="color:${q.claimed ? '#7f8c80' : '#e2e8f0'}">${q.desc} (${Math.min(q.target, q.current)}/${q.target})</span>
          ${q.claimed ? '<span style="color:#00ff88;">CLAIMED</span>' : `<button class="claim-quest-btn" data-quest="${q.id}" style="cursor:pointer; background:${readyToClaim ? 'linear-gradient(135deg, #ffb800, #ff8800)' : 'rgba(255,255,255,0.08)'}; border:0; border-radius:4px; color:#000; font-weight:800; font-size:9px; padding:3px 8px;" ${readyToClaim ? '' : 'disabled'}>+${q.reward} CR</button>`}
        </div>
      `;
    });
    questsHtml += `</div>`;

    this.ui.garageStatsList.innerHTML = statsHtml + questsHtml;

    // Equip / Unlock Button
    if (!isUnlocked) {
      this.ui.garageBuyBtn.textContent = `UNLOCK CAR (${car.cost.toLocaleString()} CREDITS)`;
      this.ui.garageBuyBtn.disabled = progression.data.coins < car.cost;
      this.ui.garageBuyBtn.onclick = () => {
        if (progression.unlockVehicle(carId, car.cost)) {
          audio.play('fever');
          this.toast(`${car.name} UNLOCKED!`, 'green');
          this.updateMenuHeader();
          this.renderGarageCarousel();
        }
      };
    } else if (!isSelected) {
      this.ui.garageBuyBtn.textContent = 'EQUIP THIS CAR';
      this.ui.garageBuyBtn.disabled = false;
      this.ui.garageBuyBtn.onclick = () => {
        progression.data.selectedVehicle = carId;
        progression.save();
        audio.play('boost');
        this.player.setVehicle(carId, progression.data.upgrades[carId] || {}, progression.data.selectedPaint, progression.data.selectedGlow);
        this.toast(`${car.name} EQUIPPED!`, 'cyan');
        this.updateMenuHeader();
        this.renderGarageCarousel();
      };
    } else {
      this.ui.garageBuyBtn.textContent = 'CURRENTLY EQUIPPED';
      this.ui.garageBuyBtn.disabled = true;
    }

    // Attach upgrade buttons
    this.ui.garageStatsList.querySelectorAll('.upgrade-stat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = btn.dataset.car;
        const stat = btn.dataset.stat;
        const cost = parseInt(btn.dataset.cost, 10);
        if (progression.upgradeStat(cId, stat, cost)) {
          audio.play('coin');
          this.toast(`${stat.toUpperCase()} UPGRADED!`, 'green');
          this.player.setVehicle(progression.data.selectedVehicle, progression.data.upgrades[progression.data.selectedVehicle] || {}, progression.data.selectedPaint, progression.data.selectedGlow);
          this.renderGarageCarousel();
        }
      });
    });

    // Attach quest claims
    this.ui.garageStatsList.querySelectorAll('.claim-quest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.quest;
        const reward = progression.claimQuest(qId);
        if (reward > 0) {
          audio.play('fever');
          this.toast(`CLAIMED +${reward} CREDITS!`, 'gold');
          this.renderGarageCarousel();
        }
      });
    });
  }

  renderAchievementsList() {
    let html = '';
    ACHIEVEMENTS.forEach(ach => {
      const isUnlocked = (progression.data.unlockedAchievements || []).includes(ach.id);
      html += `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
          <div class="achievement-icon">${ach.icon}</div>
          <div class="achievement-info">
            <div class="achievement-title">${ach.title} ${isUnlocked ? '[UNLOCKED]' : ''}</div>
            <div class="achievement-desc">${ach.desc}</div>
            <div class="achievement-reward">+${ach.reward} CR ${isUnlocked ? '(COMPLETED)' : ''}</div>
          </div>
        </div>
      `;
    });
    this.ui.achievementsContainer.innerHTML = html;
  }

  // --- GAMEPAD POLLING ---
  pollGamepad() {
    if (!navigator.getGamepads) {
      this._lastGamepadState = normalizeGamepadState(null, this.gamepadPrevButtons);
      return this._lastGamepadState;
    }
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp || !gp.connected) continue;
      const state = normalizeGamepadState(gp, this.gamepadPrevButtons);
      this.gamepadPrevButtons = state.nextPrevButtons;
      this.ui.hudGamepadBadge?.classList.remove('hidden');
      if (state.pausePressed) {
        this.togglePause();
      }
      this._lastGamepadState = state;
      return state;
    }
    this.ui.hudGamepadBadge?.classList.add('hidden');
    this._lastGamepadState = normalizeGamepadState(null, this.gamepadPrevButtons);
    return this._lastGamepadState;
  }

  update(dt) {
    // 1. Countdown Animation State
    if (this.state === 'COUNTDOWN') {
      this.countdownTimer += dt;
      // Camera sweeps from side to rear chase cam
      const progress = Math.min(1, this.countdownTimer / 3.0);
      this.camera.position.lerpVectors(this.introCamPos, this.defaultCamPos, progress);
      this.camera.lookAt(0, 1.0, -8);

      if (this.countdownTimer >= 1.0 && this.countdownStep === 3) {
        this.countdownStep = 2;
        this.ui.countdownText.textContent = '2';
        audio.play('countdown_tick');
      } else if (this.countdownTimer >= 2.0 && this.countdownStep === 2) {
        this.countdownStep = 1;
        this.ui.countdownText.textContent = '1';
        audio.play('countdown_tick');
      } else if (this.countdownTimer >= 3.0 && this.countdownStep === 1) {
        this.countdownStep = 0;
        this.ui.countdownText.textContent = 'GO!';
        this.ui.countdownText.classList.add('go');
        audio.play('countdown_go');
        setTimeout(() => this.startRun(), 350);
      }
      return;
    }

    // 3D Spatial Menu Turntable Showcase & Dynamic Atmosphere (Screen only moves when user clicks & drags)
    if (this.state === 'MENU') {
      if (this.player.chassis) {
        this.player.chassis.position.set(0, 0, 0);
        this.player.chassis.rotation.y = this.turntableAngle;
      }
      if (this.turntableMesh) {
        this.turntableMesh.rotation.y = this.turntableAngle;
      }
      // Rock-solid home screen camera (no screen drifting from mouse hover; only moves on click-and-drag)
      this.camera.position.set(-0.5, 1.85, -3.2);
      this.camera.lookAt(-0.5, 0.75, -8);

      // Animate live background 3D world (stars rotation, weather particles, ambient lights)
      this.world.update(dt, 0);
      return;
    }

    // Garage Showcase (Rotates 360 only when user clicks and drags)
    if (this.state === 'GARAGE') {
      if (this.player.chassis) {
        this.player.chassis.position.set(0, 0, 0);
        this.player.chassis.rotation.y = this.turntableAngle;
      }
      if (this.turntableMesh) {
        this.turntableMesh.rotation.y = this.turntableAngle;
      }
      this.camera.position.set(-1.4, 1.8, -3.2);
      this.camera.lookAt(-1.4, 0.75, -8);
      return;
    }

    if (this.state !== 'RUNNING') return;

    // Tactical EMP Cooldown & Triggers
    if (this.empCooldown > 0) this.empCooldown -= dt;
    if (this.keys.has('KeyE') || this.keys.has('e') || this.keys.has('E') || this.keys.has('KeyF')) {
      this.triggerKineticEmp();
    }

    // Apex Flow (Bullet-Time Near-Miss Time Dilation)
    if (this.apexFlowTimer > 0) {
      this.apexFlowTimer -= dt;
      dt *= 0.45; // 55% slow motion!
      if (this.apexFlowTimer <= 0 && this.ui.apexFlowOverlay) {
        this.ui.apexFlowOverlay.classList.add('hidden');
      }
    }

    // Near-Miss Chain Combos Decay
    if (this.nearMissChainTimer > 0) {
      this.nearMissChainTimer -= dt;
      if (this.nearMissChainTimer <= 0) {
        this.nearMissChain = 0;
      }
    }

    // 2. Poll Inputs (Keyboard, Virtual Joystick, Gamepad, Mouse)
    const gp = this.pollGamepad();
    if (gp.empPressed) {
      this.triggerKineticEmp();
    }

    let steerDir = gp.steer + (this.touchTracker.joystick.active ? this.touchTracker.joystick.steer : 0);

    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) steerDir -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) steerDir += 1;
    steerDir = Math.max(-1, Math.min(1, steerDir));

    // Mouse Steer Option
    if (progression.data.settings.mouseSteerEnabled && Math.abs(steerDir) === 0) {
      const dx = this.mouseTargetX - this.player.x;
      if (Math.abs(dx) > 0.2) steerDir = Math.sign(dx) * Math.min(1, Math.abs(dx) * 0.8);
    }

    const isBoosting = this.keys.has(' ') || this.keys.has('Shift') || gp.boost;
    const isDigitalBrake = this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S') || gp.drift;
    const brakeIntensity = isDigitalBrake ? 1.0 : gp.brakeIntensity;
    const isBrakingKey = brakeIntensity > 0.05;
    const isDrifting = (isBrakingKey && Math.abs(steerDir) > 0.08) || (gp.drift && Math.abs(steerDir) > 0.08);
    const isBraking = isBrakingKey && !isDrifting;
    const throttleVal = gp.hasAnalogThrottle ? gp.throttle : 1.0;

    // Drift initiation haptic pulse
    if (isDrifting && !this._wasDrifting) {
      this.triggerHapticChannel('drift_start', {
        vibratePattern: 20,
        weakMagnitude: 0.45,
        strongMagnitude: 0.2,
        durationMs: 45,
        cooldownMs: 220
      });
    }
    this._wasDrifting = isDrifting;

    const sens = progression.data.settings.steeringSensitivity || 1.0;
    const counterAssist = progression.data.settings.counterSteerAssist ?? 1.0;
    this.player.setThrottle(throttleVal);
    this.player.setBraking(isBrakingKey, brakeIntensity);
    this.player.setBoost(isBoosting);
    this.player.setDrift(isDrifting);
    this.player.steer(steerDir, dt, sens, counterAssist);

    // Outer Highway Armco / Concrete Guardrails with Physical Elastic Deflection & Throttled Curb Haptics
    const railBoundary = 7.95;
    const maxClamp = 8.25;
    if (Math.abs(this.player.x) >= railBoundary) {
      const side = Math.sign(this.player.x); // -1 left, +1 right
      const penetration = Math.abs(this.player.x) - railBoundary;
      this.player.x = side * Math.min(maxClamp, Math.abs(this.player.x));
      const bounceVelocity = -side * (3.2 + penetration * 7.5);
      this.player.vx = side < 0
        ? Math.max(this.player.vx || 0, bounceVelocity)
        : Math.min(this.player.vx || 0, bounceVelocity);
      const deflect = -side * 0.16;
      this.player.steerAngle = side < 0
        ? Math.min(0.25, Math.max(0.08, this.player.steerAngle + deflect))
        : Math.max(-0.25, Math.min(-0.08, this.player.steerAngle + deflect));
      const scrapeFriction = Math.max(0.82, 1.0 - dt * (2.2 + penetration * 3.5));
      this.player.speed = Math.max(4.0, this.player.speed * scrapeFriction);
      this.camShake = Math.max(this.camShake, 0.15 + penetration * 0.2);
      this.triggerHapticChannel('curb_scuff', {
        vibratePattern: 28,
        weakMagnitude: Math.min(1, 0.4 + penetration * 0.6),
        strongMagnitude: Math.min(1, 0.35 + penetration * 0.5),
        durationMs: 55,
        cooldownMs: 110
      });
      if (this.traffic.spawnSparks && Math.random() < 0.75) {
        this.traffic.spawnSparks(this.scratchVec.set(side * railBoundary, 0.42, this.player.mesh.position.z), 5, 0xffd900);
      }
    }
    this.player.update(dt, () => {
      // Landing callback from stunt jump
      audio.play('ramp_land');
      this.camShake = 0.55;
      this.vibrate(80);
      this.score += 350 * this.multiplier;
      progression.activeRunStats.rampsJumped++;
      this.spawnScorePopup('+350 STUNT AIRTIME', '#ffea00');
    });

    // DCT Upshift / Downshift Mechanical Haptic Detent
    if (this.player.lastShiftType) {
      const isUpshift = this.player.lastShiftType === 'up';
      this.triggerHapticChannel('gear_shift', {
        vibratePattern: isUpshift ? 14 : 18,
        weakMagnitude: isUpshift ? 0.3 : 0.4,
        strongMagnitude: isUpshift ? 0.55 : 0.25,
        durationMs: 35,
        cooldownMs: 90
      });
      this.player.lastShiftType = null;
    }

    if (isDrifting) {
      this.score += Math.floor(dt * 90);
      progression.activeRunStats.driftPoints += Math.floor(dt * 90);
      this.player.addNitro(dt * 12);
      if (Math.random() < 0.08) {
        this.spawnScorePopup('+50 DRIFT', '#9d4edd');
      }
    }

    // 3. Supercar Ground Speed & Km/h (Calibrated with Showroom & Gearing Specs: 1 physical unit = 9.0 km/h)
    const currentSpeed = this.player.speed;
    const kmh = currentSpeed * 9;
    if (kmh > progression.activeRunStats.topSpeed) {
      progression.activeRunStats.topSpeed = kmh;
    }

    this.distance += currentSpeed * dt;
    this.score += Math.floor(currentSpeed * dt * 1.5 * this.multiplier);

    // Update Wandering Pedestrians on Sidewalks (Natural Walking Cadence & Reactive AI)
    if (this.pedestrianManager) {
      this.pedestrianManager.update(dt, currentSpeed, this.player.x, this.player.mesh.position.z);
    }

    // Update NPC Traffic Loop Cars
    if (this.npcCars) {
      for (const npc of this.npcCars) {
        npc.update(dt, currentSpeed);
      }
    }

    // Pure Racing Speed Checkpoint Milestone & Nitro Surge
    if (this.distance >= this.checkpointDistance) {
      this.checkpointDistance += this.checkpointInterval;

      // Award massive speed checkpoint bonus
      const checkpointBonus = 1500 * this.multiplier;
      this.score += checkpointBonus;
      progression.activeRunStats.coinsEarned += 50;

      // Fully restore nitro tank & trigger hypersonic boost surge
      this.player.nitro = this.player.maxNitro;
      this.player.triggerSpeedBoost(1.65, 3.2);

      // Audio & Screen FX
      audio.play('boost');
      audio.play('fever');
      if (this.ui.overlayWarp) this.ui.overlayWarp.style.opacity = '0.85';
      this.camShake = 0.45;
      this.vibrate([100, 50, 150]);

      this.spawnScorePopup(`+${checkpointBonus.toLocaleString()} SPEED CHECKPOINT`, '#00ff88');
      this.toast('SPEED CHECKPOINT CLEARED — HYPERSONIC NITRO SURGE!', 'green');

      if (this.ui.checkpointBanner) {
        this.ui.checkpointBanner.classList.remove('hidden');
        setTimeout(() => {
          if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');
        }, 2200);
      }
    }

    // Multiplier Timer
    if (this.multiplierTimer > 0) {
      this.multiplierTimer -= dt;
      if (this.multiplierTimer <= 0 && this.multiplier > 1) {
        this.multiplier = 1;
        this.isFever = false;
        this.ui.multiplier.classList.remove('fever');
      }
    }

    // 4. Audio Engine Update (6-Speed Dual-Clutch Model)
    audio.updateEngine(kmh, this.player.isBoosting, isDrifting, isBrakingKey);

    // 5. World Scrolling & Jump Ramps / Speed Panels Detection
    this.world.update(dt, currentSpeed, this.distance, {
      player: this.player,
      playerX: this.player ? this.player.x : 0,
      playerZ: this.player && this.player.mesh ? this.player.mesh.position.z : -8,
      speedKmh: kmh,
      onChallengeDefeated: () => {
        this.toast('RIVAL CHALLENGE OVERTAKEN! +1,000 CREDITS', 'gold');
        audio.play('fever');
        this.vibrate([100, 50, 200]);
        progression.activeRunStats.coinsEarned += 1000;
        progression.unlockAchievement('rival_vanquisher');
        this.spawnScorePopup('+1,000 RIVAL CONQUERED', '#ffb800');
      }
    });

    // 5.1 Headlight Projectors & Lead Traffic Illumination
    if (this.player && this.player.updateHeadlights) {
      this.player.updateHeadlights(
        dt,
        Boolean(this.world && this.world.headlightsRequired),
        Boolean(this.world && this.world.isInsideTunnel),
        this.traffic ? this.traffic.cars : []
      );
    }

    // 5.2 Dynamic Selective Bloom Modulation (Hypersonic boost flare & tunnel glow)
    if (this.bloomPass && this.bloomEnabled) {
      let targetBloom = 0.46;
      if (this.player && this.player.isBoosting) {
        targetBloom = 0.88;
      } else if (this.world && this.world.isInsideTunnel) {
        targetBloom = 0.65;
      } else if (this.world && this.world.currentLightingPhase === 'night') {
        targetBloom = 0.58;
      }
      this.bloomPass.strength += (targetBloom - this.bloomPass.strength) * Math.min(1, dt * 6.0);
    }

    // 100% Solid Stunt Jump Ramps Physics (Incline deck ride, solid rails, smooth launch)
    for (const ramp of this.world.jumpRamps) {
      const rampWorldZ = ramp.parent.position.z + ramp.mesh.position.z;
      const relZ = this.player.mesh.position.z - rampWorldZ;
      const relX = this.player.x - ramp.lane;
      const absX = Math.abs(relX);

      // Footprint: length is 4.8 (-2.4 to +2.4 relative to rampWorldZ), width is 2.8 (-1.4 to +1.4)
      if (relZ >= -2.4 && relZ <= 2.4) {
        if (absX < 1.45) {
          // DRIVING ON THE RAMP DECK: Solid physical incline elevation & smooth incline pitch
          const progress = Math.max(0, Math.min(1, (2.4 - relZ) / 4.8)); // 0 at entrance, 1 at takeoff lip
          const deckY = 0.03 + progress * 1.32;
          this.player.setRampElevation(deckY, -0.24);

          // Launch takeoff when reaching lip (-1.8 to -2.4)
          if (relZ <= -1.8 && !ramp.triggered) {
            ramp.triggered = true;
            this.player.triggerJump(18, deckY);
            audio.play('ramp_launch');
            this.toast('STUNT AIRTIME LAUNCH', 'gold');
            this.score += 500 * this.multiplier;
            progression.activeRunStats.rampsJumped++;
            this.spawnScorePopup('+500 STUNT JUMP', '#ffea00');
            this.vibrate([60, 40, 80]);
            this.camShake = 0.25;
          }
        } else if (absX >= 1.45 && absX <= 2.15 && !this.player.isAirborne) {
          // SOLID GUARDRAIL: Smooth deflection without stopping or damaging the car
          const side = Math.sign(relX) || 1;
          this.player.x = ramp.lane + side * 2.15;
          this.player.mesh.position.x = this.player.x;
          this.player.vx = side * 2.0;
          this.camShake = 0.15;
          audio.play('collision');
          this.traffic.spawnExplosion(this.scratchVec.set(this.player.x, 0.4, this.player.mesh.position.z), 0xffaa00, 8);
          this.toast('RAMP GUARDRAIL SCRAPE', 'magenta');
        }
      }
    }

    // Check Speed Booster Panels Collision (Highway Rocket Surge)
    for (const panel of this.world.speedPanels) {
      const panelWorldZ = panel.parent.position.z + panel.mesh.position.z;
      const dz = Math.abs(panelWorldZ - this.player.mesh.position.z);
      const dx = Math.abs(panel.lane - this.player.x);
      if (dz < 2.4 && dx < 1.4 && !panel.triggered) {
        panel.triggered = true;
        this.player.triggerSpeedBoost(1.65, 2.2);
        audio.play('boost_pad');
        this.score += 300 * this.multiplier;
        this.ui.overlayWarp.style.opacity = '0.85';
        this.spawnScorePopup('+300 HYPERSONIC BOOST', '#00f0ff');
        this.toast('HYPERSONIC BOOST ACTIVATED', 'cyan');
        this.vibrate(100);
      }
    }

    // Aerodynamic Slipstream Drafting & Slingshot Catapult
    let hasDraftTarget = false;
    for (const v of this.traffic.vehicles) {
      if (!v.hit && Math.abs(v.mesh.position.x - this.player.x) < 2.2) {
        const distAhead = this.player.mesh.position.z - v.mesh.position.z;
        if (distAhead > 2.0 && distAhead < 32.0) {
          hasDraftTarget = true;
          break;
        }
      }
    }

    if (hasDraftTarget && kmh > 75) {
      this.isDrafting = true;
      this.draftCharge = Math.min(1.0, this.draftCharge + dt * 1.05);
      this.player.addNitro(dt * 28);
      this.score += Math.floor(dt * 200);

      if (this.ui.draftingContainer) {
        this.ui.draftingContainer.classList.remove('hidden');
        const pct = Math.round(this.draftCharge * 100);
        if (this.ui.draftingPct) this.ui.draftingPct.textContent = `${pct}%`;
        if (this.ui.draftingFill) this.ui.draftingFill.style.width = `${pct}%`;
        if (this.ui.draftingHint) {
          this.ui.draftingHint.textContent = this.draftCharge >= 1.0 ? '⚡ SLINGSHOT READY! LAUNCHING...' : 'CHARGING SLINGSHOT CATAPULT...';
          this.ui.draftingHint.style.color = this.draftCharge >= 1.0 ? '#00ffcc' : '#a7f3d0';
        }
      }
      audio.updateDraftingVortex(this.draftCharge);

      // Slingshot Catapult Launch Trigger!
      if (this.draftCharge >= 1.0) {
        this.draftCharge = 0;
        this.player.triggerSpeedBoost(1.52, 2.8);
        this.player.nitro = Math.min(this.player.maxNitro, this.player.nitro + 40);
        audio.play('slingshot');
        this.vibrate([60, 40, 120]);
        this.camShake = 0.35;
        this.score += 500 * this.multiplier;
        this.spawnScorePopup('+500 SLIPSTREAM SLINGSHOT', '#00ffcc');
        this.toast('SLIPSTREAM SLINGSHOT CATAPULT FIRED!', 'cyan');
      }
    } else {
      this.draftCharge = Math.max(0, this.draftCharge - dt * 2.2);
      if (this.draftCharge <= 0 && this.ui.draftingContainer) {
        this.ui.draftingContainer.classList.add('hidden');
      }
      audio.updateDraftingVortex(this.draftCharge);
    }

    // Radar Speed Trap Checks
    if (this.distance >= this.nextSpeedTrapDistance) {
      this.nextSpeedTrapDistance += 800;
      if (kmh >= 240) {
        if (this.ui.speedTrapFlash) {
          this.ui.speedTrapFlash.classList.remove('hidden');
          this.ui.speedTrapFlash.classList.add('flash-active');
          setTimeout(() => this.ui.speedTrapFlash?.classList.remove('flash-active'), 120);
          setTimeout(() => this.ui.speedTrapFlash?.classList.add('hidden'), 220);
        }
        audio.play('speed_trap');
        this.toast(`📸 RADAR SPEED TRAP: ${Math.round(kmh)} KM/H! +350 PTS`, 'gold');
        this.score += 350 * this.multiplier;
        this.increaseHeat(1);
      }
    }

    // 5. Police Pursuit & Continuous Evasion Tracking
    const activePoliceList = this.traffic.vehicles.filter(v => v.isPolice && !v.hit && !v.evaded);
    let closestPoliceDist = 999;
    activePoliceList.forEach(pv => {
      const dist = Math.hypot(pv.mesh.position.x - this.player.x, pv.mesh.position.z - this.player.mesh.position.z);
      if (dist < closestPoliceDist) closestPoliceDist = dist;
    });
    this.minPoliceDist = closestPoliceDist;

    // Visual sight acquisition: engage pursuit when within 38m proximity
    if (!this.policeActive && activePoliceList.length > 0 && closestPoliceDist <= 38) {
      this.policeActive = true;
      audio.startPoliceSiren();
      const hasInterceptor = activePoliceList.some(v => v.isInterceptor);
      this.toast(hasInterceptor ? '🚨 TACTICAL INTERCEPTOR IN PURSUIT!' : '🚨 HIGHWAY PATROL CRUISER IN PURSUIT!', 'magenta');
    }

    if (this.policeActive) {
      const evasion = updateEvasionTracking({
        policeActive: this.policeActive,
        minPoliceDist: closestPoliceDist,
        evasionTimer: this.evasionTimer,
        dt,
        evasionThreshold: 35.0,
        requiredTime: 6.0
      });

      this.evasionTimer = evasion.evasionTimer;

      if (this.ui.evasionBar) {
        if (this.evasionTimer > 0) {
          this.ui.evasionBar.classList.remove('hidden');
          if (this.ui.evasionFill) this.ui.evasionFill.style.width = `${(evasion.progress * 100).toFixed(1)}%`;
          if (this.ui.evasionText) this.ui.evasionText.textContent = `EVADING ${(6.0 - this.evasionTimer).toFixed(1)}s`;
        } else {
          this.ui.evasionBar.classList.add('hidden');
        }
      }

      if (evasion.evaded) {
        this.policeActive = false;
        this.pursuitEvasions = (this.pursuitEvasions || 0) + 1;
        activePoliceList.forEach(pv => {
          pv.evaded = true;
          pv.speed = Math.max(14, pv.speed * 0.7);
        });
        audio.stopPoliceSiren();
        this.toast('🚓 PURSUIT EVADED! +750 BOUNTY CREDITS (HEAT -1)', 'gold');
        progression.activeRunStats.coinsEarned += evasion.bonusCredits;
        progression.data.coins += evasion.bonusCredits;
        progression.save();
        this.increaseHeat(-evasion.heatReduction);
        audio.play('fever');
        this.vibrate([80, 50, 120]);
        this.spawnScorePopup('+750 PURSUIT EVADED!', '#ffea00');
        if (this.ui.evasionBar) this.ui.evasionBar.classList.add('hidden');
      }
    } else if (this.ui.evasionBar && !this.ui.evasionBar.classList.contains('hidden')) {
      this.ui.evasionBar.classList.add('hidden');
    }

    // 6. Traffic & Obstacles System
    this.traffic.update(dt, currentSpeed, this.player.x, this.player.mesh.position.z, this.distance, {
      isMagnetActive: this.player.magnetActive,
      jumpRamps: this.world.jumpRamps,
      heatLevel: this.heatLevel,
      onPitManeuver: (v, pit) => {
        const pitDir = pit.pitDir || 1;
        this.player.x = THREE.MathUtils.clamp(this.player.x + pitDir * 0.45, -8.2, 8.2);
        this.player.mesh.position.x = this.player.x;
        this.player.driftAngle = (this.player.driftAngle || 0) + pitDir * 0.22;
        const dmg = this.player.takeDamage(6);
        progression.activeRunStats.damageTaken += dmg;
        this.camShake = Math.max(this.camShake, 0.42);
        audio.play('collision');
        this.vibrate([50, 40, 90]);
        if (this.traffic.spawnSparks) {
          this.traffic.spawnSparks(this.scratchVec.set(this.player.x, 0.4, this.player.mesh.position.z), 14, 0xff0044);
        }
        this.toast('🚨 INTERCEPTOR PIT MANEUVER IMPACT!', 'magenta');
        this.showDamageOverlay();
        if (this.player.hull <= 0) {
          this.gameOver(false, false);
        }
      },
      onNearMiss: (v) => {
        progression.activeRunStats.nearMisses++;
        this.score += 250 * this.multiplier;
        this.player.addNitro(18);
        audio.play('nearmiss');
        this.vibrate(40);
        this.spawnScorePopup(`+${250 * this.multiplier} NEAR MISS!`, '#00d9ff');

        this.nearMissChain++;
        this.nearMissChainTimer = 4.0;
        this.increaseHeat(0.25);

        // Apex Flow (Bullet-Time Near-Miss Chain of 2+)
        if (this.nearMissChain >= 2 && this.apexFlowTimer <= 0) {
          this.apexFlowTimer = 3.0;
          if (this.ui.apexFlowOverlay) this.ui.apexFlowOverlay.classList.remove('hidden');
          audio.play('bullet_time');
          this.toast('APEX FLOW: BULLET-TIME REFLEXES ACTIVATED!', 'magenta');
        }

        this.multiplier = Math.min(5, this.multiplier + 1);
        this.multiplierTimer = 4.0;
        if (this.multiplier >= 4) {
          this.isFever = true;
          this.ui.multiplier.classList.add('fever');
          audio.play('fever');
          this.toast(`FEVER MULTIPLIER x${this.multiplier}`, 'magenta');
        } else {
          this.toast(`NEAR MISS x${this.multiplier}`, 'cyan');
        }
      },
      onDrafting: (delta, v) => {}
    });

    // 8. Continuous Solid Collisions: Traffic, Trucks, NPCs, Pedestrians, Obstacles
    // (Solid Physical Bounding Impasses — Objects are 100% Solid and Impenetrable)

    // A. Traffic Cars, SUVs, and Heavy Commercial Trucks with Continuous Swept AABB CCD & Dynamic Momentum Damage
    for (const v of this.traffic.vehicles) {
      const vLength = v.length || (v.isTruck ? 8.5 : (v.isTanker ? 11.0 : 4.5));
      const vWidth = v.width || (v.isTruck || v.isTanker ? 2.8 : 2.2);
      const vHeight = v.height || (v.isTruck || v.isTanker ? 3.8 : 1.5);
      const playerHalfW = 1.05;
      const playerHalfL = 2.2;
      const playerHalfH = 0.7;

      const halfW = vWidth * 0.5 + playerHalfW;
      const halfL = vLength * 0.5 + playerHalfL;
      const halfH = vHeight * 0.5 + playerHalfH;

      const dx = this.player.x - v.mesh.position.x;
      const dz = this.player.mesh.position.z - v.mesh.position.z;
      const dy = this.player.mesh.position.y - (v.mesh.position.y || 0);

      const absX = Math.abs(dx);
      const absZ = Math.abs(dz);
      const absY = Math.abs(dy);

      const isInstantOverlap = (absX < halfW && absZ < halfL && absY < halfH);

      // Swept AABB Continuous Collision Detection (CCD) to prevent supersonic tunneling
      let isSweptIntersect = false;
      const prevPlayerX = this.player.prevX ?? this.player.x;
      const prevPlayerZ = this.player.prevZ ?? this.player.mesh.position.z;
      const prevTargetX = v.prevX ?? v.mesh.position.x;
      const prevTargetZ = v.prevZ ?? (v.mesh.position.z - (currentSpeed - v.speed) * dt);

      const relDispX = (this.player.x - prevPlayerX) - (v.mesh.position.x - prevTargetX);
      const relDispZ = (this.player.mesh.position.z - prevPlayerZ) - (v.mesh.position.z - prevTargetZ);

      if (!isInstantOverlap && absY < halfH) {
        const startRelX = prevPlayerX - prevTargetX;
        const startRelZ = prevPlayerZ - prevTargetZ;

        let tminX = -Infinity, tmaxX = Infinity;
        if (Math.abs(relDispX) > 0.0001) {
          const tx1 = (-halfW - startRelX) / relDispX;
          const tx2 = (halfW - startRelX) / relDispX;
          tminX = Math.min(tx1, tx2);
          tmaxX = Math.max(tx1, tx2);
        } else if (Math.abs(startRelX) >= halfW) {
          tminX = Infinity;
        }

        let tminZ = -Infinity, tmaxZ = Infinity;
        if (Math.abs(relDispZ) > 0.0001) {
          const tz1 = (-halfL - startRelZ) / relDispZ;
          const tz2 = (halfL - startRelZ) / relDispZ;
          tminZ = Math.min(tz1, tz2);
          tmaxZ = Math.max(tz1, tz2);
        } else if (Math.abs(startRelZ) >= halfL) {
          tminZ = Infinity;
        }

        const tEnter = Math.max(tminX, tminZ);
        const tExit = Math.min(tmaxX, tmaxZ);
        if (tEnter <= tExit && tExit >= 0 && tEnter <= 1.0) {
          isSweptIntersect = true;
        }
      }

      if (isInstantOverlap || isSweptIntersect) {
        // OVERLAPPING OR TRAJECTORY INTERCEPT! SOLID COLLISION ENFORCEMENT
        const isOverdrive = this.player.isBoosting && this.multiplier >= 4;

        if (isOverdrive) {
          // Overdrive Ramming blasts vehicle away
          if (!v.hit) {
            v.hit = true;
            this.traffic.spawnExplosion(v.mesh.position, 0xffaa00, 24);
            audio.play('collision');
            this.vibrate(80);
            v.mesh.position.y += 6;
            v.mesh.rotation.x += 3;
            v.speed = -15; // launches away
            this.score += 1000;
            this.camShake = 0.45;
            this.toast('RAMMING OVERDRIVE!', 'gold');
            this.spawnScorePopup('+1,000 RAM', '#ffb800');
          }
        } else {
          // PURE SOLID IMPASSE: YOU CANNOT PASS THROUGH!
          const bounceDir = dx >= 0 ? 1 : -1;
          const relSpeedUnits = Math.abs(currentSpeed - v.speed);

          const isRearEnd = (dz > 0 || isSweptIntersect) && absX < (vWidth * 0.5 + 0.65);
          if (isRearEnd) {
            // Rear-end Collision into vehicle ahead:
            // 1. Physically clamp relative motion: player cannot travel through target Z
            this.player.speed = Math.min(this.player.speed * 0.45, v.speed * 0.85);
            this.player.targetSpeed = Math.min(this.player.targetSpeed, v.speed);
            // 2. Separate in Z so vehicle stays strictly ahead of player bumper
            v.mesh.position.z = Math.min(v.mesh.position.z, this.player.mesh.position.z - (halfL + 0.15));
            // 3. Shunt the vehicle forward with transferred momentum
            v.speed = Math.max(v.speed + relSpeedUnits * 0.65 + 3.0, currentSpeed * 0.85);
            this.player.suspensionPitch = 0.22;
          } else {
            // Lateral / Side-Swipe Collision:
            // 1. Push player completely outside the vehicle's bounding box
            this.player.x = THREE.MathUtils.clamp(v.mesh.position.x + bounceDir * (halfW + 0.22), -8.2, 8.2);
            this.player.mesh.position.x = this.player.x;
            // 2. Lateral speed deflection & friction sparks
            this.player.vx = bounceDir * (3.8 + relSpeedUnits * 0.15);
            this.player.steerAngle += bounceDir * 0.22;
            v.mesh.position.x = THREE.MathUtils.clamp(v.mesh.position.x - bounceDir * 0.45, -7.5, 7.5);
            this.player.speed = Math.max(0, this.player.speed * 0.82);
            if (this.traffic.spawnSparks) {
              this.traffic.spawnSparks(this.scratchVec.set(this.player.x + bounceDir * 0.85, 0.45, this.player.mesh.position.z), 12, 0xffd900);
            }
          }

          // Dynamic Velocity-Scaled Impact Damage
          if (!v.isColliding) {
            v.isColliding = true;
            const relKmh = relSpeedUnits * 9.0;
            const massFactor = v.isTanker ? 1.6 : (v.isTruck ? 1.4 : (v.isPolice ? 1.15 : 1.0));

            let baseDamage = 6;
            let severityTag = 'LIGHT BUMPER SCRAPE';
            let toastColor = 'gold';
            let shakeIntensity = 0.35;

            if (relKmh < 35) {
              baseDamage = 4 + (relKmh / 35) * 4; // 4% to 8% damage
              severityTag = 'GLANCING BUMPER SCRAPE';
              toastColor = 'gold';
              shakeIntensity = 0.28;
            } else if (relKmh < 110) {
              baseDamage = 8 + ((relKmh - 35) / 75) * 11; // 8% to 19% damage
              severityTag = 'MODERATE HIGHWAY IMPACT';
              toastColor = 'cyan';
              shakeIntensity = 0.52;
            } else if (relKmh < 200) {
              baseDamage = 19 + ((relKmh - 110) / 90) * 14; // 19% to 33% damage
              severityTag = 'HIGH-SPEED CRASH';
              toastColor = 'magenta';
              shakeIntensity = 0.76;
            } else {
              baseDamage = 33 + Math.min(27, ((relKmh - 200) / 100) * 22); // 33% to 55% damage
              severityTag = 'SUPERSONIC IMPACT';
              toastColor = 'magenta';
              shakeIntensity = 0.98;
            }

            const rawDamage = Math.round(baseDamage * massFactor);
            const actualDmg = this.player.takeDamage(rawDamage);
            progression.activeRunStats.damageTaken += actualDmg;
            this.camShake = shakeIntensity;
            audio.play('collision');
            this.vibrate([Math.round(shakeIntensity * 120), 40, Math.round(shakeIntensity * 180)]);

            const impactLocation = this.scratchVec.set((this.player.x + v.mesh.position.x) * 0.5, 0.5, (this.player.mesh.position.z + v.mesh.position.z) * 0.5);
            this.traffic.spawnExplosion(impactLocation, 0xff2a44, Math.round(15 + shakeIntensity * 20));
            if (this.traffic.spawnSparks) {
              this.traffic.spawnSparks(impactLocation, Math.round(12 + shakeIntensity * 16), 0xffea00);
            }
            this.showDamageOverlay();
            const vehicleName = v.isTanker ? 'CHEMICAL TANKER' : (v.isTruck ? 'HEAVY TRUCK' : (v.isPolice ? 'POLICE INTERCEPTOR' : 'TRAFFIC CAR'));
            this.toast(`${severityTag} (${vehicleName} &bull; ${Math.round(relKmh)} KM/H) &bull; -${actualDmg}% HULL`, toastColor);

            if (this.player.hull <= 0) {
              this.gameOver(false, false);
              return;
            }
          }
        }
      } else if (absX >= halfW + 0.4 || absZ >= halfL + 0.4) {
        v.isColliding = false;
      }
    }

    // B. NPC Traffic Loop Supercars
    if (this.npcCars) {
      for (const npc of this.npcCars) {
        if (!npc.car) continue;
        const npcHalfW = 2.15;
        const npcHalfL = 4.2;
        const dx = this.player.x - npc.car.position.x;
        const dz = this.player.mesh.position.z - npc.car.position.z;
        const absX = Math.abs(dx);
        const absZ = Math.abs(dz);

        if (absX < npcHalfW && absZ < npcHalfL) {
          const bounceDir = dx >= 0 ? 1 : -1;
          const isRearEnd = dz > 0 && absX < (npcHalfW * 0.5 + 0.65);
          if (isRearEnd) {
            npc.car.position.z = Math.min(npc.car.position.z, this.player.mesh.position.z - (npcHalfL + 0.15));
            this.player.speed = Math.min(this.player.speed * 0.45, npc.speed * 0.85);
            this.player.targetSpeed = Math.min(this.player.targetSpeed, npc.speed);
            npc.speed += 5;
            this.player.suspensionPitch = 0.22;
          } else {
            this.player.x = THREE.MathUtils.clamp(npc.car.position.x + bounceDir * (npcHalfW + 0.18), -8.2, 8.2);
            this.player.mesh.position.x = this.player.x;
            npc.car.position.x = THREE.MathUtils.clamp(npc.car.position.x - bounceDir * 0.35, -7.5, 7.5);
            this.player.vx = bounceDir * 3.5;
            this.player.speed = Math.max(0, this.player.speed * 0.8);
          }

          if (!npc.isColliding) {
            npc.isColliding = true;
            const dmg = this.player.takeDamage(18);
            progression.activeRunStats.damageTaken += dmg;
            this.camShake = 0.55;
            audio.play('collision');
            this.vibrate([80, 40, 120]);
            this.traffic.spawnExplosion(this.scratchVec.set(this.player.x, 0.5, this.player.mesh.position.z), 0x00f0ff, 20);
            this.showDamageOverlay();
            this.toast('NPC TRAFFIC COLLISION!', 'magenta');
            if (this.player.hull <= 0) {
              this.gameOver(false, false);
              return;
            }
          }
        } else if (absX >= npcHalfW + 0.4 || absZ >= npcHalfL + 0.4) {
          npc.isColliding = false;
        }
      }

      // B2. Mutual Collisions: NPC Street Racers vs Traffic Vehicles & Each Other (No NPC Phasing!)
      if (this.traffic && this.traffic.vehicles) {
        for (const npc of this.npcCars) {
          if (!npc.car) continue;
          for (const v of this.traffic.vehicles) {
            if (v.hit) continue;
            const halfW = 2.15;
            const halfL = (v.length + 4.2) * 0.5;
            const dx = npc.car.position.x - v.mesh.position.x;
            const dz = npc.car.position.z - v.mesh.position.z;
            const absX = Math.abs(dx);
            const absZ = Math.abs(dz);

            // Headway check: if NPC is behind traffic in same lane, match speed or swerve!
            if (absX < 2.0 && dz > 0 && dz < 18.0) {
              npc.speed = Math.min(npc.speed, v.speed * 0.94);
              if (dz < 12.0 && npc.laneChangeTimer > 1.0) {
                npc.laneChangeTimer = 0.1;
              }
            }

            // Solid Physical Impasse
            if (absX < halfW && absZ < halfL) {
              const isNpcTrailing = dz > 0;
              if (isNpcTrailing) {
                npc.car.position.z = v.mesh.position.z + halfL + 0.15;
                npc.speed = Math.min(npc.speed, v.speed * 0.85);
                v.speed = Math.max(v.speed, npc.speed + 2.0);
              } else {
                const bounce = dx >= 0 ? 1 : -1;
                npc.car.position.x = THREE.MathUtils.clamp(npc.car.position.x + bounce * 0.6, -7.5, 7.5);
                v.mesh.position.x = THREE.MathUtils.clamp(v.mesh.position.x - bounce * 0.6, -7.5, 7.5);
                npc.speed *= 0.9;
                v.speed *= 0.9;
              }
            }
          }
        }

        // Mutual Collisions: NPC Street Racers vs Each Other
        for (let i = 0; i < this.npcCars.length; i++) {
          for (let j = i + 1; j < this.npcCars.length; j++) {
            const npc1 = this.npcCars[i];
            const npc2 = this.npcCars[j];
            if (!npc1.car || !npc2.car) continue;

            const halfW = 2.2;
            const halfL = 4.2;
            const dx = npc1.car.position.x - npc2.car.position.x;
            const dz = npc1.car.position.z - npc2.car.position.z;
            const absX = Math.abs(dx);
            const absZ = Math.abs(dz);

            if (absX < 2.0 && dz > 0 && dz < 16.0) {
              npc1.speed = Math.min(npc1.speed, npc2.speed * 0.95);
            } else if (absX < 2.0 && dz < 0 && -dz < 16.0) {
              npc2.speed = Math.min(npc2.speed, npc1.speed * 0.95);
            }

            if (absX < halfW && absZ < halfL) {
              const isNpc1Trailing = dz > 0;
              if (isNpc1Trailing) {
                npc1.car.position.z = npc2.car.position.z + halfL + 0.15;
                npc1.speed = Math.min(npc1.speed, npc2.speed * 0.85);
              } else {
                npc2.car.position.z = npc1.car.position.z + halfL + 0.15;
                npc2.speed = Math.min(npc2.speed, npc1.speed * 0.85);
              }
              const bounce = dx >= 0 ? 1 : -1;
              npc1.car.position.x = THREE.MathUtils.clamp(npc1.car.position.x + bounce * 0.5, -7.5, 7.5);
              npc2.car.position.x = THREE.MathUtils.clamp(npc2.car.position.x - bounce * 0.5, -7.5, 7.5);
            }
          }
        }
      }
    }

    // C. Sidewalk Wandering Pedestrians
    if (this.pedestrianManager && this.pedestrianManager.pedestrians) {
      for (const p of this.pedestrianManager.pedestrians) {
        if (!p.mesh) continue;
        const dx = this.player.x - p.mesh.position.x;
        const dz = this.player.mesh.position.z - p.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.9) {
          // Physical strike & ragdoll knockback
          p.mesh.position.x += Math.sign(dx || 1) * 3.2;
          p.mesh.position.y += 2.0;
          p.mesh.rotation.z += 1.6;
          p.mesh.rotation.x += 1.4;

          this.player.speed *= 0.75;
          this.camShake = 0.4;
          audio.play('collision');
          this.vibrate(60);
          this.traffic.spawnExplosion(p.mesh.position, 0xff2a85, 16);
          this.toast('PEDESTRIAN IMPACT!', 'magenta');
        }
      }
    }

    // D. Obstacles & Concrete Barriers
    for (const o of this.traffic.obstacles) {
      const obsHalfW = 1.35;
      const obsHalfL = 1.5;
      const dx = this.player.x - o.mesh.position.x;
      const dz = this.player.mesh.position.z - o.mesh.position.z;
      const absX = Math.abs(dx);
      const absZ = Math.abs(dz);

      if (absX < obsHalfW && absZ < obsHalfL) {
        const bounceDir = dx >= 0 ? 1 : -1;
        if (o.isSpike) {
          if (!o.isColliding) {
            o.isColliding = true;
            const dmg = this.player.takeDamage(12);
            progression.activeRunStats.damageTaken += dmg;
            this.player.speed *= 0.45;
            this.camShake = 0.45;
            audio.play('collision');
            this.vibrate(90);
            this.toast('TIRES PUNCTURED BY SPIKES', 'magenta');
          }
        } else if (o.isRoadblock) {
          // SWAT Armored Roadblock: Severe deflection & heavy structural damage
          this.player.x = THREE.MathUtils.clamp(o.mesh.position.x + bounceDir * (obsHalfW + 0.15), -8.2, 8.2);
          this.player.mesh.position.x = this.player.x;
          this.player.speed = Math.max(0, this.player.speed * 0.25);

          if (!o.isColliding) {
            o.isColliding = true;
            const dmg = this.player.takeDamage(24);
            progression.activeRunStats.damageTaken += dmg;
            this.camShake = 0.65;
            audio.play('collision');
            this.vibrate([100, 60, 150]);
            this.traffic.spawnExplosion(this.scratchVec.set(this.player.x, 0.6, this.player.mesh.position.z), 0xff0044, 22);
            if (this.traffic.spawnSparks) {
              this.traffic.spawnSparks(this.scratchVec.set(this.player.x, 0.5, this.player.mesh.position.z), 18, 0xff0044);
            }
            this.toast('💥 HEAVY SWAT ROADBLOCK IMPACT!', 'magenta');
            if (this.player.hull <= 0) {
              this.gameOver(false, false);
              return;
            }
          }
        } else {
          // Hard physical barrier / barrel: SOLID LATERAL SEPARATION & SPEED CLAMP
          this.player.x = THREE.MathUtils.clamp(o.mesh.position.x + bounceDir * (obsHalfW + 0.1), -8.2, 8.2);
          this.player.mesh.position.x = this.player.x;
          this.player.speed = Math.max(0, this.player.speed * 0.35);

          if (!o.isColliding) {
            o.isColliding = true;
            const dmg = this.player.takeDamage(18);
            progression.activeRunStats.damageTaken += dmg;
            this.camShake = 0.55;
            audio.play('collision');
            this.vibrate([60, 40, 100]);
            this.traffic.spawnExplosion(this.scratchVec.set(this.player.x, 0.5, this.player.mesh.position.z), 0xff6600, 18);
            if (this.traffic.spawnSparks) {
              this.traffic.spawnSparks(this.scratchVec.set(this.player.x, 0.45, this.player.mesh.position.z), 16, 0xffaa00);
            }
            this.toast('SOLID BARRIER COLLISION', 'magenta');
            if (this.player.hull <= 0) {
              this.gameOver(false, false);
              return;
            }
          }
        }
        this.showDamageOverlay();
      } else if (absX >= obsHalfW + 0.4 || absZ >= obsHalfL + 0.4) {
        o.isColliding = false;
      }
    }

    // Collectibles Pickup
    for (let i = this.traffic.collectibles.length - 1; i >= 0; i--) {
      const c = this.traffic.collectibles[i];
      if (c.mesh.position.distanceTo(this.player.mesh.position) < 2.4) {
        if (c.type === 'coin') {
          audio.play('pickup');
          this.traffic.spawnExplosion(c.mesh.position, 0xffea00, 12);
          progression.activeRunStats.coinsEarned += 10;
          this.score += 150;
          this.spawnScorePopup('+10 CREDITS', '#ffb800');
        } else if (c.type === 'nitro') {
          audio.play('nitro_pickup');
          this.traffic.spawnExplosion(c.mesh.position, 0x00d9ff, 18);
          this.player.addNitro(75);
          this.player.triggerSpeedBoost(1.5, 2.5); // Instant supersonic nitro boost surge!
          progression.activeRunStats.coinsEarned += 25;
          this.score += 350;
          this.spawnScorePopup('⚡ NITRO SURGE! +350 PTS', '#00d9ff');
          this.toast('SUPERCHARGED NITRO BOOST ACTIVATED!', 'cyan');
        } else if (c.type === 'repair') {
          audio.play('repair');
          this.traffic.spawnExplosion(c.mesh.position, 0x00ff88, 16);
          const healed = this.player.repairHull(35);
          progression.activeRunStats.coinsEarned += 20;
          this.score += 400;
          this.spawnScorePopup(`💚 LIFE PACK! +${healed} HP`, '#00ff88');
          this.toast(`LIFE PACK ACQUIRED! +${healed} HP REPAIRED`, 'green');
          if (this.player.hull > 25 && this.ui.overlayRedAlert) {
            this.ui.overlayRedAlert.classList.add('hidden');
          }
        }

        this.scene.remove(c.mesh);
        this.traffic.collectibles.splice(i, 1);
      }
    }

    // Sprint Mode Rivals Update & Position Tracking
    if (this.gameMode === 'SPRINT' && this.rivalCars.length > 0) {
      let playerPos = 1;
      for (const rival of this.rivalCars) {
        rival.dist += rival.speed * dt;
        if (rival.dist > this.distance) {
          playerPos++;
        }
      }
      this.racePosition = playerPos;
      if (this.ui.racePosNum) {
        const suffixes = ['ST', 'ND', 'RD', 'TH'];
        const sfx = suffixes[this.racePosition - 1] || 'TH';
        this.ui.racePosNum.textContent = `${this.racePosition}${sfx}`;
        this.ui.racePosNum.style.color = this.racePosition === 1 ? '#00ff88' : (this.racePosition === 2 ? '#00d9ff' : (this.racePosition === 3 ? '#ffb800' : '#ff4444'));
      }

      // Check Finish Line (3,000m)
      if (this.distance >= this.sprintTargetDistance) {
        const won = this.racePosition === 1;
        audio.play('fever');
        this.vibrate([100, 100, 300]);
        if (won) {
          progression.data.coins += 1500;
          progression.save();
          this.toast('1ST PLACE FINISH! SPRINT CHAMPION! +1,500 CREDITS', 'gold');
        } else {
          progression.data.coins += 400;
          progression.save();
          this.toast(`SPRINT FINISHED: ${this.racePosition}TH PLACE! +400 CREDITS`, 'cyan');
        }
        this.gameOver(true, won);
        return;
      }
    }

    // 10. Dynamic Camera Motion & Wide-Angle Long Highway Sightline
    const dynamicFov = 64 + Math.min(18, (kmh / 360) * 16) + (this.player.isBoosting ? 8 : 0) + (this.player.isAirborne ? 4 : 0) - (this.player.isBraking ? 5 : 0);
    this.camera.fov += (dynamicFov - this.camera.fov) * Math.min(1, dt * 5.2);
    this.camera.updateProjectionMatrix();

    // High-speed asphalt micro-rumble (smooth & subtle)
    const speedRumble = (kmh > 240) ? Math.min(0.025, ((kmh - 240) / 140) * 0.02) : 0;
    this.camShake = Math.max(0, this.camShake - dt * 2.8);
    const totalShake = this.camShake + speedRumble;

    // Smooth Harmonic Camera Rumble & Impact Shake (eliminates single-frame jagged twitch)
    const timeNow = performance.now() * 0.035;
    const shakeNoiseX = Math.sin(timeNow * 1.1) * totalShake * 0.45;
    const shakeNoiseY = Math.cos(timeNow * 0.9) * totalShake * 0.35;

    // Cinematic GT Chase Cam: Elevated rear angle that reveals 150+ meters of open highway ahead
    const targetCamX = this.player.x * 0.48 + shakeNoiseX;
    const targetCamY = 3.8 + this.player.mesh.position.y * 0.48 + shakeNoiseY - (this.player.isBraking ? 0.16 : 0);
    const targetCamZ = 1.2 + (this.player.isBoosting ? 0.8 : 0) - (this.player.isBraking ? 0.45 : 0);

    this.camera.position.x += (targetCamX - this.camera.position.x) * Math.min(1, dt * 7.0);
    this.camera.position.y += (targetCamY - this.camera.position.y) * Math.min(1, dt * 6.0);
    this.camera.position.z += (targetCamZ - this.camera.position.z) * Math.min(1, dt * 5.2);

    // Look far down the highway (Z = -85m) towards the horizon so all 3 lanes, oncoming cars, ramps, and horizon are fully visible
    this.camera.lookAt(
      this.player.x * 0.22,
      1.80 + this.player.mesh.position.y * 0.32,
      -85
    );

    // Dynamic speed warp radial lines
    const warpOpacity = this.player.isBoosting ? '0.85' : (kmh > 260 ? String(Math.min(0.65, (kmh - 260) / 100)) : '0');
    this.ui.overlayWarp.style.opacity = warpOpacity;
    this.ui.overlayShield.style.opacity = this.player.shieldActive ? '0.75' : '0';

    this.updateHud(kmh);
  }

  updateHeatHud() {
    if (!this.ui.heatStars || !this.ui.heatStars.length) return;
    const roundedHeat = Math.round(this.heatLevel);
    this.ui.heatStars.forEach((star, idx) => {
      star.classList.toggle('active', idx < roundedHeat);
    });
  }

  increaseHeat(amt) {
    const oldLevel = Math.floor(this.heatLevel);
    this.heatLevel = Math.max(0, Math.min(5, this.heatLevel + amt));
    const newLevel = Math.floor(this.heatLevel);
    this.updateHeatHud();
    if (newLevel > oldLevel && newLevel >= 1) {
      this.toast(`🚨 HEAT LEVEL ${newLevel}! HIGHWAY PATROL ALERTED`, 'magenta');
      audio.play('fever');
    }
  }

  triggerEmpShockwave() {
    return this.triggerKineticEmp();
  }

  triggerKineticEmp() {
    if (this.state !== 'RUNNING') return;
    if (this.empCooldown > 0) return;
    if (this.player.nitro < 25) {
      this.toast('EMP REQUIRES 25% NITRO OVERDRIVE CHARGE', 'magenta');
      return;
    }

    this.player.nitro = Math.max(0, this.player.nitro - 25);
    this.empCooldown = 3.2;
    audio.play('emp_blast');
    this.camShake = 0.55;
    this.vibrate([100, 50, 150]);

    // Visual Expanding Shockwave Ring in 3D Scene
    const ringGeo = new THREE.RingGeometry(0.6, 2.4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(this.player.x, 0.45, this.player.mesh.position.z);
    this.scene.add(ringMesh);

    let ringScale = 1.0;
    const expandInterval = setInterval(() => {
      ringScale += 0.85;
      ringMesh.scale.set(ringScale, 1, ringScale);
      ringMat.opacity -= 0.12;
      if (ringMat.opacity <= 0) {
        clearInterval(expandInterval);
        this.scene.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      }
    }, 35);

    // Deflect all traffic vehicles within 45m out of player lane into shoulders
    let clearedCount = 0;
    if (this.traffic && this.traffic.vehicles) {
      const pz = this.player.mesh.position.z;
      this.traffic.vehicles.forEach(v => {
        const rz = v.mesh.position.z - pz;
        if (rz < 0 && rz > -45) {
          clearedCount++;
          const side = Math.sign(v.mesh.position.x || 1) || 1;
          v.mesh.position.x = side * 8.5;
          v.speed *= 0.5;
          this.traffic.spawnExplosion(v.mesh.position, 0x00f0ff, 12);
        }
      });
    }

    this.toast(`⚡ KINETIC EMP SHOCKWAVE DISCHARGED! ${clearedCount} CARS CLEARED`, 'cyan');
    this.spawnScorePopup('+300 KINETIC EMP', '#00f0ff');
    this.score += 300;
  }

  showDamageOverlay() {
    this.ui.overlayDamage.style.opacity = '1';
    setTimeout(() => {
      this.ui.overlayDamage.style.opacity = '0';
    }, 240);
  }

  updateHud(kmh) {
    this.ui.distance.textContent = Math.floor(this.distance);
    this.ui.score.textContent = this.score.toLocaleString();
    this.ui.coins.textContent = progression.activeRunStats.coinsEarned;
    this.ui.multiplier.textContent = `x${this.multiplier}`;

    const hullPct = Math.max(0, (this.player.hull / this.player.maxHull) * 100);
    this.ui.hullBar.style.width = `${hullPct}%`;
    this.ui.hullBox.classList.toggle('hull-low', hullPct < 30);

    // Full-Screen Emergency Red Alert Blinking Border on Low Health (Critical damage state)
    const isCriticalHealth = hullPct <= 35 && hullPct > 0;
    if (this.ui.overlayRedAlert) {
      this.ui.overlayRedAlert.classList.toggle('hidden', !isCriticalHealth);
    }
    if (isCriticalHealth && (this.state === 'RUNNING' || this.state === 'PLAYING')) {
      this.redAlertAudioTimer = (this.redAlertAudioTimer || 0) + 0.016;
      if (this.redAlertAudioTimer >= 0.85) {
        this.redAlertAudioTimer = 0;
        audio.play('red_alert');
      }
    } else {
      this.redAlertAudioTimer = 0.8; // Armed to beep immediately on critical threshold
    }

    this.ui.speedNum.textContent = Math.round(kmh);
    if (this.ui.speedMph) {
      this.ui.speedMph.textContent = Math.round(kmh * 0.621371);
    }
    this.ui.speedNum.classList.toggle('speed-hypersonic', kmh >= 260);

    const speedRatio = Math.min(100, (kmh / 360) * 100);
    this.ui.speedBar.style.width = `${speedRatio}%`;

    // Real-Time Gear & RPM Tachometer HUD
    const curGear = audio.getGear();
    if (this.ui.gearBadge) {
      if (this.lastGear !== curGear) {
        this.lastGear = curGear;
        this.ui.gearBadge.textContent = `GEAR ${curGear}`;
        this.ui.gearBadge.classList.remove('gear-kick');
        void this.ui.gearBadge.offsetWidth;
        this.ui.gearBadge.classList.add('gear-kick');
      }
    }

    const rpm = audio.getRpm();
    if (this.ui.rpmNum && this.ui.rpmBar) {
      this.ui.rpmNum.textContent = `${rpm.toLocaleString()} RPM`;
      const rpmPct = Math.min(100, Math.max(8, (rpm / 8000) * 100));
      this.ui.rpmBar.style.width = `${rpmPct}%`;
    }

    // Sequential Shift LEDs (GT3 Style)
    if (this.ui.shiftLeds && this.ui.shiftLeds.length > 0) {
      const thresholds = [3200, 4000, 4800, 5600, 6400, 7000, 7400, 7700];
      const isRedline = rpm >= 7700;
      this.ui.shiftLeds.forEach((led, idx) => {
        const active = rpm >= thresholds[idx];
        led.classList.toggle('active', active);
        led.classList.toggle('strobe', isRedline && idx === 7);
      });
    }

    const nitroPct = (this.player.nitro / this.player.maxNitro) * 100;
    this.ui.nitroBar.style.width = `${nitroPct}%`;
    this.ui.nitroTrack.classList.toggle('nitro-ready', nitroPct >= 95);
    if (this.ui.nitroTag) {
      if (this.player.isBoosting) {
        this.ui.nitroTag.textContent = 'NITRO FIRING';
        this.ui.nitroTag.classList.add('active');
      } else if (nitroPct >= 95) {
        this.ui.nitroTag.textContent = 'MAX OVERDRIVE';
        this.ui.nitroTag.classList.remove('active');
      } else {
        this.ui.nitroTag.textContent = `${Math.round(nitroPct)}% CHARGE`;
        this.ui.nitroTag.classList.remove('active');
      }
    }

    // Highway Distance Radar
    const targetMilestone = this.world.challengeDistance || 10000;
    const radarPct = Math.min(100, (this.distance / targetMilestone) * 100);
    if (this.ui.radarProgress) this.ui.radarProgress.style.width = `${radarPct}%`;
    if (this.ui.radarPinPlayer) this.ui.radarPinPlayer.style.left = `${radarPct}%`;

    // 1. Checkpoint Distance Progress Gauge
    const remainingCheckpoint = Math.max(0, this.checkpointDistance - this.distance);
    const interval = this.checkpointInterval || (this.gameMode === 'SPRINT' ? 2000 : 850);
    const checkpointPct = Math.max(0, Math.min(100, (1 - (remainingCheckpoint / interval)) * 100));
    if (this.ui.checkpointFill) this.ui.checkpointFill.style.width = `${checkpointPct}%`;
    if (this.ui.checkpointRem) this.ui.checkpointRem.textContent = `${Math.round(remainingCheckpoint)}m`;

    // 2. 3-Lane Highway Spatial Traffic Radar & Proximity Hazard Alerts
    if (this.ui.spatialRadar) {
      if (this.ui.spatialPlayerMarker) {
        const markerPct = THREE.MathUtils.clamp(((this.player.x + 8.2) / 16.4) * 100, 10, 90);
        this.ui.spatialPlayerMarker.style.left = `${markerPct}%`;
      }

      const playerZ = this.player.mesh.position.z;
      const blipsL = [];
      const blipsC = [];
      const blipsR = [];

      let hazardAhead = false;
      let hazardIsTruck = false;
      let hazardIsPolice = false;
      let hazardIsRoadblock = false;

      if (this.traffic && this.traffic.vehicles) {
        this.traffic.vehicles.forEach(v => {
          const relZ = v.mesh.position.z - playerZ;
          if (relZ < 0 && relZ > -65) {
            const topPct = Math.min(95, Math.max(5, (-relZ / 65) * 100));
            const isTruck = v.isTruck || v.isTanker;
            let blipClass = isTruck ? 'blip-truck' : 'blip-car';
            if (v.isPolice) {
              blipClass = v.isInterceptor ? 'blip-police blip-interceptor' : 'blip-police';
            }
            const blipHtml = `<div class="radar-blip ${blipClass}" style="top:${topPct.toFixed(1)}%;"></div>`;

            if (v.mesh.position.x < -2.5) blipsL.push(blipHtml);
            else if (v.mesh.position.x > 2.5) blipsR.push(blipHtml);
            else blipsC.push(blipHtml);

            if (relZ > -32 && Math.abs(v.mesh.position.x - this.player.x) < 2.0) {
              hazardAhead = true;
              if (isTruck) hazardIsTruck = true;
            }
            if (v.isPolice && relZ > -28) {
              hazardIsPolice = true;
            }
          }
        });
      }

      if (this.traffic && this.traffic.obstacles) {
        this.traffic.obstacles.forEach(o => {
          const relZ = o.mesh.position.z - playerZ;
          if (relZ < 0 && relZ > -60) {
            const topPct = Math.min(95, Math.max(5, (-relZ / 60) * 100));
            const blipClass = o.isRoadblock ? 'blip-roadblock' : 'blip-truck';
            const blipHtml = `<div class="radar-blip ${blipClass}" style="top:${topPct.toFixed(1)}%;"></div>`;
            if (o.mesh.position.x < -2.5) blipsL.push(blipHtml);
            else if (o.mesh.position.x > 2.5) blipsR.push(blipHtml);
            else blipsC.push(blipHtml);

            if (relZ > -28 && Math.abs(o.mesh.position.x - this.player.x) < 1.8) {
              hazardAhead = true;
            }
            if (o.isRoadblock && relZ > -38) {
              hazardIsRoadblock = true;
            }
          }
        });
      }

      if (this.traffic && this.traffic.jumpRamps) {
        this.traffic.jumpRamps.forEach(r => {
          const rz = r.parent.position.z + r.mesh.position.z;
          const relZ = rz - playerZ;
          if (relZ < 0 && relZ > -65) {
            const topPct = Math.min(95, Math.max(5, (-relZ / 65) * 100));
            const blipHtml = `<div class="radar-blip blip-ramp" style="top:${topPct.toFixed(1)}%;"></div>`;
            if (r.lane < -2.5) blipsL.push(blipHtml);
            else if (r.lane > 2.5) blipsR.push(blipHtml);
            else blipsC.push(blipHtml);
          }
        });
      }

      if (this.ui.blipsLeft) this.ui.blipsLeft.innerHTML = blipsL.join('');
      if (this.ui.blipsCenter) this.ui.blipsCenter.innerHTML = blipsC.join('');
      if (this.ui.blipsRight) this.ui.blipsRight.innerHTML = blipsR.join('');

      // Forward Hazard Proximity Alert
      if (hazardAhead || hazardIsRoadblock || hazardIsPolice) {
        this.ui.proximityAlert?.classList.remove('hidden');
        if (this.ui.proximityText) {
          if (hazardIsRoadblock) {
            this.ui.proximityText.textContent = 'SWAT ROADBLOCK AHEAD • FIND ESCAPE GAP';
          } else if (hazardIsPolice) {
            this.ui.proximityText.textContent = 'POLICE INTERCEPTOR CLOSING IN • EVADE PIT';
          } else if (hazardIsTruck) {
            this.ui.proximityText.textContent = 'HEAVY TRUCK AHEAD • SHIFT LANE';
          } else {
            this.ui.proximityText.textContent = 'HAZARD IN LANE • EVADE';
          }
        }
      } else {
        this.ui.proximityAlert?.classList.add('hidden');
      }

      // Stunt Ramp Trajectory Cue
      let rampClose = false;
      if (this.traffic && this.traffic.jumpRamps) {
        rampClose = this.traffic.jumpRamps.some(r => {
          const rz = r.parent.position.z + r.mesh.position.z;
          const relZ = rz - playerZ;
          return relZ < 0 && relZ > -55 && Math.abs(r.lane - this.player.x) < 3.2;
        });
      }
      if (rampClose && !this.player.isAirborne) {
        this.ui.rampCue?.classList.remove('hidden');
      } else {
        this.ui.rampCue?.classList.add('hidden');
      }
    }

    // 3. Hypersonic Nitro Speed Lines Rendering
    this.updateSpeedLines(kmh);
  }

  initSpeedLines() {
    this.speedLinesCanvas = document.querySelector('#nitro-speed-lines');
    if (!this.speedLinesCanvas) return;
    this.speedLinesCtx = this.speedLinesCanvas.getContext('2d');
    this.speedLines = [];
    const count = 45;
    for (let i = 0; i < count; i++) {
      this.speedLines.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.15 + Math.random() * 0.85,
        speed: 0.8 + Math.random() * 1.6,
        len: 25 + Math.random() * 80
      });
    }

    const resize = () => {
      if (this.speedLinesCanvas) {
        this.speedLinesCanvas.width = window.innerWidth;
        this.speedLinesCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();
  }

  updateSpeedLines(kmh) {
    if (!this.speedLinesCanvas || !this.speedLinesCtx) return;
    const isHighSpeed = this.player.isBoosting || kmh >= 270;
    const targetOpacity = this.player.isBoosting ? 0.95 : (kmh >= 270 ? Math.min(0.65, (kmh - 270) / 90) : 0);
    this.speedLinesCanvas.style.opacity = targetOpacity;

    if (targetOpacity <= 0) return;

    const ctx = this.speedLinesCtx;
    const w = this.speedLinesCanvas.width;
    const h = this.speedLinesCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;

    ctx.strokeStyle = this.player.isBoosting ? '#00f0ff' : '#ffffff';
    ctx.lineWidth = this.player.isBoosting ? 2.5 : 1.5;

    for (const line of this.speedLines) {
      line.dist += line.speed * (this.player.isBoosting ? 0.045 : 0.025);
      if (line.dist > 1.0) {
        line.dist = 0.12;
        line.angle = Math.random() * Math.PI * 2;
      }

      const r1 = line.dist * Math.min(w, h) * 0.5;
      const r2 = r1 + line.len * (this.player.isBoosting ? 1.6 : 1.0);

      const x1 = cx + Math.cos(line.angle) * r1;
      const y1 = cy + Math.sin(line.angle) * r1;
      const x2 = cx + Math.cos(line.angle) * r2;
      const y2 = cy + Math.sin(line.angle) * r2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  loop(now) {
    let dt = (now - this.lastTime) / 1000;
    // Allow variable frame rates (20-120 FPS) without running in slow motion on mobile!
    // Clamp to 0.05s (20 FPS min) only to prevent spiral-of-death on backgrounding/freeze spikes.
    if (dt > 0.05) dt = 0.05;
    if (dt < 0.001) dt = 0.001;
    this.lastTime = now;

    const tUpdate0 = performance.now();
    this.update(dt);
    const updateMs = performance.now() - tUpdate0;

    const tRender0 = performance.now();
    if (this.bloomEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    const renderMs = performance.now() - tRender0;

    this.lastLogicUpdateMs = updateMs;
    this.lastRenderMs = renderMs;
    this.lastFrameComputeMs = updateMs + renderMs;

    if (this.state === 'RUNNING') {
      if (!this.logicUpdateTimes) this.logicUpdateTimes = [];
      this.logicUpdateTimes.push(updateMs);
      if (this.logicUpdateTimes.length > 600) this.logicUpdateTimes.shift();

      if (!this.frameComputeTimes) this.frameComputeTimes = [];
      this.frameComputeTimes.push(updateMs + renderMs);
      if (this.frameComputeTimes.length > 600) this.frameComputeTimes.shift();
    }

    requestAnimationFrame(this.loop);
  }

  getPerformanceMetrics() {
    const logicTimes = this.logicUpdateTimes || [];
    const count = logicTimes.length;
    if (count === 0) return { avgLogicMs: 0, p95LogicMs: 0, p99LogicMs: 0, avgTotalMs: 0 };
    const sumLogic = logicTimes.reduce((a, b) => a + b, 0);
    const sortedLogic = [...logicTimes].sort((a, b) => a - b);

    const totalTimes = this.frameComputeTimes || [];
    const sumTotal = totalTimes.reduce((a, b) => a + b, 0);
    const sortedTotal = [...totalTimes].sort((a, b) => a - b);

    return {
      totalFramesSampled: count,
      lastLogicMs: parseFloat((this.lastLogicUpdateMs || 0).toFixed(3)),
      avgLogicMs: parseFloat((sumLogic / count).toFixed(3)),
      p95LogicMs: parseFloat((sortedLogic[Math.floor(sortedLogic.length * 0.95)] || 0).toFixed(3)),
      p99LogicMs: parseFloat((sortedLogic[Math.floor(sortedLogic.length * 0.99)] || 0).toFixed(3)),
      maxLogicMs: parseFloat((sortedLogic[sortedLogic.length - 1] || 0).toFixed(3)),
      lastRenderMs: parseFloat((this.lastRenderMs || 0).toFixed(3)),
      avgTotalMs: parseFloat((sumTotal / (totalTimes.length || 1)).toFixed(3))
    };
  }

  getInputTelemetry() {
    return {
      touchControlMode: progression.data.settings.touchControlMode || 'joystick',
      hapticFeedbackEnabled: progression.data.settings.hapticFeedbackEnabled !== false,
      gamepadRumbleEnabled: Boolean(progression.data.settings.gamepadRumbleEnabled),
      joystick: { ...this.touchTracker.joystick },
      activeTouchPointerCount: this.touchTracker.activePointers.size,
      heldTouchKeys: Array.from(this.touchTracker.activePointers.values()),
      heldKeys: Array.from(this.keys),
      gamepad: this._lastGamepadState,
      recentHaptics: this.haptics.history.slice(-10)
    };
  }

  getMaterialTelemetry() {
    return this.player ? this.player.getMaterialTelemetry() : null;
  }

  getWeatherTelemetry() {
    const worldTelemetry = this.world ? this.world.getWeatherTelemetry() : null;
    const playerVfx = this.player ? this.player.getVfxTelemetry() : null;
    return {
      world: worldTelemetry,
      playerVfx: playerVfx
    };
  }

  loopStep(dt = 0.016) {
    const tUpdate0 = performance.now();
    this.update(dt);
    const updateMs = performance.now() - tUpdate0;

    const tRender0 = performance.now();
    if (this.bloomEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    const renderMs = performance.now() - tRender0;

    this.lastLogicUpdateMs = updateMs;
    this.lastRenderMs = renderMs;
    this.lastFrameComputeMs = updateMs + renderMs;
  }

  getLightingTelemetry() {
    const worldTelem = this.world && this.world.getLightingTelemetry ? this.world.getLightingTelemetry() : null;
    const playerTelem = this.player && this.player.getHeadlightTelemetry ? this.player.getHeadlightTelemetry() : null;
    const bloomTelem = {
      bloomEnabled: Boolean(this.bloomEnabled),
      bloomStrength: this.bloomPass ? parseFloat(this.bloomPass.strength.toFixed(3)) : 0,
      bloomThreshold: this.bloomPass ? parseFloat(this.bloomPass.threshold.toFixed(3)) : 0,
      bloomRadius: this.bloomPass ? parseFloat(this.bloomPass.radius.toFixed(3)) : 0,
      hasComposer: Boolean(this.composer)
    };
    return {
      world: worldTelem,
      player: playerTelem,
      postProcessing: bloomTelem
    };
  }

  getBiomeTelemetry() {
    return this.world && this.world.getBiomeTelemetry ? this.world.getBiomeTelemetry() : null;
  }
}

// Boot application
function bootGame() {
  if (!window.game) {
    window.progression = progression;
    window.game = new RoadRiotGame();
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGame);
  } else {
    bootGame();
  }
}
