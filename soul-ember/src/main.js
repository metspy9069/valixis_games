/**
 * VALIXIS GAMES STUDIO - SOUL EMBER
 * Modular Engine Bootstrap & Coordinator.
 * ZERO EMOJIS. ZERO EXTERNAL IMAGES. 100% PROCEDURAL VECTOR & HARDWARE PIPELINE.
 */

import { WORLD, BIOMES } from './core/Constants.js';
import { VectorIcons } from './core/VectorIcons.js';
import { AudioSys } from './core/AudioSynth.js';
import { InputManager } from './core/InputManager.js';
import { SpatialGrid } from './core/SpatialGrid.js';
import { SpriteEngine } from './core/SpriteEngine.js';
import { CombatEngine } from './systems/CombatEngine.js';
import { LightingEngine } from './systems/LightingEngine.js';
import { UIManager } from './ui/UIManager.js';
import { Player } from './entities/Player.js';
import { UPGRADES } from './data/UpgradesData.js';
import { HEROES } from './data/HeroesData.js';

export class GameEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Subsystems
    this.sprites = new SpriteEngine();
    this.grid = new SpatialGrid(96);
    this.audio = AudioSys;
    this.combat = new CombatEngine(this.audio, this.grid);
    this.lighting = new LightingEngine(this.width, this.height);
    this.ui = new UIManager(this.audio);
    this.input = null;

    // Entities
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.activeBoss = null;

    // State
    this.state = 'START';
    this.selectedHero = 'pyro';
    this.currentBiome = BIOMES.crypt;
    this.runTime = 0;
    this.killCount = 0;
    this.bankedGold = 0;
    this.lastFrameTime = performance.now();
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', () => this.resize());

    this.input = new InputManager(this.canvas);
    this.sprites.init();
    this.player = new Player(this.selectedHero);

    this._bindEvents();
    this._startLoop();
    console.log('Soul Ember Modular Engine Initialized. Zero Emojis. Zero External Images.');
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.lighting) {
      this.lighting.resize(this.width, this.height);
    }
  }

  _bindEvents() {
    this.input.onDash = () => {
      if (this.state === 'PLAYING') {
        this.player.dash(this.audio);
      }
    };

    this.input.onUltimate = () => {
      if (this.state === 'PLAYING') {
        const ult = this.player.triggerUltimate(this.audio);
        if (ult) {
          this._executeUltimate(ult);
        }
      }
    };

    this.input.onPause = () => {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSE';
        document.getElementById('pause-modal').style.display = 'flex';
      } else if (this.state === 'PAUSE') {
        this.state = 'PLAYING';
        document.getElementById('pause-modal').style.display = 'none';
      }
    };
  }

  _executeUltimate(ult) {
    // Screen wipe visual
    this.floatingTexts.push({
      x: this.player.x,
      y: this.player.y - 32,
      text: `${ult.name.toUpperCase()}!`,
      color: '#ffd700',
      life: 1.5
    });

    // Vaporize or heavily damage all mobs currently on screen
    const screenRadius = Math.max(this.width, this.height) / 2;
    const mobs = this.grid.query(this.player.x, this.player.y, screenRadius);
    mobs.forEach(mob => {
      mob.hp -= 200;
      if (mob.hp <= 0) {
        this.killCount++;
        this.combat.registerKill(2);
      }
    });
  }

  _startLoop() {
    const loop = (timestamp) => {
      const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      if (this.state === 'PLAYING') {
        this.update(dt);
      }
      this.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.runTime += dt;
    this.combat.update(dt);

    const moveVector = this.input.getMovementVector();
    this.player.update(dt, moveVector);

    // Keep player in bounds
    this.player.x = Math.max(40, Math.min(WORLD.width - 40, this.player.x));
    this.player.y = Math.max(40, Math.min(WORLD.height - 40, this.player.y));

    // Spatial grid refresh
    this.grid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      this.grid.insert(this.enemies[i]);
    }

    // Floating combat text update
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= dt * 25;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // HUD Update
    const mins = Math.floor(this.runTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(this.runTime % 60).toString().padStart(2, '0');
    this.ui.updateHUD(
      this.player,
      `${mins}:${secs}`,
      this.killCount,
      this.bankedGold,
      this.currentBiome,
      this.combat.comboCount
    );
  }

  render() {
    if (!this.ctx) return;

    const cameraX = this.player.x - this.width / 2;
    const cameraY = this.player.y - this.height / 2;

    // Clear background
    this.ctx.fillStyle = this.currentBiome.bgColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw world boundaries
    this.ctx.strokeStyle = this.currentBiome.accentColor;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(-cameraX, -cameraY, WORLD.width, WORLD.height);

    // Draw Player
    this.ctx.save();
    this.ctx.translate(this.player.x - cameraX, this.player.y - cameraY);
    if (!this.player.facingRight) {
      this.ctx.scale(-1, 1);
    }
    const heroFrames = this.sprites.cache[this.player.heroConfig.id];
    if (heroFrames && heroFrames[this.player.animFrame]) {
      this.ctx.drawImage(heroFrames[this.player.animFrame], -16, -16);
    } else {
      this.ctx.fillStyle = this.player.heroConfig.color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();

    // Floating text rendering
    this.ctx.font = '900 13px Orbitron, sans-serif';
    this.ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      this.ctx.fillStyle = ft.color;
      this.ctx.fillText(ft.text, ft.x - cameraX, ft.y - cameraY);
    });

    // Dynamic 2D Lighting pass
    this.lighting.clear();
    this.lighting.addLight(this.player.x, this.player.y, 220, this.player.heroConfig.color, 0.9);
    this.lighting.render(this.ctx, cameraX, cameraY);
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  window.ValixisEngine = new GameEngine();
}
