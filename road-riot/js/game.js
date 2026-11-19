// Road Riot 3D - Flagship Game Engine & State Controller
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

import { audio } from './audio.js';
import { WorldManager } from './world.js';
import { PlayerCar, VEHICLE_ROSTER } from './player.js';
import { TrafficManager } from './traffic.js';
import { WeaponSystem } from './weapons.js';
import { progression } from './progression.js';

class RoadRiotGame {
  constructor() {
    this.canvas = document.querySelector('#game-canvas');
    this.mobileDevice = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

    // Three.js Core
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.mobileDevice,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobileDevice ? 1.4 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0c1322, 45, 230);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
    this.camera.position.set(0, 7.2, 8.5);

    // State
    this.state = 'MENU'; // 'MENU', 'RUNNING', 'PAUSED', 'GAMEOVER', 'GARAGE'
    this.distance = 0;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.isFever = false;
    this.camShake = 0;
    this.keys = new Set();
    this.touchSteerX = 0;

    // Assets Prototypes
    this.assetPrototypes = {};
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./assets/draco/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Systems
    this.world = new WorldManager(this.scene);
    this.traffic = new TrafficManager(this.scene, this.assetPrototypes);
    this.player = new PlayerCar(this.scene, this.assetPrototypes);
    this.weapons = new WeaponSystem(this.scene, this.traffic, audio);

    // Bind UI & Inputs
    this.cacheDomElements();
    this.bindEvents();
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
      nitroBar: document.querySelector('#hud-nitro-fill'),
      nitroTrack: document.querySelector('#hud-nitro-track'),
      weaponPanel: document.querySelector('#weapon-panel'),
      weaponSlot: document.querySelector('#weapon-slot'),
      weaponName: document.querySelector('#weapon-name'),
      announcer: document.querySelector('#announcer-zone'),
      overlayDamage: document.querySelector('#overlay-damage'),
      overlayWarp: document.querySelector('#overlay-warp'),
      overlayShield: document.querySelector('#overlay-shield'),

      // Modals
      menuModal: document.querySelector('#menu-modal'),
      startBtn: document.querySelector('#start-btn'),
      garageBtn: document.querySelector('#garage-btn'),
      networkBtn: document.querySelector('#network-btn'),
      audioBtn: document.querySelector('#audio-btn'),

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
      paintSwatches: document.querySelectorAll('.paint-swatch'),
      glowSwatches: document.querySelectorAll('.glow-swatch'),

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
      challengeFriendBtn: document.querySelector('#challenge-friend-btn'),
      shareTwitterBtn: document.querySelector('#share-twitter-btn'),
      shareWhatsappBtn: document.querySelector('#share-whatsapp-btn'),

