/**
 * VALIXIS GAMES STUDIO - UI & MODALS MANAGER
 * 100% Vector Iconography & DOM State Binding.
 * ZERO EMOJIS.
 */

import { VectorIcons } from '../core/VectorIcons.js';
import { RARITIES } from '../core/Constants.js';

export class UIManager {
  constructor(audio) {
    this.audio = audio;
    this.elements = {};
    this._bindElements();
  }

  _bindElements() {
    if (typeof document === 'undefined') return;

    this.elements = {
      hudHpText: document.getElementById('hud-hp'),
      hudHpFill: document.getElementById('hp-fill'),
      hudXpText: document.getElementById('hud-xp-text'),
      hudXpFill: document.getElementById('xp-fill'),
      hudTime: document.getElementById('hud-time'),
      hudKills: document.getElementById('hud-kills'),
      hudGold: document.getElementById('hud-gold'),
      hudDash: document.getElementById('hud-dash'),
      biomeText: document.getElementById('biome-text'),
      comboPill: document.getElementById('combo-pill'),
      comboText: document.getElementById('combo-text'),
      lvlModal: document.getElementById('lvl-modal'),
      upgCardsWrap: document.getElementById('upg-cards-wrap'),
      bossHud: document.getElementById('boss-hud'),
      bossFill: document.getElementById('boss-fill')
    };
  }

  updateHUD(player, timeString, kills, gold, biome, comboCount) {
    if (!this.elements.hudHpText) this._bindElements();
    if (!this.elements.hudHpText) return;

    // HP Bar
    this.elements.hudHpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    if (this.elements.hudHpFill) {
      const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
      this.elements.hudHpFill.style.width = `${pct}%`;
    }

    // XP Bar
    if (this.elements.hudXpText) {
      this.elements.hudXpText.textContent = `LVL ${player.lvl}`;
    }
    if (this.elements.hudXpFill) {
      const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpNeed) * 100));
      this.elements.hudXpFill.style.width = `${xpPct}%`;
    }

    // Counters
    if (this.elements.hudTime) this.elements.hudTime.textContent = timeString;
    if (this.elements.hudKills) this.elements.hudKills.textContent = kills;
    if (this.elements.hudGold) this.elements.hudGold.textContent = gold;

    // Dash / Stamina
    if (this.elements.hudDash) {
      this.elements.hudDash.textContent = player.dashCooldown <= 0 ? 'READY' : `${player.dashCooldown.toFixed(1)}s`;
    }

    // Biome
    if (this.elements.biomeText && biome) {
      this.elements.biomeText.textContent = biome.name;
    }

    // Combo Pill
    if (this.elements.comboPill) {
      if (comboCount >= 3) {
        this.elements.comboPill.style.display = 'inline-flex';
        if (this.elements.comboText) {
          this.elements.comboText.textContent = `x${comboCount}`;
        }
      } else {
        this.elements.comboPill.style.display = 'none';
      }
    }
  }

  showLevelUp(upgradePool, onSelectUpgrade) {
    if (!this.elements.lvlModal) return;

    if (this.audio) this.audio.playLevelUp();

    this.elements.upgCardsWrap.innerHTML = '';
    const shuffled = [...upgradePool].sort(() => 0.5 - Math.random()).slice(0, 3);
    const rarityKeys = [RARITIES.LEGENDARY, RARITIES.EPIC, RARITIES.RARE];

    shuffled.forEach(upg => {
      const r = Math.random();
      const rarity = r < 0.18 ? rarityKeys[0] : r < 0.55 ? rarityKeys[1] : rarityKeys[2];

      const card = document.createElement('div');
      card.className = 'upg-card';
      card.style.borderColor = rarity.border;
      card.style.boxShadow = rarity.shadow;

      const iconSvg = VectorIcons.getSvg(upg.icon || 'spark', rarity.color, 44);

      card.innerHTML = `
        <div style="font-size:9px; font-weight:900; letter-spacing:1.5px; color:${rarity.color}; background:${rarity.bg}; border:1px solid ${rarity.border}; padding:3px 10px; border-radius:12px; margin-bottom:10px; text-transform:uppercase;">
          ${rarity.name} BLESSING
        </div>
        <div class="upg-icon" style="filter: drop-shadow(0 0 12px ${rarity.color}); display:flex; align-items:center; justify-content:center; width:56px; height:56px; margin:0 auto 10px auto; background:rgba(255,255,255,0.03); border-radius:14px; border:1px solid rgba(255,255,255,0.08);">
          ${iconSvg}
        </div>
        <div class="upg-name" style="font-family: var(--font-display); letter-spacing:1px; color:#fff; font-size:16px; font-weight:800; margin-bottom:6px;">${upg.name}</div>
        <div class="upg-desc" style="color:#c5bdd4; line-height:1.5; font-size:12px;">${upg.desc}</div>
      `;

      card.addEventListener('mouseenter', () => {
        if (this.audio) this.audio.playHover();
      });

      card.onclick = () => {
        if (this.audio) this.audio.playClick();
        this.elements.lvlModal.style.display = 'none';
        onSelectUpgrade(upg);
      };

      this.elements.upgCardsWrap.appendChild(card);
    });

    this.elements.lvlModal.style.display = 'flex';
  }
}
