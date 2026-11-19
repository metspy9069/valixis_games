// Road Riot 3D - Flagship Game Engine & State Controller
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { audio } from './audio.js';
import { WorldManager } from './world.js';
import { PlayerCar, VEHICLE_ROSTER } from './player.js';
import { TrafficManager } from './traffic.js';
import { WeaponSystem } from './weapons.js';
import { TurretDefenseSystem } from './turret.js';
import { progression, ACHIEVEMENTS } from './progression.js';

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
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // Fast contact shadow planes used instead of 1,000+ shadow draw calls
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0c1322, 130, 480);

    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 700);
    this.defaultCamPos = new THREE.Vector3(0, 3.8, 1.2);
    this.camera.position.copy(this.defaultCamPos);

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

    // 3D Turntable Drag Rotation
    this.turntableAngle = 0;
    this.isDraggingTurntable = false;
    this.lastDragX = 0;

    // Assets Prototypes
    this.assetPrototypes = {};
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./assets/draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Subsystems
    this.world = new WorldManager(this.scene);
    this.traffic = new TrafficManager(this.scene, this.assetPrototypes);
    this.player = new PlayerCar(this.scene, this.assetPrototypes);
    this.weapons = new WeaponSystem(this.scene, this.traffic, audio);
    this.turretSystem = new TurretDefenseSystem(this.scene, this.player, audio);

    // 180° Sky Drone Checkpoint Sequence State
    this.checkpointDistance = 600;
    this.checkpointInterval = 1200;
    this.isStoppingForCheckpoint = false;
    this.isDynoTesting = false;

    // 3D Turntable Showcase Platform
    this.turntableMesh = this.buildTurntableMesh();
    this.scene.add(this.turntableMesh);
    this.turntableMesh.visible = false;

    // Garage carousel index
    this.garageVehicleList = Object.keys(VEHICLE_ROSTER);
    this.garageIndex = this.garageVehicleList.indexOf(progression.data.selectedVehicle) || 0;

    // Drone auto-shoot timer
    this.droneFireTimer = 0;

    // Bind UI & Inputs
    this.cacheDomElements();
    this.bindEvents();
    this.applySavedSettings();
    this.loadAssets();
    this.checkUrlChallenge();

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
      speedBar: document.querySelector('#hud-speed-fill'),
      gearBadge: document.querySelector('#hud-gear'),
      rpmNum: document.querySelector('#hud-rpm'),
      rpmBar: document.querySelector('#hud-rpm-fill'),
      nitroBar: document.querySelector('#hud-nitro-fill'),
      nitroTrack: document.querySelector('#hud-nitro-track'),
      announcer: document.querySelector('#announcer-zone'),
      floatingScores: document.querySelector('#floating-scores-layer'),
      countdownOverlay: document.querySelector('#countdown-overlay'),
      countdownText: document.querySelector('#countdown-text'),

      // Radar
      radarProgress: document.querySelector('#radar-progress'),
      radarPinPlayer: document.querySelector('#radar-pin-player'),
      radarPinBeacon: document.querySelector('#radar-pin-beacon'),

      // Screen Overlays
      overlayDamage: document.querySelector('#overlay-damage'),
      overlayWarp: document.querySelector('#overlay-warp'),
      overlayShield: document.querySelector('#overlay-shield'),

      // Modals & Navigation
      menuModal: document.querySelector('#menu-modal'),
      startBtn: document.querySelector('#start-btn'),
      garageBtn: document.querySelector('#garage-btn'),
      menuSettingsBtn: document.querySelector('#menu-settings-btn'),
      pauseBtn: document.querySelector('#pause-btn'),
      settingsBtn: document.querySelector('#settings-btn'),
      audioBtn: document.querySelector('#audio-btn'),
      networkBtn: document.querySelector('#network-btn'),

      // Garage
      garageModal: document.querySelector('#garage-modal'),
      garageCloseBtn: document.querySelector('#garage-close-btn'),
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

      // Checkpoint & Turret Gunner HUD
      checkpointBanner: document.querySelector('#hud-checkpoint-banner'),
      turretCrosshair: document.querySelector('#hud-turret-crosshair'),
      turretDroneCount: document.querySelector('#turret-drone-count'),
      turretWaveBadge: document.querySelector('#turret-wave-badge'),
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
    const spotKey = new THREE.SpotLight(0xffffff, 4.5, 20, Math.PI / 4, 0.3);
    spotKey.position.set(-4, 6, -4);
    spotKey.target = base;
    group.add(spotKey);

    const spotFill = new THREE.SpotLight(0x00d9ff, 3.5, 20, Math.PI / 3, 0.4);
    spotFill.position.set(4, 5, -5);
    spotFill.target = base;
    group.add(spotFill);

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

  applyGraphicsQuality(quality) {
    progression.data.settings.graphicsQuality = quality;
    progression.save();

    this.ui.qualityBtns?.forEach(b => {
      b.classList.toggle('active', b.dataset.quality === quality);
    });

    if (quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
    } else if (quality === 'med') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.3));
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    }
  }

  bindEvents() {
    // Keyboard
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key);
    });

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
      const newDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.0));
      this.renderer.setPixelRatio(newDpr);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mobile Touch Controls
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const key = btn.dataset.key;
      const onDown = ev => {
        ev.preventDefault();
        this.vibrate(30);
        this.keys.add(key);
      };
      const onUp = ev => {
        ev.preventDefault();
        this.keys.delete(key);
      };
      btn.addEventListener('pointerdown', onDown, { passive: false });
      btn.addEventListener('pointerup', onUp, { passive: false });
      btn.addEventListener('pointercancel', onUp, { passive: false });
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

    this.ui.networkBtn?.addEventListener('click', () => this.ui.networkModal.classList.remove('hidden'));
    this.ui.networkCloseBtn?.addEventListener('click', () => this.ui.networkModal.classList.add('hidden'));

    this.ui.audioBtn?.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      this.ui.audioBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Garage Tabs
    this.ui.tabCarsBtn?.addEventListener('click', () => {
      this.ui.tabCarsBtn.classList.add('active');
      this.ui.tabAchievementsBtn.classList.remove('active');
      this.ui.garageViewCars.classList.remove('hidden');
      this.ui.garageViewAchievements.classList.add('hidden');
    });

    this.ui.tabAchievementsBtn?.addEventListener('click', () => {
      this.ui.tabAchievementsBtn.classList.add('active');
      this.ui.tabCarsBtn.classList.remove('active');
      this.ui.garageViewAchievements.classList.remove('hidden');
      this.ui.garageViewCars.classList.add('hidden');
      this.renderAchievementsList();
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

    // 3D Turntable Drag Interaction
    window.addEventListener('pointerdown', e => {
      if (this.state === 'GARAGE') {
        this.isDraggingTurntable = true;
        this.lastDragX = e.clientX;
      }
    });

    window.addEventListener('pointermove', e => {
      if (this.state === 'GARAGE' && this.isDraggingTurntable && this.player.chassis) {
        const dx = e.clientX - this.lastDragX;
        this.lastDragX = e.clientX;
        this.turntableAngle += dx * 0.012;
        this.player.chassis.rotation.y = this.turntableAngle;
        if (this.turntableMesh) this.turntableMesh.rotation.y = this.turntableAngle;
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingTurntable = false;
      if (this.state === 'TURRET_DEFENSE') {
        this.turretSystem.stopFire();
      }
    });

    // 180° Turret Gunner Mode Aim & Fire
    window.addEventListener('pointermove', e => {
      if (this.state === 'TURRET_DEFENSE') {
        const normX = (e.clientX / window.innerWidth) * 2 - 1;
        const normY = (e.clientY / window.innerHeight) * 2 - 1;
        this.turretSystem.setAimNormalized(normX, normY);
        if (this.ui.turretCrosshair) {
          this.ui.turretCrosshair.style.left = `${e.clientX}px`;
          this.ui.turretCrosshair.style.top = `${e.clientY}px`;
        }
      }
    });

    window.addEventListener('pointerdown', e => {
      if (this.state === 'TURRET_DEFENSE') {
        this.turretSystem.triggerFire();
      }
    });

    // Garage Dyno Test Benchmark
    this.ui.garageDynoBtn?.addEventListener('click', () => this.runDynoBenchmark());
  }

  runDynoBenchmark() {
    if (this.isDynoTesting) return;
    this.isDynoTesting = true;
    this.toast('DYNO BENCHMARK ENGAGED! REV TO REDLINE 🏁', 'gold');
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
        const zeroToHundred = (2.65 + Math.random() * 0.45).toFixed(2);
        const horsepower = Math.floor(680 + Math.random() * 140);
        this.toast(`DYNO TELEMETRY: 0-100 IN ${zeroToHundred}s | ${horsepower} BHP! ⚡`, 'cyan');
        audio.play('fever');
      }
    }, 60);
  }

  loadAssets() {
    const assetsToLoad = [
      { key: 'apex', url: './assets/player-ferrari.glb' },
      { key: 'player', url: './assets/player-ferrari.glb' },
      { key: 'venom', url: './assets/sports.glb' },
      { key: 'sports', url: './assets/sports.glb' },
      { key: 'titan', url: './assets/suv.glb' },
      { key: 'suv', url: './assets/suv.glb' },
      { key: 'phantom', url: './assets/van.glb' },
      { key: 'van', url: './assets/van.glb' },
      { key: 'police', url: './assets/police.glb' },
      { key: 'taxi', url: './assets/taxi.glb' },
      { key: 'ambulance', url: './assets/ambulance.glb' },
      { key: 'delivery', url: './assets/delivery.glb' },
      { key: 'sedan', url: './assets/sedan.glb' },
      { key: 'sedan-sports', url: './assets/sedan-sports.glb' },
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

    // Lazy load heavy Lamborghini if needed
    if (progression.data.selectedVehicle === 'hyperion' || progression.data.unlockedVehicles.includes('hyperion')) {
      this.gltfLoader.load(
        './assets/player-lamborghini.glb',
        gltf => {
          this.assetPrototypes.hyperion = gltf.scene;
          if (progression.data.selectedVehicle === 'hyperion') {
            this.player.rebuildCarModel();
          }
        },
        undefined,
        () => {}
      );
    }

    const sel = progression.data.selectedVehicle || 'apex';
    const upg = progression.data.upgrades[sel] || {};
    this.player.setVehicle(sel, upg, progression.data.selectedPaint, progression.data.selectedGlow);
  }

  checkUrlChallenge() {
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
    audio.startEngine();

    this.state = 'COUNTDOWN';
    this.countdownStep = 3;
    this.countdownTimer = 0;

    progression.resetRunStats();
    this.traffic.clear();
    this.weapons.clear();
    this.turntableAngle = 0;

    const sel = progression.data.selectedVehicle || 'apex';
    const upg = progression.data.upgrades[sel] || {};
    this.player.setVehicle(sel, upg, progression.data.selectedPaint, progression.data.selectedGlow);
    this.player.reset();

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

    // Reset Checkpoint & Turret System
    this.checkpointDistance = 600;
    this.isStoppingForCheckpoint = false;
    this.player.isBrakingToHalt = false;
    this.turretSystem.cleanup();
    if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');
    if (this.ui.turretCrosshair) this.ui.turretCrosshair.classList.add('hidden');

    audio.startMusic();
    audio.play('boost');
    this.toast('GREEN LIGHT! GO GO GO!', 'green');
    this.vibrate(100);
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.turretSystem.cleanup();
    if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');
    if (this.ui.turretCrosshair) this.ui.turretCrosshair.classList.add('hidden');
    audio.stopEngine();
    audio.stopMusic();
    audio.play('collision');
    this.vibrate([100, 50, 200]);

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

  // Architecture Hook: Checkpoint 180-Degree Turret Sequence
  // Planned feature: At designated distance checkpoints, the car comes to a stop,
  // a motorized gunner turret mounts at the roof, shifting camera into a 180-degree forward turret view
  // to shoot down waves of airborne & highway drones/enemies before resuming the race.
  checkTurretCheckpointMilestone(distance) {
    // Current loop is pure car racing. Hook is prepared for turret stage integration.
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

  vibrate(pattern) {
    // 1. Mobile Navigator Vibrate
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
    // 2. Gamepad Dual-Rumble Vibration
    if (progression.data.settings.gamepadRumbleEnabled && navigator.getGamepads) {
      try {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
            const dur = Array.isArray(pattern) ? pattern[0] : pattern;
            gp.vibrationActuator.playEffect('dual-rumble', {
              startDelay: 0,
              duration: dur || 80,
              weakMagnitude: 0.6,
              strongMagnitude: 0.8
            });
          }
        }
      } catch (e) {}
    }
  }

  openGarage() {
    this.state = 'GARAGE';
    this.ui.hud.classList.add('hidden');
    this.ui.menuModal.classList.add('hidden');
    this.ui.gameoverModal.classList.add('hidden');
    this.ui.garageCoins.textContent = progression.data.coins;

    // Show Turntable Platform & Frame 3D Car
    if (this.turntableMesh) {
      this.turntableMesh.position.set(0, 0, -8);
      this.turntableMesh.visible = true;
    }
    this.player.mesh.position.set(0, 0.16, -8);
    this.player.x = 0;
    this.turntableAngle = 0;
    if (this.player.chassis) this.player.chassis.rotation.set(0, 0, 0);

    // Set Showroom Beauty View Camera
    this.camera.position.set(0, 2.0, -3.2);
    this.camera.lookAt(0, 0.75, -8);

    this.garageIndex = this.garageVehicleList.indexOf(progression.data.selectedVehicle);
    if (this.garageIndex < 0) this.garageIndex = 0;

    this.ui.garageModal.classList.remove('hidden');
    this.renderGarageCarousel();
  }

  closeGarage() {
    if (this.turntableMesh) this.turntableMesh.visible = false;
    this.ui.garageModal.classList.add('hidden');

    // Restore equipped player car
    this.player.setVehicle(
      progression.data.selectedVehicle,
      progression.data.upgrades[progression.data.selectedVehicle] || {},
      progression.data.selectedPaint,
      progression.data.selectedGlow
    );
    this.player.mesh.position.set(0, 0, -8);
    this.player.mesh.rotation.set(0, 0, 0);
    this.turntableAngle = 0;
    if (this.player.chassis) this.player.chassis.rotation.set(0, 0, 0);

    if (this.state === 'GARAGE') {
      this.state = 'MENU';
      this.camera.position.copy(this.defaultCamPos);
      this.camera.lookAt(0, 1.0, -8);
      this.ui.menuModal.classList.remove('hidden');
    }
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

    this.ui.garageCoins.textContent = progression.data.coins;
    this.ui.garageCarTitle.textContent = car.name;
    this.ui.garageCarTier.textContent = car.tier;
    this.ui.garageCarDesc.textContent = car.desc;

    // Upgrades
    const upg = progression.data.upgrades[carId] || { topSpeed: 0, accel: 0, handling: 0, nitro: 0, armor: 0 };
    const statRows = [
      { key: 'topSpeed', label: 'TOP SPEED', maxBase: 35 },
      { key: 'accel', label: 'ACCELERATION', maxBase: 45 },
      { key: 'handling', label: 'HANDLING & DRIFT', maxBase: 45 },
      { key: 'nitro', label: 'NITRO TANK', maxBase: 50 },
      { key: 'armor', label: 'HULL ARMOR', maxBase: 160 }
    ];

    let statsHtml = '';
    statRows.forEach(s => {
      const lvl = upg[s.key] || 0;
      const upgradeCost = (lvl + 1) * 200;
      const canUpgrade = isUnlocked && lvl < 5 && progression.data.coins >= upgradeCost;
      const upgradeBtnHtml = lvl >= 5
        ? '<span style="color:#00ff88; font-size:9px; font-weight:800;">MAX</span>'
        : `<button class="upgrade-stat-btn" data-car="${carId}" data-stat="${s.key}" data-cost="${upgradeCost}" style="cursor:pointer; background:rgba(0,217,255,0.18); border:1px solid #00d9ff; border-radius:4px; color:#fff; font-family:var(--font-mono); font-size:9px; font-weight:700; padding:2px 7px;" ${canUpgrade ? '' : 'disabled style="opacity:0.4;"'}>+ LVL ${lvl + 1} (${upgradeCost}🪙)</button>`;

      statsHtml += `
        <div class="spec-row">
          <div class="spec-label-row">
            <span>${s.label} (LVL ${lvl}/5)</span>
            ${upgradeBtnHtml}
          </div>
          <div class="spec-meter"><div class="spec-meter-fill" style="width: ${(car.baseStats[s.key] / s.maxBase) * 75 + lvl * 5}%"></div></div>
        </div>
      `;
    });

    // Daily Quests
    let questsHtml = `
      <div style="margin-top:16px; padding:12px; background:rgba(0,0,0,0.35); border-radius:10px; border:1px solid rgba(0,217,255,0.2);">
        <div style="font-family:var(--font-mono); font-size:10px; font-weight:800; color:#ffb800; letter-spacing:1.5px; margin-bottom:8px;">DAILY BOUNTIES</div>
    `;
    progression.data.dailyQuests.forEach(q => {
      const readyToClaim = !q.claimed && q.current >= q.target;
      questsHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-family:var(--font-mono); font-size:10px;">
          <span style="color:${q.claimed ? '#7f8c80' : '#e2e8f0'}">${q.desc} (${Math.min(q.target, q.current)}/${q.target})</span>
          ${q.claimed ? '<span style="color:#00ff88;">CLAIMED ✔</span>' : `<button class="claim-quest-btn" data-quest="${q.id}" style="cursor:pointer; background:${readyToClaim ? 'linear-gradient(135deg, #ffb800, #ff8800)' : 'rgba(255,255,255,0.08)'}; border:0; border-radius:4px; color:#000; font-weight:800; font-size:9px; padding:3px 8px;" ${readyToClaim ? '' : 'disabled'}>+${q.reward}🪙</button>`}
        </div>
      `;
    });
    questsHtml += `</div>`;

    this.ui.garageStatsList.innerHTML = statsHtml + questsHtml;

    // Equip / Unlock Button
    if (!isUnlocked) {
      this.ui.garageBuyBtn.textContent = `UNLOCK (${car.cost} COINS)`;
      this.ui.garageBuyBtn.disabled = progression.data.coins < car.cost;
      this.ui.garageBuyBtn.onclick = () => {
        if (progression.unlockVehicle(carId, car.cost)) {
          audio.play('fever');
          this.toast(`${car.name} UNLOCKED!`, 'green');
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
          this.toast(`CLAIMED +${reward} COINS! 🪙`, 'gold');
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
            <div class="achievement-title">${ach.title} ${isUnlocked ? '✔' : ''}</div>
            <div class="achievement-desc">${ach.desc}</div>
            <div class="achievement-reward">+${ach.reward}🪙 ${isUnlocked ? '(UNLOCKED)' : ''}</div>
          </div>
        </div>
      `;
    });
    this.ui.achievementsContainer.innerHTML = html;
  }

  // --- GAMEPAD POLLING ---
  pollGamepad() {
    if (!navigator.getGamepads) return { steer: 0, boost: false, drift: false };
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp || !gp.connected) continue;

      let steer = 0;
      if (Math.abs(gp.axes[0]) > 0.15) {
        steer = gp.axes[0]; // analog stick
      } else if (gp.buttons[14]?.pressed) {
        steer = -1; // D-pad left
      } else if (gp.buttons[15]?.pressed) {
        steer = 1; // D-pad right
      }

      const boost = gp.buttons[0]?.pressed || gp.buttons[7]?.value > 0.3; // A button or RT
      const drift = gp.buttons[1]?.pressed || gp.buttons[6]?.value > 0.3; // B button or LT

      if (gp.buttons[9]?.pressed) {
        this.togglePause();
      }

      return { steer, boost, drift };
    }
    return { steer: 0, boost: false, drift: false };
  }

  update(dt) {
    // 1. Countdown Animation State
    if (this.state === 'COUNTDOWN') {
      this.countdownTimer += dt;
      // Camera sweeps from side to rear chase cam
      const progress = Math.min(1, this.countdownTimer / 3.0);
      this.camera.position.lerpVectors(new THREE.Vector3(-4.2, 2.8, -13), this.defaultCamPos, progress);
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

    // Garage Turntable Spin
    if (this.state === 'GARAGE') {
      if (!this.isDraggingTurntable) {
        this.turntableAngle += dt * 0.45;
        if (this.player.chassis) this.player.chassis.rotation.y = this.turntableAngle;
        if (this.turntableMesh) this.turntableMesh.rotation.y = this.turntableAngle;
      }
      this.camera.position.set(0, 2.0, -3.2);
      this.camera.lookAt(0, 0.75, -8);
      return;
    }

    // --- 180° TURRET DEFENSE CHECKPOINT STATE ---
    if (this.state === 'TURRET_DEFENSE') {
      // 1. Camera smoothly locks into a dramatic third-person view showing the car, the mounted human gunner, the road, and sky targets
      const targetCamPos = new THREE.Vector3(this.player.x * 0.42, 3.4, this.player.mesh.position.z + 8.2);
      this.camera.position.lerp(targetCamPos, Math.min(1, dt * 7));
      const lookAimX = this.player.x * 0.28 - Math.sin(this.turretSystem.aimYaw) * 18;
      const lookAimY = 2.4 + Math.sin(this.turretSystem.aimPitch) * 12;
      this.camera.lookAt(lookAimX, lookAimY, -60);

      // 2. Keyboard spacebar / Enter firing in turret mode
      if (this.keys.has(' ') || this.keys.has('Enter')) {
        this.turretSystem.triggerFire();
      }

      // 3. Update Turret System
      this.turretSystem.update(dt, {
        onDroneKilled: (drone) => {
          this.score += 400 * this.multiplier;
          progression.activeRunStats.coinsEarned += 25;
          this.spawnScorePopup('+400 DRONE DESTROYED! 💥', '#ff0055');
          this.vibrate(60);
          this.camShake = 0.35;
          if (this.ui.turretDroneCount) {
            const alive = this.turretSystem.drones.filter(d => !d.isDestroyed).length;
            this.ui.turretDroneCount.textContent = `DRONES IN AIR: ${alive}`;
          }
        },
        onWaveAdvancing: (wave) => {
          this.toast(`⚠️ DRONE SQUADRON WAVE ${wave}/3 INCOMING!`, 'magenta');
          audio.play('fever');
          if (this.ui.turretWaveBadge) {
            this.ui.turretWaveBadge.textContent = `WAVE ${wave}/3`;
          }
        },
        onDefenseSecured: () => {
          this.toast('🏆 SECTOR AIRSPACE SECURED! +2,000 COINS', 'gold');
          progression.data.coins += 2000;
          progression.save();
          audio.play('fever');
          this.vibrate([100, 100, 300]);
          this.spawnScorePopup('+2,000 SECTOR CLEARED! 🏆', '#ffb800');
        },
        onComplete: () => {
          // Re-accelerate into racing!
          if (this.ui.turretCrosshair) this.ui.turretCrosshair.classList.add('hidden');
          this.state = 'RUNNING';
          audio.startEngine();
          audio.play('boost');
          this.player.isBrakingToHalt = false;
          this.player.speed = 28; // Launch instantly at 100 km/h!
          this.player.triggerSpeedBoost(1.55, 3.0);
          this.checkpointDistance += this.checkpointInterval;
          this.isStoppingForCheckpoint = false;
          this.toast('HYPERSONIC RELAUNCH! 🚀', 'cyan');
        }
      });

      return;
    }

    if (this.state !== 'RUNNING') return;

    // 2. Poll Inputs (Keyboard, Gamepad, Mouse)
    const gp = this.pollGamepad();
    let steerDir = gp.steer;

    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) steerDir -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) steerDir += 1;

    // Mouse Steer Option
    if (progression.data.settings.mouseSteerEnabled && Math.abs(steerDir) === 0) {
      const dx = this.mouseTargetX - this.player.x;
      if (Math.abs(dx) > 0.2) steerDir = Math.sign(dx) * Math.min(1, Math.abs(dx) * 0.8);
    }

    const isBoosting = this.keys.has(' ') || this.keys.has('Shift') || gp.boost;
    const isDrifting = (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S') || gp.drift) && Math.abs(steerDir) > 0;

    const sens = progression.data.settings.steeringSensitivity || 1.0;
    this.player.setBoost(isBoosting);
    this.player.setDrift(isDrifting);
    this.player.steer(steerDir, dt, sens);
    this.player.update(dt, () => {
      // Landing callback from stunt jump
      audio.play('ramp_land');
      this.camShake = 0.55;
      this.vibrate(80);
      this.score += 350 * this.multiplier;
      progression.activeRunStats.rampsJumped++;
      this.spawnScorePopup('+350 STUNT AIRTIME! 🚀', '#ffea00');
    });

    if (isDrifting) {
      this.score += Math.floor(dt * 90);
      progression.activeRunStats.driftPoints += Math.floor(dt * 90);
      this.player.addNitro(dt * 12);
      if (Math.random() < 0.08) {
        this.spawnScorePopup('+50 DRIFT', '#9d4edd');
      }
    }

    // 3. Ground Speed & Km/h (1:1 Physical Calibration: 1 m/s = 3.6 km/h)
    const currentSpeed = this.player.speed;
    const kmh = currentSpeed * 3.6;
    if (kmh > progression.activeRunStats.topSpeed) {
      progression.activeRunStats.topSpeed = kmh;
    }

    this.distance += currentSpeed * dt;
    this.score += Math.floor(currentSpeed * dt * 1.5 * this.multiplier);

    // Milestone Checkpoint Approach & 180° Turret Defense Braking
    if (this.distance >= this.checkpointDistance - 80 && !this.isStoppingForCheckpoint) {
      this.isStoppingForCheckpoint = true;
      this.player.isBrakingToHalt = true;
      audio.play('turret_warning');
      this.toast('⚠️ AIR DEFENSE CHECKPOINT AHEAD — BRING VEHICLE TO COMPLETE STOP!', 'magenta');
    }

    if (this.isStoppingForCheckpoint) {
      this.player.isBrakingToHalt = true;
      if (Math.random() < 0.4) {
        this.player.spawnSmokeParticle(new THREE.Vector3(this.player.x, 0, this.player.mesh.position.z + 1.2));
      }
      if (this.player.speed <= 0.4) {
        this.player.speed = 0;
        this.player.isBrakingToHalt = false;
        this.isStoppingForCheckpoint = false;
        this.state = 'TURRET_DEFENSE';
        audio.stopEngine();
        audio.play('turret_deploy');
        if (this.ui.checkpointBanner) {
          this.ui.checkpointBanner.classList.remove('hidden');
          setTimeout(() => {
            if (this.ui.checkpointBanner) this.ui.checkpointBanner.classList.add('hidden');
          }, 2400);
        }
        if (this.ui.turretCrosshair) this.ui.turretCrosshair.classList.remove('hidden');
        this.turretSystem.startDefense(1);
        return;
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
    audio.updateEngine(kmh, this.player.isBoosting, isDrifting);

    // 5. World Scrolling & Jump Ramps / Speed Panels Detection
    this.world.update(dt, currentSpeed, this.distance, {
      onChallengeDefeated: () => {
        this.toast('🏆 RIVAL CHALLENGE CRUSHED! +1000 COINS', 'gold');
        audio.play('fever');
        this.vibrate([100, 50, 200]);
        progression.activeRunStats.coinsEarned += 1000;
        progression.unlockAchievement('rival_vanquisher');
        this.spawnScorePopup('+1,000 RIVAL CONQUERED!', '#ffb800');
      }
    });

    // Check Stunt Jump Ramps Collision (Forward-Launching Wedges)
    for (const ramp of this.world.jumpRamps) {
      const rampWorldZ = ramp.parent.position.z + ramp.mesh.position.z;
      const dz = Math.abs(rampWorldZ - this.player.mesh.position.z);
      const dx = Math.abs(ramp.lane - this.player.x);
      if (dz < 2.4 && dx < 1.4 && !ramp.triggered && !this.player.isAirborne) {
        ramp.triggered = true;
        this.player.triggerJump(17);
        audio.play('ramp_launch');
        this.toast('STUNT AIRTIME LAUNCH! 🚀', 'gold');
        this.score += 400 * this.multiplier;
        this.spawnScorePopup('+400 STUNT JUMP! 🚀', '#ffea00');
        this.vibrate([60, 40, 80]);
        this.camShake = 0.35;
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
        this.spawnScorePopup('+300 HYPERSONIC BOOST! ⚡', '#00f0ff');
        this.toast('HYPERSONIC BOOST ACTIVATED! ⚡', 'cyan');
        this.vibrate(100);
      }
    }

    // Tactical Slipstream / Drafting Behind Traffic
    let isDrafting = false;
    for (const v of this.traffic.vehicles) {
      if (!v.hit && Math.abs(v.mesh.position.x - this.player.x) < 1.35) {
        const distAhead = this.player.mesh.position.z - v.mesh.position.z;
        if (distAhead > 3.0 && distAhead < 20.0) {
          isDrafting = true;
          break;
        }
      }
    }

    if (isDrafting && currentSpeed > 35) {
      this.draftTimer = (this.draftTimer || 0) + dt;
      if (this.draftTimer >= 1.2) {
        this.draftTimer = 0;
        this.player.triggerSpeedBoost(1.35, 1.6);
        audio.play('boost');
        this.score += 250 * this.multiplier;
        this.spawnScorePopup('+250 SLINGSHOT OVERTAKE! 🌪️', '#ff8800');
        this.toast('SLINGSHOT OVERTAKE! 🌪️', 'gold');
        this.vibrate([60, 40]);
      }
    } else {
      this.draftTimer = Math.max(0, (this.draftTimer || 0) - dt * 2);
    }

    // 6. Traffic & Obstacles System
    this.traffic.update(dt, currentSpeed, this.player.x, this.player.mesh.position.z, this.distance, {
      isMagnetActive: this.player.magnetActive,
      onNearMiss: (v) => {
        progression.activeRunStats.nearMisses++;
        this.score += 250 * this.multiplier;
        this.player.addNitro(18);
        audio.play('nearmiss');
        this.vibrate(40);
        this.spawnScorePopup(`+${250 * this.multiplier} NEAR MISS!`, '#00d9ff');

        this.multiplier = Math.min(5, this.multiplier + 1);
        this.multiplierTimer = 4.0;
        if (this.multiplier >= 4) {
          this.isFever = true;
          this.ui.multiplier.classList.add('fever');
          audio.play('fever');
          this.toast(`FEVER MODE x${this.multiplier}! 🔥`, 'magenta');
        } else {
          this.toast(`NEAR MISS! x${this.multiplier}`, 'cyan');
        }
      },
      onDrafting: (delta, v) => {
        this.player.addNitro(delta * 22);
        this.score += Math.floor(delta * 120);
        this.ui.overlayWarp.style.opacity = '0.35';
      }
    });

    // 8. Collisions: Traffic Cars & Obstacles
    if (!this.player.isAirborne) {
      // Traffic cars collision (Hard Solid Physical Impact)
      for (const v of this.traffic.vehicles) {
        if (v.hit) continue;
        const dz = Math.abs(v.mesh.position.z - this.player.mesh.position.z);
        const dx = Math.abs(v.mesh.position.x - this.player.mesh.position.x);

        if (dz < (v.length * 0.45 + 1.2) && dx < (v.width * 0.38 + 0.65)) {
          v.hit = true;
          const bounceDir = this.player.x < v.mesh.position.x ? -1 : 1;

          if (this.player.isBoosting && this.multiplier >= 4) {
            // Overdrive Ramming
            this.traffic.spawnExplosion(v.mesh.position, 0xffaa00, 24);
            audio.play('collision');
            this.vibrate(80);
            v.mesh.position.y += 5;
            v.mesh.rotation.x += 2;
            this.score += 1000;
            this.camShake = 0.4;
            this.toast('RAMMING OVERDRIVE! 💥', 'gold');
            this.spawnScorePopup('+1,000 RAM! 💥', '#ffb800');
          } else {
            // Hard Physical Impasse Collision:
            // 1. Heavy speed cut (48% speed loss)
            this.player.speed *= 0.52;
            // 2. Lateral recoil bounce impulse
            this.player.x = THREE.MathUtils.clamp(this.player.x + bounceDir * 1.35, -7.2, 7.2);
            this.player.steerAngle += bounceDir * 0.3;
            // 3. Traffic car deflection & spin
            v.speed = Math.max(v.speed, this.player.speed * 0.85);
            v.mesh.position.x = THREE.MathUtils.clamp(v.mesh.position.x - bounceDir * 1.6, -7.5, 7.5);
            v.mesh.rotation.y += bounceDir * 0.5;

            // 4. Proportional Hull Damage
            const dmg = this.player.takeDamage(24);
            progression.activeRunStats.damageTaken += dmg;
            this.camShake = 0.65;
            audio.play('collision');
            this.vibrate([80, 50, 140]);
            this.traffic.spawnExplosion(v.mesh.position, 0xff2a44, 22);
            this.showDamageOverlay();
            this.toast('HARD IMPACT! -24% HULL 💥', 'magenta');
            if (this.player.hull <= 0) {
              this.gameOver();
              return;
            }
          }
        }
      }

      // Obstacles collision (Spike strip, Barrel, Barrier - Hard Solid Impasses)
      for (const o of this.traffic.obstacles) {
        if (o.hit) continue;
        const dz = Math.abs(o.mesh.position.z - this.player.mesh.position.z);
        const dx = Math.abs(o.mesh.position.x - this.player.mesh.position.x);

        if (dz < 1.8 && dx < 1.6) {
          o.hit = true;
          const bounceDir = this.player.x < o.mesh.position.x ? -1 : 1;
          if (o.isSpike) {
            // Spike strip puncture: temporary speed drop
            const dmg = this.player.takeDamage(12);
            progression.activeRunStats.damageTaken += dmg;
            this.player.speed *= 0.45;
            this.camShake = 0.45;
            audio.play('collision');
            this.vibrate(90);
            this.toast('TIRES PUNCTURED BY SPIKES! ⚠️', 'magenta');
          } else {
            // Hard physical barrier / barrel stop & damage
            const dmg = this.player.takeDamage(18);
            progression.activeRunStats.damageTaken += dmg;
            this.player.speed *= 0.48;
            this.player.x = THREE.MathUtils.clamp(this.player.x + bounceDir * 1.1, -7.2, 7.2);
            this.camShake = 0.55;
            audio.play('collision');
            this.vibrate([60, 40, 100]);
            this.traffic.spawnExplosion(o.mesh.position, 0xff6600, 18);
            this.toast('BARRIER COLLISION! 🛑', 'magenta');
          }
          this.showDamageOverlay();
          if (this.player.hull <= 0) {
            this.gameOver();
            return;
          }
        }
      }
    }

    // Collectibles Pickup
    for (let i = this.traffic.collectibles.length - 1; i >= 0; i--) {
      const c = this.traffic.collectibles[i];
      if (c.mesh.position.distanceTo(this.player.mesh.position) < 2.4) {
        audio.play('pickup');
        this.traffic.spawnExplosion(c.mesh.position, 0xffea00, 12);
        this.vibrate(30);

        if (c.type === 'coin') {
          progression.activeRunStats.coinsEarned += 10;
          this.score += 150;
          this.spawnScorePopup('+10 COINS', '#ffb800');
        } else if (c.type === 'nitro') {
          this.player.addNitro(60);
          this.toast('NITRO TANK REFILLED! ⚡', 'cyan');
        } else if (c.type === 'shield') {
          this.player.activateShield(8);
          audio.play('shield');
          this.toast('HEX FORCEFIELD ONLINE! 🛡️', 'magenta');
        } else if (c.type === 'magnet') {
          this.player.activateMagnet(10);
          this.toast('COIN MAGNET ACTIVE! 🧲', 'green');
        } else if (c.type === 'repair') {
          this.player.repair(35);
          audio.play('shield');
          this.toast('+35% HULL RESTORED! 🔧', 'green');
          this.showDamageOverlay();
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
          this.toast('🏆 1ST PLACE FINISH! SPRINT CHAMPION! +1,500 COINS', 'gold');
        } else {
          progression.data.coins += 400;
          progression.save();
          this.toast(`SPRINT FINISHED: ${this.racePosition}TH PLACE! +400 COINS`, 'cyan');
        }
        this.gameOver();
        return;
      }
    }

    // 10. Dynamic Camera Motion & Wide-Angle Long Highway Sightline
    const dynamicFov = 64 + Math.min(18, (kmh / 360) * 16) + (this.player.isBoosting ? 8 : 0) + (this.player.isAirborne ? 4 : 0);
    this.camera.fov += (dynamicFov - this.camera.fov) * Math.min(1, dt * 6.5);
    this.camera.updateProjectionMatrix();

    // High-speed asphalt micro-rumble
    const speedRumble = (kmh > 220) ? Math.min(0.06, ((kmh - 220) / 140) * 0.04) : 0;
    this.camShake = Math.max(0, this.camShake - dt * 2.2);
    const totalShake = this.camShake + speedRumble;

    // Cinematic GT Chase Cam: Elevated rear angle that reveals 150+ meters of open highway ahead
    const targetCamX = this.player.x * 0.52 + (Math.random() - 0.5) * totalShake;
    const targetCamY = 3.8 + this.player.verticalY * 0.55 + (Math.random() - 0.5) * totalShake;
    const targetCamZ = 1.2 + (this.player.isBoosting ? 0.8 : 0);

    this.camera.position.x += (targetCamX - this.camera.position.x) * Math.min(1, dt * 8);
    this.camera.position.y += (targetCamY - this.camera.position.y) * Math.min(1, dt * 8);
    this.camera.position.z += (targetCamZ - this.camera.position.z) * Math.min(1, dt * 6);

    // Look far down the highway (Z = -85m) towards the horizon so all 3 lanes, oncoming cars, ramps, and horizon are fully visible
    this.camera.lookAt(
      this.player.x * 0.25,
      1.85 + this.player.verticalY * 0.38,
      -85
    );

    // Dynamic speed warp radial lines
    const warpOpacity = this.player.isBoosting ? '0.85' : (kmh > 260 ? String(Math.min(0.65, (kmh - 260) / 100)) : '0');
    this.ui.overlayWarp.style.opacity = warpOpacity;
    this.ui.overlayShield.style.opacity = this.player.shieldActive ? '0.75' : '0';

    this.updateHud(kmh);
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

    this.ui.speedNum.textContent = Math.round(kmh);
    const speedRatio = Math.min(100, (kmh / 360) * 100);
    this.ui.speedBar.style.width = `${speedRatio}%`;

    // Real-Time Gear & RPM Tachometer HUD
    if (this.ui.gearBadge) {
      this.ui.gearBadge.textContent = `GEAR ${audio.getGear()}`;
    }

    if (this.ui.rpmNum && this.ui.rpmBar) {
      const rpm = audio.getRpm();
      this.ui.rpmNum.textContent = `${rpm.toLocaleString()} RPM`;
      const rpmPct = Math.min(100, Math.max(8, (rpm / 8000) * 100));
      this.ui.rpmBar.style.width = `${rpmPct}%`;
    }

    const nitroPct = (this.player.nitro / this.player.maxNitro) * 100;
    this.ui.nitroBar.style.width = `${nitroPct}%`;
    this.ui.nitroTrack.classList.toggle('nitro-ready', nitroPct >= 95);

    // Highway Distance Radar
    const targetMilestone = this.world.challengeDistance || 10000;
    const radarPct = Math.min(100, (this.distance / targetMilestone) * 100);
    this.ui.radarProgress.style.width = `${radarPct}%`;
    this.ui.radarPinPlayer.style.left = `${radarPct}%`;
  }

  loop(now) {
    const dt = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.game = new RoadRiotGame();
});
