/**
 * VALIXIS GAMES STUDIO - SOUL EMBER
 * Core Engine Constants & Configurations
 */

export const WORLD = {
  width: 3200,
  height: 3200,
  tileSize: 64,
  maxProps: 85,
  maxShrines: 6
};

export const RARITIES = {
  LEGENDARY: {
    id: 'legendary',
    name: 'LEGENDARY',
    color: '#ffd700',
    bg: 'rgba(255, 215, 0, 0.12)',
    border: '#ffd700',
    shadow: '0 0 25px rgba(255, 215, 0, 0.45)',
    weight: 0.12
  },
  EPIC: {
    id: 'epic',
    name: 'EPIC',
    color: '#c040ff',
    bg: 'rgba(192, 64, 255, 0.12)',
    border: '#c040ff',
    shadow: '0 0 20px rgba(192, 64, 255, 0.38)',
    weight: 0.38
  },
  RARE: {
    id: 'rare',
    name: 'RARE',
    color: '#00f2fe',
    bg: 'rgba(0, 242, 254, 0.12)',
    border: '#00f2fe',
    shadow: '0 0 16px rgba(0, 242, 254, 0.32)',
    weight: 0.50
  }
};

export const BIOMES = {
  crypt: {
    id: 'crypt',
    name: 'The Crypt',
    icon: 'castle',
    bgColor: '#0c0714',
    floorColor1: '#120b1f',
    floorColor2: '#1a102b',
    gridColor: 'rgba(124, 63, 228, 0.15)',
    accentColor: '#7c3fe4',
    ambientLight: 0.22,
    fogColor: '#0a0512',
    hazard: null
  },
  magma: {
    id: 'magma',
    name: 'Magma Caverns',
    icon: 'flame',
    bgColor: '#160505',
    floorColor1: '#220808',
    floorColor2: '#2f0c0c',
    gridColor: 'rgba(255, 75, 43, 0.18)',
    accentColor: '#ff416c',
    ambientLight: 0.35,
    fogColor: '#1a0404',
    hazard: 'lava'
  },
  frozen: {
    id: 'frozen',
    name: 'Glacial Spire',
    icon: 'crest_cryo',
    bgColor: '#040d16',
    floorColor1: '#071624',
    floorColor2: '#0b2034',
    gridColor: 'rgba(0, 242, 254, 0.16)',
    accentColor: '#00f2fe',
    ambientLight: 0.28,
    fogColor: '#030a12',
    hazard: 'chill'
  },
  void: {
    id: 'void',
    name: 'Void Citadel',
    icon: 'crest_warlock',
    bgColor: '#080312',
    floorColor1: '#110524',
    floorColor2: '#190833',
    gridColor: 'rgba(192, 64, 255, 0.22)',
    accentColor: '#c040ff',
    ambientLight: 0.18,
    fogColor: '#05010b',
    hazard: 'rift'
  }
};

export const STATUS_EFFECTS = {
  BURN: { id: 'burn', name: 'Burn', color: '#ff5500', tickInterval: 0.5 },
  FREEZE: { id: 'freeze', name: 'Freeze', color: '#00f2fe', speedMult: 0.4 },
  SHOCK: { id: 'shock', name: 'Shock', color: '#ffd700', spreadRadius: 90 },
  POISON: { id: 'poison', name: 'Poison', color: '#00ff88', tickInterval: 0.8 },
  BLEED: { id: 'bleed', name: 'Bleed', color: '#ff0055', tickInterval: 0.4 },
  VULNERABLE: { id: 'vulnerable', name: 'Vulnerable', color: '#ff3366', damageAmp: 1.35 },
  SHIELD: { id: 'shield', name: 'Divine Ward', color: '#ffd700' }
};

export const COMBO_TIERS = [
  { count: 0, rank: 'D', color: '#888888', mult: 1.0 },
  { count: 10, rank: 'C', color: '#4facfe', mult: 1.15 },
  { count: 25, rank: 'B', color: '#00ff88', mult: 1.3 },
  { count: 50, rank: 'A', color: '#ffd700', mult: 1.5 },
  { count: 80, rank: 'S', color: '#ff7700', mult: 1.8 },
  { count: 120, rank: 'SS', color: '#ff0055', mult: 2.2 },
  { count: 200, rank: 'SSS', color: '#c040ff', mult: 3.0 }
];
