/**
 * VALIXIS GAMES STUDIO - PLAYER ENTITY
 * 8 Hero Archetypes, Passives, Perfect Dash Parry, and Screen-Clearing Ultimates.
 * ZERO EMOJIS.
 */

import { HEROES } from '../data/HeroesData.js';

export class Player {
  constructor(heroId = 'pyro', startX = 1600, startY = 1600) {
    this.x = startX;
    this.y = startY;
    this.radius = 14;
    this.heroConfig = HEROES[heroId] || HEROES.pyro;

    // Stats
    this.maxHp = this.heroConfig.stats.maxHp;
    this.hp = this.maxHp;
    this.speed = this.heroConfig.stats.speed;
    this.damageMult = this.heroConfig.stats.damageMult;
    this.fireCooldown = this.heroConfig.stats.fireCooldown;
    this.fireTimer = 0;
    this.armor = this.heroConfig.stats.armor;
    this.staminaRegen = this.heroConfig.stats.staminaRegen;

    // Progression
    this.lvl = 1;
    this.xp = 0;
    this.xpNeed = 10;

    // Movement & Dash
    this.facingRight = true;
    this.walkTimer = 0;
    this.animFrame = 0;
    this.dashCooldown = 0;
    this.dashDuration = 0;
    this.isDashing = false;
    this.parryActive = false;
    this.dashSpeedMult = 2.8;

    // Ultimate Ability
    this.ultimateMaxCooldown = this.heroConfig.ultimateCooldown;
    this.ultimateCooldown = 0; // Starts ready or semi-charged
    this.ultimateActive = false;

    // Upgraded Mechanics
    this.projectilesPerShot = 1;
    this.hasLightning = false;
    this.hasFrostNova = false;
    this.hasPuddle = false;
    this.orbitOrbs = 0;
    this.hasPoison = false;
    this.critChance = 0.12;
    this.critMult = 2.0;
    this.pickupRadius = 130;
    this.lifeSteal = 0;
    this.hasParryWave = false;
  }

  update(dt, inputVector) {
    // Dash handling
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }
    if (this.isDashing) {
      this.dashDuration -= dt;
      if (this.dashDuration <= 0) {
        this.isDashing = false;
      }
    }

    // Ultimate cooldown
    if (this.ultimateCooldown > 0) {
      this.ultimateCooldown -= dt;
    }

    // Movement calculation
    let currentSpeed = this.speed * (this.isDashing ? this.dashSpeedMult : 1.0);
    if (inputVector.moving) {
      this.x += inputVector.dx * currentSpeed * 60 * dt;
      this.y += inputVector.dy * currentSpeed * 60 * dt;

      if (inputVector.dx > 0.05) this.facingRight = true;
      if (inputVector.dx < -0.05) this.facingRight = false;

      this.walkTimer += dt * 8;
      this.animFrame = Math.floor(this.walkTimer) % 2;
    } else {
      this.animFrame = 0;
    }

    // Primary weapon timer
    this.fireTimer += dt;
  }

  dash(audio) {
    if (this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashDuration = 0.22;
      this.dashCooldown = 1.6 / this.staminaRegen;
      this.parryActive = true;
      setTimeout(() => { this.parryActive = false; }, 180);
      if (audio) audio.playDash();
      return true;
    }
    return false;
  }

  canFire() {
    return this.fireTimer >= this.fireCooldown;
  }

  resetFireTimer() {
    this.fireTimer = 0;
  }

  gainXp(amount) {
    this.xp += amount;
    if (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.lvl++;
      this.xpNeed = Math.floor(this.xpNeed * 1.35 + 8);
      return true; // Leveled up
    }
    return false;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  takeDamage(rawDamage) {
    if (this.isDashing) {
      // Dodged or Parried
      return { damage: 0, dodged: true, parried: this.parryActive };
    }
    const reduction = Math.min(0.75, this.armor / (this.armor + 35));
    const finalDmg = Math.max(1, Math.round(rawDamage * (1 - reduction)));
    this.hp = Math.max(0, this.hp - finalDmg);
    return { damage: finalDmg, dodged: false, parried: false, dead: this.hp <= 0 };
  }

  triggerUltimate(audio) {
    if (this.ultimateCooldown <= 0) {
      this.ultimateCooldown = this.ultimateMaxCooldown;
      if (audio) audio.playUltimate();
      return {
        heroId: this.heroConfig.id,
        name: this.heroConfig.ultimateName,
        desc: this.heroConfig.ultimateDesc
      };
    }
    return null;
  }
}
