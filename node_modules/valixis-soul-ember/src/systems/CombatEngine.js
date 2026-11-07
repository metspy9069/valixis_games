/**
 * VALIXIS GAMES STUDIO - COMBAT & STATUS EFFECTS ENGINE
 * Real-time Combat Formulas, Status Effects, Perfect Parry, and Dynamic Combo Chains.
 */

import { STATUS_EFFECTS, COMBO_TIERS } from '../core/Constants.js';

export class CombatEngine {
  constructor(audio, spatialGrid) {
    this.audio = audio;
    this.grid = spatialGrid;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMaxTime = 4.0;
    this.currentTier = COMBO_TIERS[0];
    this.hitStopTimer = 0;
  }

  update(dt) {
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
    }
  }

  registerKill(goldReward = 1) {
    this.comboCount++;
    this.comboTimer = this.comboMaxTime;
    this._updateTier();
    return Math.floor(goldReward * this.currentTier.mult);
  }

  resetCombo() {
    this.comboCount = 0;
    this.comboTimer = 0;
    this.currentTier = COMBO_TIERS[0];
  }

  _updateTier() {
    let tier = COMBO_TIERS[0];
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (this.comboCount >= COMBO_TIERS[i].count) {
        tier = COMBO_TIERS[i];
        break;
      }
    }
    if (tier.rank !== this.currentTier.rank) {
      this.currentTier = tier;
      if (tier.count >= 25 && this.audio) {
        this.audio.playCrit();
      }
    }
  }

  calculateDamage(rawDamage, attackerCritChance = 0.1, attackerCritMult = 2.0, targetArmor = 0) {
    const isCrit = Math.random() < attackerCritChance;
    let dmg = rawDamage * (isCrit ? attackerCritMult : 1.0);
    // Flat reduction from armor with 80% cap
    const reduction = Math.min(0.8, targetArmor / (targetArmor + 40));
    dmg = Math.max(1, Math.round(dmg * (1 - reduction)));

    return { damage: dmg, isCrit };
  }

  applyStatus(target, effectType, duration = 3.0, potency = 10) {
    if (!target.statuses) target.statuses = {};
    target.statuses[effectType] = {
      duration: duration,
      potency: potency,
      tickTimer: 0
    };
  }

  triggerParry(player, triggerShockwave = true) {
    this.hitStopTimer = 0.15; // 150ms bullet-time hit stop
    if (this.audio) {
      this.audio.playParry();
    }
    player.parryActive = true;
    setTimeout(() => { player.parryActive = false; }, 300);

    if (triggerShockwave && this.grid) {
      // Repel and damage nearby mobs
      const nearby = this.grid.query(player.x, player.y, 140);
      nearby.forEach(mob => {
        const dx = mob.x - player.x;
        const dy = mob.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        mob.x += (dx / dist) * 45;
        mob.y += (dy / dist) * 45;
        mob.hp -= 25;
      });
    }
  }
}