      // Arcade Network Modal
      networkModal: document.querySelector('#network-modal'),
      networkCloseBtn: document.querySelector('#network-close-btn')
    };
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
      if ((e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') && this.state === 'RUNNING') {
        this.useActiveWeapon();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key);
    });

    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Touch controls
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const key = btn.dataset.key;
      const onDown = ev => {
        ev.preventDefault();
        if (key === 'Weapon') {
          this.useActiveWeapon();
        } else {
          this.keys.add(key);
        }
      };
      const onUp = ev => {
        ev.preventDefault();
        if (key !== 'Weapon') this.keys.delete(key);
      };
      btn.addEventListener('pointerdown', onDown, { passive: false });
      btn.addEventListener('pointerup', onUp, { passive: false });
      btn.addEventListener('pointercancel', onUp, { passive: false });
    });

    // Button actions
    this.ui.startBtn?.addEventListener('click', () => this.startRun());
    this.ui.restartBtn?.addEventListener('click', () => this.startRun());
    this.ui.garageBtn?.addEventListener('click', () => this.openGarage());
    this.ui.garageCloseBtn?.addEventListener('click', () => this.closeGarage());
    this.ui.gameoverGarageBtn?.addEventListener('click', () => {
      this.ui.gameoverModal.classList.add('hidden');
      this.openGarage();
    });

    this.ui.networkBtn?.addEventListener('click', () => this.openNetworkModal());
    this.ui.networkCloseBtn?.addEventListener('click', () => this.closeNetworkModal());

    this.ui.audioBtn?.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      this.ui.audioBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Challenge Friend Button
    this.ui.challengeFriendBtn?.addEventListener('click', () => {
      const text = progression.getShareText(
        progression.activeRunStats.distance,
        progression.activeRunStats.score,
        progression.activeRunStats.topSpeed
      );
      const url = progression.generateShareUrl(
        progression.activeRunStats.distance,
        progression.activeRunStats.score
      );

      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          this.toast('CHALLENGE LINK COPIED TO CLIPBOARD! 📋', 'green');
        }).catch(() => {
          this.toast('SHARE LINK: ' + url, 'gold');
        });
      }
    });

    // Social Sharing Buttons
    this.ui.shareTwitterBtn?.addEventListener('click', () => {
      const text = encodeURIComponent(
        `I just scored ${progression.activeRunStats.score} in Road Riot 3D on VALIXIS Games! Can you beat me? 🏎️🔥`
      );
      const url = encodeURIComponent(
        progression.generateShareUrl(progression.activeRunStats.distance, progression.activeRunStats.score)
      );
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    });

    this.ui.shareWhatsappBtn?.addEventListener('click', () => {
      const text = encodeURIComponent(
        progression.getShareText(
          progression.activeRunStats.distance,
          progression.activeRunStats.score,
          progression.activeRunStats.topSpeed
        )
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    // Garage Carousel & Swatches
    this.garageVehicleList = Object.keys(VEHICLE_ROSTER);
    this.garageIndex = this.garageVehicleList.indexOf(progression.data.selectedVehicle) || 0;

    this.ui.garagePrevBtn?.addEventListener('click', () => {
      this.garageIndex = (this.garageIndex - 1 + this.garageVehicleList.length) % this.garageVehicleList.length;
      this.renderGarageCarousel();
    });

    this.ui.garageNextBtn?.addEventListener('click', () => {
      this.garageIndex = (this.garageIndex + 1) % this.garageVehicleList.length;
      this.renderGarageCarousel();
    });

    // Paint and Glow Swatches
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
      { key: 'van', url: './assets/van.glb' }
    ];

    assetsToLoad.forEach(item => {
      this.gltfLoader.load(
        item.url,
        gltf => {
          this.assetPrototypes[item.key] = gltf.scene;
          this.player.assetPrototypes = this.assetPrototypes;
          this.traffic.assetPrototypes = this.assetPrototypes;
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

    // Configure equipped vehicle from progression save
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

  startRun() {
    audio.resume();
    audio.startEngine();
    audio.startMusic();

    this.distance = 0;
    this.score = 0;
    this.multiplier = 1;
    this.multiplierTimer = 0;
    this.isFever = false;
    this.camShake = 0;
    this.state = 'RUNNING';

    progression.resetRunStats();
    this.traffic.clear();
    this.weapons.clear();

    const sel = progression.data.selectedVehicle || 'apex';
    const upg = progression.data.upgrades[sel] || {};
    this.player.setVehicle(sel, upg, progression.data.selectedPaint, progression.data.selectedGlow);
    this.player.mesh.position.set(0, 0, -8);
    this.player.x = 0;

    // Hide menus, show HUD
    this.ui.menuModal.classList.add('hidden');
    this.ui.gameoverModal.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');

    this.toast('GREEN LIGHT! GO GO GO!', 'green');
    audio.play('boost');
  }

  gameOver() {
    this.state = 'GAMEOVER';
    audio.stopEngine();
    audio.play('collision');

    progression.activeRunStats.distance = this.distance;
    progression.activeRunStats.score = this.score;
    progression.recordRunEnd();

    // Populate Game Over modal
    this.ui.runDist.textContent = `${Math.floor(this.distance)}m`;
    this.ui.runScore.textContent = this.score.toLocaleString();
    this.ui.runSpeed.textContent = `${Math.round(progression.activeRunStats.topSpeed)} KM/H`;
    this.ui.runNearMiss.textContent = progression.activeRunStats.nearMisses;
    this.ui.runCoinsAwarded.textContent = `+${progression.activeRunStats.coinsEarned} COINS`;

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
      this.toast('PAUSED', 'gold');
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      audio.startEngine();
      this.toast('RESUMED', 'green');
    }
  }

  useActiveWeapon() {
    if (this.player.activeWeapon === 'missile') {
      this.weapons.fireMissile(this.player.mesh.position.x, 0.8, this.player.mesh.position.z - 2.5);
      this.player.activeWeapon = null;
      this.updateWeaponHud();
    } else if (this.player.activeWeapon === 'emp') {
      this.weapons.triggerEmp(this.player.mesh.position);
      this.player.activeWeapon = null;
      this.updateWeaponHud();
    }
  }

  updateWeaponHud() {
    const w = this.player.activeWeapon;
    if (w) {
      this.ui.weaponSlot.classList.add('active');
      this.ui.weaponSlot.textContent = w === 'missile' ? '🚀' : '⚡';
      this.ui.weaponName.textContent = w.toUpperCase();
    } else {
      this.ui.weaponSlot.classList.remove('active');
      this.ui.weaponSlot.textContent = '—';
      this.ui.weaponName.textContent = 'NO WEAPON';
    }
  }

  toast(text, theme = 'cyan') {
    const el = document.createElement('div');
    el.className = `floating-toast ${theme}`;
    el.textContent = text;
    this.ui.announcer.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  openGarage() {
    this.state = 'GARAGE';
    this.ui.garageCoins.textContent = progression.data.coins;
    this.ui.garageModal.classList.remove('hidden');
    this.renderGarageCarousel();
  }

  closeGarage() {
    this.ui.garageModal.classList.add('hidden');
    if (this.state === 'GARAGE') {
      this.state = 'MENU';
      this.ui.menuModal.classList.remove('hidden');
    }
  }

  renderGarageCarousel() {
    const carId = this.garageVehicleList[this.garageIndex] || 'apex';
    const car = VEHICLE_ROSTER[carId] || VEHICLE_ROSTER.apex;
    const isUnlocked = progression.data.unlockedVehicles.includes(carId);
    const isSelected = progression.data.selectedVehicle === carId;

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

    // Daily Quests Section
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

    // Attach upgrade button clicks
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

    // Attach quest claim clicks
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

  openNetworkModal() {
    this.ui.networkModal.classList.remove('hidden');
  }

  closeNetworkModal() {
    this.ui.networkModal.classList.add('hidden');
  }

  update(dt) {
    if (this.state !== 'RUNNING') return;

    // 1. Controls
    let steerDir = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) steerDir -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) steerDir += 1;

    const isBoosting = this.keys.has(' ') || this.keys.has('Shift');
    const isDrifting = (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S')) && Math.abs(steerDir) > 0;

    this.player.setBoost(isBoosting);
    this.player.setDrift(isDrifting);
    this.player.steer(steerDir, dt);
    this.player.update(dt);

    if (isDrifting) {
      audio.play('drift');
      this.score += Math.floor(dt * 80);
      this.player.addNitro(dt * 8);
    }

    // 2. Highway & Distance
    const currentSpeed = this.player.speed;
    const kmh = currentSpeed * 9.5;
    if (kmh > progression.activeRunStats.topSpeed) {
      progression.activeRunStats.topSpeed = kmh;
    }

    this.distance += currentSpeed * dt;
    this.score += Math.floor(currentSpeed * dt * 2.2 * this.multiplier);

    // Dynamic Multiplier & Fever
    if (this.multiplierTimer > 0) {
      this.multiplierTimer -= dt;
      if (this.multiplierTimer <= 0 && this.multiplier > 1) {
        this.multiplier = 1;
        this.isFever = false;
        this.ui.multiplier.classList.remove('fever');
      }
    }

    // 3. Audio & Engine
    audio.updateEngine(currentSpeed, this.player.isBoosting, this.player.topSpeed * 1.5);

    // 4. World Update
    this.world.update(dt, currentSpeed, this.distance, () => {
      this.toast('🏆 RIVAL CHALLENGE CRUSHED! +1000 COINS', 'gold');
      audio.play('fever');
      progression.activeRunStats.coinsEarned += 1000;
    });

    // 5. Traffic & Obstacles
    this.traffic.update(dt, currentSpeed, this.player.x, this.player.mesh.position.z, this.distance, {
      isMagnetActive: this.player.magnetActive,
      onNearMiss: (v) => {
        progression.activeRunStats.nearMisses++;
        this.score += 250 * this.multiplier;
        this.player.addNitro(18);
        audio.play('nearmiss');

        // Multiplier streak
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
        this.ui.overlayWarp.style.opacity = '0.3';
      }
    });

    // 6. Weapons & Explosions
    this.weapons.update(dt, (destroyedVehicle) => {
      progression.activeRunStats.vehiclesDestroyed++;
      progression.activeRunStats.coinsEarned += 25;
      this.score += 500 * this.multiplier;
      this.toast('💥 TARGET DESTROYED! +500', 'magenta');
    });

    // 7. Vehicle & Obstacle Collisions
    for (const v of this.traffic.vehicles) {
      if (v.hit) continue;
      const dz = Math.abs(v.mesh.position.z - this.player.mesh.position.z);
      const dx = Math.abs(v.mesh.position.x - this.player.mesh.position.x);

      if (dz < (v.length * 0.45 + 1.2) && dx < (v.width * 0.45 + 0.9)) {
        v.hit = true;
        if (this.player.isBoosting && this.multiplier >= 4) {
          // Ramming mode during Fever/Overdrive
          this.traffic.spawnExplosion(v.mesh.position, 0xffaa00, 24);
          audio.play('collision');
          v.mesh.position.y += 5;
          v.mesh.rotation.x += 2;
          this.score += 1000;
          this.camShake = 0.4;
          this.toast('RAMMING OVERDRIVE! 💥', 'gold');
        } else {
          const dmg = this.player.takeDamage(22);
          this.camShake = 0.55;
          audio.play('collision');
          this.traffic.spawnExplosion(v.mesh.position, 0xff2a44, 18);
          this.showDamageOverlay();
          if (this.player.hull <= 0) {
            this.gameOver();
            return;
          }
        }
      }
    }

    // Obstacle collisions
    for (const o of this.traffic.obstacles) {
      if (o.hit) continue;
      const dz = Math.abs(o.mesh.position.z - this.player.mesh.position.z);
      const dx = Math.abs(o.mesh.position.x - this.player.mesh.position.x);

      if (dz < 1.8 && dx < 1.6) {
        o.hit = true;
        const dmg = this.player.takeDamage(14);
        this.camShake = 0.35;
        audio.play('collision');
        this.traffic.spawnExplosion(o.mesh.position, 0xff6600, 12);
        this.showDamageOverlay();
        if (this.player.hull <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    // Collectible pick up
    for (let i = this.traffic.collectibles.length - 1; i >= 0; i--) {
      const c = this.traffic.collectibles[i];
      if (c.mesh.position.distanceTo(this.player.mesh.position) < 2.4) {
        audio.play('pickup');
        this.traffic.spawnExplosion(c.mesh.position, 0xffea00, 12);

        if (c.type === 'coin') {
          progression.activeRunStats.coinsEarned += 10;
          this.score += 150;
        } else if (c.type === 'nitro') {
          this.player.addNitro(50);
          this.toast('+50% NITRO', 'cyan');
        } else if (c.type === 'shield') {
          this.player.activateShield(8);
          audio.play('shield');
          this.toast('HEX SHIELD ACTIVATED! 🛡️', 'magenta');
        } else if (c.type === 'magnet') {
          this.player.activateMagnet(9);
          this.toast('COIN MAGNET ACTIVE! 🧲', 'green');
        } else if (c.type === 'missile' || c.type === 'emp') {
          this.player.activeWeapon = c.type;
          this.updateWeaponHud();
          this.toast(`${c.type.toUpperCase()} READY! [SPACE / E]`, 'gold');
        }

        this.scene.remove(c.mesh);
        this.traffic.collectibles.splice(i, 1);
      }
    }

    // 8. Dynamic Camera Physics
    const targetFov = this.player.isBoosting ? 74 : 58;
    this.camera.fov += (targetFov - this.camera.fov) * dt * 4;
    this.camera.updateProjectionMatrix();

    // Camera follow with soft lag & shake
    this.camShake = Math.max(0, this.camShake - dt * 2.0);
    const targetCamX = this.player.x * 0.38 + (Math.random() - 0.5) * this.camShake;
    const targetCamY = 7.2 + (Math.random() - 0.5) * this.camShake;
    this.camera.position.x += (targetCamX - this.camera.position.x) * dt * 5.5;
    this.camera.position.y = targetCamY;
    this.camera.lookAt(this.player.x * 0.15, 1.2, -12);

    // 9. Warp overlay update
    this.ui.overlayWarp.style.opacity = this.player.isBoosting ? '0.65' : '0';
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

    // Multiplier
    this.ui.multiplier.textContent = `x${this.multiplier}`;

    // Hull
    const hullPct = Math.max(0, (this.player.hull / this.player.maxHull) * 100);
    this.ui.hullBar.style.width = `${hullPct}%`;
    if (hullPct < 30) {
      this.ui.hullBox.classList.add('hull-low');
    } else {
      this.ui.hullBox.classList.remove('hull-low');
    }

    // Speedometer
    this.ui.speedNum.textContent = Math.round(kmh);
    const speedRatio = Math.min(100, (kmh / 320) * 100);
    this.ui.speedBar.style.width = `${speedRatio}%`;

    // Nitro
    const nitroPct = (this.player.nitro / this.player.maxNitro) * 100;
    this.ui.nitroBar.style.width = `${nitroPct}%`;
    if (nitroPct >= 95) {
      this.ui.nitroTrack.classList.add('nitro-ready');
    } else {
      this.ui.nitroTrack.classList.remove('nitro-ready');
    }
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
