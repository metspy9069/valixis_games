/**
 * VALIXIS GAMES STUDIO - HERO ARCHETYPES
 * 8 Fully Distinct Hero Classes with Passives & Active Screen-Clearing Ultimates.
 * ZERO EMOJIS.
 */

export const HEROES = {
  pyro: {
    id: 'pyro',
    name: 'Ignis Pyromancer',
    title: 'Wielder of the Living Cinder',
    icon: 'crest_pyro',
    color: '#ff5500',
    secondaryColor: '#ffd700',
    stats: {
      maxHp: 100,
      speed: 3.2,
      damageMult: 1.25,
      fireCooldown: 0.55,
      armor: 0,
      staminaRegen: 1.0
    },
    traitName: 'Flame Salvo & Consecration',
    traitDesc: 'Attacks ignite enemies for residual fire damage. Leaves burning consecrated trails.',
    ultimateName: 'Cataclysm Nova',
    ultimateDesc: 'Triggers an apocalyptic radial blast of expanding hellfire, vaporizing normal mobs and burning bosses.',
    ultimateCooldown: 24,
    unlocked: true
  },

  cryo: {
    id: 'cryo',
    name: 'Kaelen Frostweaver',
    title: 'Sovereign of the Eternal Glaze',
    icon: 'crest_cryo',
    color: '#00f2fe',
    secondaryColor: '#4facfe',
    stats: {
      maxHp: 90,
      speed: 3.4,
      damageMult: 1.1,
      fireCooldown: 0.50,
      armor: 5,
      staminaRegen: 1.1
    },
    traitName: 'Frostbite Shards & Chill',
    traitDesc: 'All projectiles inflict heavy chill, slowing enemy movement and attack velocity by 40%.',
    ultimateName: 'Absolute Zero',
    ultimateDesc: 'Instant screen-wide deep freeze freezing every enemy solid for 4 seconds with shattering critical shards.',
    ultimateCooldown: 22,
    unlocked: true
  },

  rogue: {
    id: 'rogue',
    name: 'Vesper Shadowblade',
    title: 'Phantom of the Umbral Veil',
    icon: 'crest_rogue',
    color: '#c040ff',
    secondaryColor: '#e0c3fc',
    stats: {
      maxHp: 85,
      speed: 4.1,
      damageMult: 1.2,
      fireCooldown: 0.42,
      armor: 0,
      staminaRegen: 1.4
    },
    traitName: 'Twin Shurikens & Agility',
    traitDesc: 'Fires high-velocity ricocheting shurikens with naturally high +25% critical strike chance.',
    ultimateName: 'Thousand Blades',
    ultimateDesc: 'Become temporarily invulnerable while unleashing a spiraling tempest of 36 piercing phantom blades.',
    ultimateCooldown: 20,
    unlocked: true
  },

  necro: {
    id: 'necro',
    name: 'Moros the Soulbinder',
    title: 'Shepherd of the Restless Crypt',
    icon: 'crest_necro',
    color: '#00ff88',
    secondaryColor: '#70f3ff',
    stats: {
      maxHp: 95,
      speed: 3.1,
      damageMult: 1.15,
      fireCooldown: 0.60,
      armor: 2,
      staminaRegen: 0.9
    },
    traitName: 'Soul Siphon & Minions',
    traitDesc: 'Slain foes have a 25% chance to rise as spectral wisps that seek out and detonate against nearby enemies.',
    ultimateName: 'Army of the Damned',
    ultimateDesc: 'Summons 12 spectral revenants that swarm across the battlefield, shredding targets and restoring hero HP.',
    ultimateCooldown: 26,
    unlocked: true
  },

  paladin: {
    id: 'paladin',
    name: 'Valeria Sunshield',
    title: 'Bulwark of the Radiant Dawn',
    icon: 'crest_paladin',
    color: '#ffd700',
    secondaryColor: '#ffffff',
    stats: {
      maxHp: 150,
      speed: 2.85,
      damageMult: 1.05,
      fireCooldown: 0.65,
      armor: 15,
      staminaRegen: 0.95
    },
    traitName: 'Divine Ward & Smite',
    traitDesc: 'Possesses an innate divine absorption barrier that absorbs lethal blows every 15 seconds.',
    ultimateName: 'Heavenly Judgement',
    ultimateDesc: 'Calls down 8 holy pillars of solar light that smite the highest health targets with catastrophic true damage.',
    ultimateCooldown: 25,
    unlocked: true
  },

  ranger: {
    id: 'ranger',
    name: 'Lyra Swiftstrider',
    title: 'Hawkeye of the Whispering Pines',
    icon: 'crest_ranger',
    color: '#ffb700',
    secondaryColor: '#ff7700',
    stats: {
      maxHp: 95,
      speed: 3.8,
      damageMult: 1.3,
      fireCooldown: 0.40,
      armor: 0,
      staminaRegen: 1.25
    },
    traitName: 'Pierce Quarrels & Precision',
    traitDesc: 'Arrows pierce through up to 3 enemies consecutively without losing kinetic velocity.',
    ultimateName: 'Rain of Arrows',
    ultimateDesc: 'Blankets a massive 400px circular zone in a lethal downpour of falling arrows over 4 seconds.',
    ultimateCooldown: 22,
    unlocked: true
  },

  warlock: {
    id: 'warlock',
    name: 'Xzavier Voidgazer',
    title: 'Herald of the Abyssal Threshold',
    icon: 'crest_warlock',
    color: '#ff3366',
    secondaryColor: '#9b51e0',
    stats: {
      maxHp: 80,
      speed: 3.3,
      damageMult: 1.4,
      fireCooldown: 0.58,
      armor: 0,
      staminaRegen: 1.05
    },
    traitName: 'Eldritch Miasma & Curses',
    traitDesc: 'Casts lingering void zones that inflict Vulnerability, causing cursed targets to take +35% bonus damage.',
    ultimateName: 'Void Singularity',
    ultimateDesc: 'Opens a gravitational event horizon black hole pulling all enemies on screen to its vortex center before detonating.',
    ultimateCooldown: 28,
    unlocked: true
  },

  bard: {
    id: 'bard',
    name: 'Aurelius Loresinger',
    title: 'Maestro of the Cosmic Symphony',
    icon: 'crest_bard',
    color: '#ff99ff',
    secondaryColor: '#ffd700',
    stats: {
      maxHp: 105,
      speed: 3.5,
      damageMult: 1.05,
      fireCooldown: 0.48,
      armor: 5,
      staminaRegen: 1.3
    },
    traitName: 'Harmonic Pulse & Resonance',
    traitDesc: 'Attacks pulse musical sonic rings that bounce between clustered foes, generating extra gold embers.',
    ultimateName: 'Grand Crescendo',
    ultimateDesc: 'Emits a blinding crescendo wave of harmonic sound that confounds all enemies, disorienting and wiping mobs.',
    ultimateCooldown: 20,
    unlocked: true
  }
};
