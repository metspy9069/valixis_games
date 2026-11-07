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

    // --- ENEMY SPAWNING (simple wave spawner) ---
    this._spawnTimer = (this._spawnTimer || 0) + dt;
    const spawnInterval = Math.max(0.4, 2.0 - this.runTime * 0.004);
    if (this._spawnTimer >= spawnInterval) {
      this._spawnTimer = 0;
      this._spawnEnemy();
    }

    // --- ENEMY UPDATE & XP/KILL ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const mob = this.enemies[i];

      // Move mob toward player
      const dx = this.player.x - mob.x;
      const dy = this.player.y - mob.y;
      const dist = Math.hypot(dx, dy) || 1;
      mob.x += (dx / dist) * mob.speed * dt * 60;
      mob.y += (dy / dist) * mob.speed * dt * 60;

      // Mob hits player
      if (dist < this.player.radius + mob.radius && mob.attackTimer <= 0) {
        mob.attackTimer = 1.0;
        const result = this.player.takeDamage(mob.damage);
        if (result.dodged) {
          this.floatingTexts.push({ x: this.player.x, y: this.player.y - 30, text: result.parried ? 'PARRY!' : 'DODGE!', color: '#00f2fe', life: 1.0 });
        } else if (result.dead) {
          this.state = 'DEAD';
        }
      }
      if (mob.attackTimer > 0) mob.attackTimer -= dt;

      // Mob is dead
      if (mob.hp <= 0) {
        this.killCount++;
        this.bankedGold += this.combat.registerKill(mob.goldValue || 1);

        // Drop XP gem pickup
        this.pickups.push({ x: mob.x, y: mob.y, type: 'xp', value: mob.xpValue || 2, radius: 8 });

        this.floatingTexts.push({ x: mob.x, y: mob.y - 20, text: `+${mob.xpValue || 2} XP`, color: '#00ff88', life: 0.8 });
        this.enemies.splice(i, 1);
      }
    }

    // --- PICKUP COLLECTION ---
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const dx = this.player.x - pk.x;
      const dy = this.player.y - pk.y;
      if (Math.hypot(dx, dy) < this.player.pickupRadius) {
        if (pk.type === 'xp') {
          const leveled = this.player.gainXp(pk.value);
          if (leveled) {
            this._onLevelUp();
          }
        } else if (pk.type === 'gold') {
          this.bankedGold += pk.value;
        }
        this.pickups.splice(i, 1);
      }
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

  _spawnEnemy() {
    // Spawn off-screen relative to player
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = Math.max(this.width, this.height) * 0.65;
    const ex = Math.max(20, Math.min(WORLD.width - 20, this.player.x + Math.cos(angle) * spawnDist));
    const ey = Math.max(20, Math.min(WORLD.height - 20, this.player.y + Math.sin(angle) * spawnDist));

    // Scale difficulty with time
    const tier = Math.min(4, Math.floor(this.runTime / 30));
    const hp = 30 + tier * 20 + Math.random() * 20;
    const damage = 8 + tier * 3;
    const speed = 0.9 + tier * 0.1 + Math.random() * 0.3;

    this.enemies.push({
      x: ex, y: ey,
      radius: 10 + tier * 1.5,
      hp, maxHp: hp,
      damage, speed,
      xpValue: 2 + tier,
      goldValue: 1,
      attackTimer: 0,
      color: ['#c040ff', '#ff416c', '#00f2fe', '#ffd700', '#ff0055'][tier]
    });

    // Insert into spatial grid immediately
    this.grid.insert(this.enemies[this.enemies.length - 1]);
  }

  _onLevelUp() {
    // Pause game during blessing selection
    this.state = 'LEVELUP';
    this.floatingTexts.push({
      x: this.player.x, y: this.player.y - 50,
      text: `LEVEL ${this.player.lvl}!`,
      color: '#ffd700', life: 1.5
    });

    // Show upgrade modal
    this.ui.showLevelUp(UPGRADES, (chosenUpg) => {
      // Apply the chosen upgrade to player
      if (chosenUpg && typeof chosenUpg.apply === 'function') {
        chosenUpg.apply(this.player);
      }
      // Resume game
      this.state = 'PLAYING';
    });
  }

  render() {
    if (!this.ctx || !this.player) return;

    const cameraX = this.player.x - this.width / 2;
    const cameraY = this.player.y - this.height / 2;

    // Clear background
    this.ctx.fillStyle = this.currentBiome.bgColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw world boundaries
    this.ctx.strokeStyle = this.currentBiome.accentColor;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(-cameraX, -cameraY, WORLD.width, WORLD.height);

    // Draw Enemies
    this.enemies.forEach(mob => {
      const mx = mob.x - cameraX;
      const my = mob.y - cameraY;
      // HP bar above enemy
      const barW = mob.radius * 2.5;
      const hpPct = Math.max(0, mob.hp / mob.maxHp);
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.ctx.fillRect(mx - barW / 2, my - mob.radius - 8, barW, 4);
      this.ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffd700' : '#ff416c';
      this.ctx.fillRect(mx - barW / 2, my - mob.radius - 8, barW * hpPct, 4);
      // Enemy body
      this.ctx.fillStyle = mob.color || '#c040ff';
      this.ctx.beginPath();
      this.ctx.arc(mx, my, mob.radius, 0, Math.PI * 2);
      this.ctx.fill();
      // Glow
      this.ctx.strokeStyle = mob.color || '#c040ff';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(mx, my, mob.radius + 3, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    });

    // Draw XP/Gold pickups
    this.pickups.forEach(pk => {
      const px = pk.x - cameraX;
      const py = pk.y - cameraY;
      this.ctx.fillStyle = pk.type === 'xp' ? '#00ff88' : '#ffd700';
      this.ctx.beginPath();
      this.ctx.arc(px, py, pk.radius || 6, 0, Math.PI * 2);
      this.ctx.fill();
      // Glow ring
      this.ctx.strokeStyle = pk.type === 'xp' ? '#00ff88' : '#ffd700';
      this.ctx.lineWidth = 1.5;
      this.ctx.globalAlpha = 0.4;
      this.ctx.beginPath();
      this.ctx.arc(px, py, (pk.radius || 6) + 4, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    });

    // Draw Player
    this.ctx.save();
    this.ctx.translate(this.player.x - cameraX, this.player.y - cameraY);
    if (!this.player.facingRight) {
      this.ctx.scale(-1, 1);
    }
    // Dash glow
    if (this.player.isDashing) {
      this.ctx.shadowColor = this.player.heroConfig.color;
      this.ctx.shadowBlur = 20;
    }
    const heroFrames = this.sprites.cache[this.player.heroConfig.id];
    if (heroFrames && heroFrames[this.player.animFrame]) {
      this.ctx.drawImage(heroFrames[this.player.animFrame], -16, -16);
    } else {
      this.ctx.fillStyle = this.player.heroConfig.color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
      this.ctx.fill();
      // Player glow ring
      this.ctx.strokeStyle = this.player.heroConfig.color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.6;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.radius + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Floating text rendering
    this.ctx.font = '900 13px Orbitron, sans-serif';
    this.ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      const alpha = Math.min(1, ft.life * 2);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = ft.color;
      this.ctx.fillText(ft.text, ft.x - cameraX, ft.y - cameraY);
    });
    this.ctx.globalAlpha = 1;

    // Dynamic 2D Lighting pass
    this.lighting.clear();
    this.lighting.addLight(this.player.x, this.player.y, 220, this.player.heroConfig.color, 0.9);
    // Add lights for enemies near player
    this.enemies.slice(0, 8).forEach(mob => {
      this.lighting.addLight(mob.x, mob.y, 80, mob.color || '#c040ff', 0.4);
    });
    this.lighting.render(this.ctx, cameraX, cameraY);
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  window.ValixisEngine = new GameEngine();
}
