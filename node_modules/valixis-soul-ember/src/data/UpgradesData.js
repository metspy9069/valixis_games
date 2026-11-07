/**
 * VALIXIS GAMES STUDIO - UPGRADE & BLESSING POOL
 * 24 Diverse Roguelite Blessings with Synergies and Procedural Vector Icons.
 * ZERO EMOJIS.
 */

export const UPGRADES = [
  {
    id: 'multishot',
    name: 'Twin Flames',
    icon: 'multishot',
    desc: 'Adds +1 projectile to your primary auto-attack salvo.',
    rarity: 'rare',
    apply: (player) => { player.projectilesPerShot += 1; }
  },
  {
    id: 'lightning',
    name: 'Storm Conduit',
    icon: 'lightning',
    desc: 'Strikes multiple nearby enemies with high-voltage chain lightning arcs.',
    rarity: 'rare',
    apply: (player) => { player.hasLightning = true; player.lightningChains = (player.lightningChains || 2) + 1; }
  },
  {
    id: 'frostnova',
    name: 'Frost Aura',
    icon: 'frostnova',
    desc: 'Releases periodic radial frost pulses that freeze and slow oncoming foes.',
    rarity: 'rare',
    apply: (player) => { player.hasFrostNova = true; player.frostRadius = (player.frostRadius || 120) + 25; }
  },
  {
    id: 'puddle',
    name: 'Holy Consecration',
    icon: 'puddle',
    desc: 'Leaves fiery sanctified pools beneath you that continuously burn targets.',
    rarity: 'rare',
    apply: (player) => { player.hasPuddle = true; player.puddleDuration = (player.puddleDuration || 3) + 1; }
  },
  {
    id: 'shield',
    name: 'Orbiting Spark',
    icon: 'shield',
    desc: 'Spawns a spinning energy barrier orb that pulverizes oncoming mobs.',
    rarity: 'rare',
    apply: (player) => { player.orbitOrbs = (player.orbitOrbs || 0) + 1; }
  },
  {
    id: 'speed',
    name: 'Windstride Boots',
    icon: 'speed',
    desc: 'Increases hero movement speed and dodge responsiveness by +18%.',
    rarity: 'rare',
    apply: (player) => { player.speed *= 1.18; }
  },
  {
    id: 'firerate',
    name: 'Arcane Quickening',
    icon: 'firerate',
    desc: 'Reduces all spell attack and weapon cooldowns by +22%.',
    rarity: 'rare',
    apply: (player) => { player.fireCooldown = Math.max(0.12, player.fireCooldown * 0.78); }
  },
  {
    id: 'vitality',
    name: 'Lifebloom Heart',
    icon: 'vitality',
    desc: 'Instantly heals 50 HP and permanently raises maximum health by +35.',
    rarity: 'rare',
    apply: (player) => {
      player.maxHp += 35;
      player.hp = Math.min(player.maxHp, player.hp + 50);
    }
  },
  {
    id: 'poison',
    name: 'Viper Venom',
    icon: 'poison',
    desc: 'All attacks coat enemies in neurotoxic venom, dealing damage over time.',
    rarity: 'rare',
    apply: (player) => { player.hasPoison = true; player.poisonStacks = (player.poisonStacks || 0) + 1; }
  },
  {
    id: 'crit',
    name: 'Serrated Edge',
    icon: 'crit',
    desc: 'Increases critical strike chance by +15% and critical damage to 220%.',
    rarity: 'epic',
    apply: (player) => { player.critChance = (player.critChance || 0.1) + 0.15; player.critMult = 2.2; }
  },
  {
    id: 'magnet',
    name: 'Astral Lodestone',
    icon: 'magnet',
    desc: 'Expands the magnetic collection radius for gold embers and XP gems by +75%.',
    rarity: 'rare',
    apply: (player) => { player.pickupRadius = (player.pickupRadius || 80) * 1.75; }
  },
  {
    id: 'drain',
    name: 'Soul Siphon',
    icon: 'drain',
    desc: 'Gain 8% lifesteal, siphoning health back on every critical hit or kill.',
    rarity: 'epic',
    apply: (player) => { player.lifeSteal = (player.lifeSteal || 0) + 0.08; }
  },
  {
    id: 'dragon',
    name: 'Dragon Breath',
    icon: 'dragon',
    desc: 'Unleashes periodic sweeping cones of pure dragon fire incinerating targets.',
    rarity: 'epic',
    apply: (player) => { player.hasDragonBreath = true; }
  },
  {
    id: 'nova',
    name: 'Supernova Burst',
    icon: 'nova',
    desc: 'When taking damage, trigger an explosive shockwave that knocks back all foes.',
    rarity: 'epic',
    apply: (player) => { player.hasSupernova = true; }
  },
  {
    id: 'pierce',
    name: 'Spectral Piercing',
    icon: 'pierce',
    desc: 'All weapon bolts and spells pierce through +2 additional targets.',
    rarity: 'rare',
    apply: (player) => { player.pierceCount = (player.pierceCount || 1) + 2; }
  },
  {
    id: 'explosion',
    name: 'Volatile Sparks',
    icon: 'explosion',
    desc: 'Enemies slain by critical strikes detonate in a fiery cluster explosion.',
    rarity: 'epic',
    apply: (player) => { player.hasVolatileExplosion = true; }
  },
  {
    id: 'parry',
    name: 'Duelist Aegis',
    icon: 'parry',
    desc: 'Extends dash perfect-parry window by +50% and unleashes a radial blade wave.',
    rarity: 'epic',
    apply: (player) => { player.parryWindow = 0.25; player.hasParryWave = true; }
  },
  {
    id: 'blizzard',
    name: 'Polar Vortex',
    icon: 'blizzard',
    desc: 'Summons a raging blizzard storm around the hero that slows and damages mobs.',
    rarity: 'epic',
    apply: (player) => { player.hasBlizzard = true; }
  },
  {
    id: 'thorns',
    name: 'Bramble Ward',
    icon: 'thorns',
    desc: 'Reflects 150% of melee damage taken back to the attacker and reduces incoming hits by 15%.',
    rarity: 'rare',
    apply: (player) => { player.armor = (player.armor || 0) + 15; player.hasThorns = true; }
  },
  {
    id: 'berserk',
    name: 'Blood Frenzy',
    icon: 'berserk',
    desc: 'Attack speed and damage increase by up to +60% as health drops lower.',
    rarity: 'epic',
    apply: (player) => { player.hasBerserk = true; }
  },
  {
    id: 'gold_rush',
    name: 'Midas Touch',
    icon: 'gold_rush',
    desc: 'Enemies drop +60% more gold embers and small chests have +35% chance to appear.',
    rarity: 'rare',
    apply: (player) => { player.goldMultiplier = (player.goldMultiplier || 1.0) * 1.6; }
  },
  {
    id: 'ultimate_cooldown',
    name: 'Chrono Reversion',
    icon: 'ultimate_cooldown',
    desc: 'Reduces Ultimate ability cooldown by 30% and instantly recharges 50% gauge.',
    rarity: 'legendary',
    apply: (player) => {
      player.ultimateMaxCooldown *= 0.7;
      player.ultimateCooldown = Math.max(0, player.ultimateCooldown - player.ultimateMaxCooldown * 0.5);
    }
  }
];
