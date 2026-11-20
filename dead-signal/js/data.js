// Pure game data: no DOM, no Three.js.
//
// Both the browser game and tools/balance-sim.mjs import this file, so the
// arithmetic in the simulator can never drift from what the game actually
// uses. Keep it free of imports and side effects.

export const WEAPONS = [
  // Baseline targets: a walker (100 hp) dies to one pistol headshot, three
  // pistol body shots, six SMG rounds or one point-blank shell. Kept
  // deliberately stable so headshots never stop working.
  //
  // Design rule (deliberate, not an oversight): the sidearm has an infinite
  // reserve. The pistol is the guaranteed fallback, so a run can never soft
  // lock on ammo; scarcity therefore only ever constrains the secondaries.
  {
    id: 'pistol', name: 'M9 SIDEARM', key: '1',
    damage: 40, magSize: 15, reserveMax: Infinity,
    rpm: 300, spread: 0.011, adsSpread: 0.0035, recoil: 1.6,
    pellets: 1, reloadTime: 0.95, auto: false, sound: 'pistol',
    falloffStart: 30, falloffEnd: 65, falloffMin: 0.6,
  },
  {
    id: 'smg', name: 'VECTOR-9', key: '2',
    damage: 21, magSize: 32, reserveMax: 224,
    rpm: 820, spread: 0.03, adsSpread: 0.014, recoil: 0.8,
    pellets: 1, reloadTime: 1.2, auto: true, sound: 'smg',
    falloffStart: 15, falloffEnd: 40, falloffMin: 0.5,
  },
  {
    id: 'shotgun', name: 'BREACHER 12', key: '3',
    damage: 12, magSize: 6, reserveMax: 48,
    rpm: 78, spread: 0.085, adsSpread: 0.055, recoil: 5.6,
    pellets: 12, reloadTime: 1.6, auto: false, sound: 'shotgun',
    falloffStart: 7, falloffEnd: 20, falloffMin: 0.3,
  },
  {
    // Marksman rifle: the answer to a brute at forty metres and to the
    // spitters that sit back and lob acid. Bought in the depot.
    id: 'rifle', name: 'LONGSHOT 7', key: '4',
    damage: 62, magSize: 10, reserveMax: 70,
    rpm: 165, spread: 0.009, adsSpread: 0.0007, recoil: 3.4,
    pellets: 1, reloadTime: 1.3, auto: false, sound: 'rifle',
    falloffStart: 60, falloffEnd: 120, falloffMin: 0.85,
    locked: true,
  },
  {
    // Drop-only heavy. Locked until a weapon cache is recovered, which gives
    // the pickup table something better than another magazine to offer.
    id: 'ripper', name: 'RIPPER LMG', key: '5',
    damage: 18, magSize: 75, reserveMax: 300,
    rpm: 880, spread: 0.052, adsSpread: 0.026, recoil: 1.0,
    pellets: 1, reloadTime: 2.4, auto: true, sound: 'lmg',
    falloffStart: 18, falloffEnd: 46, falloffMin: 0.55,
    locked: true,
  },
];

export const TYPES = {
  walker: {
    hp: 100, speed: 2.05, damage: 11, reach: 1.9, scale: 1, score: 100,
    skin: 0x6f8a5a, shirt: 0x33382c, pants: 0x262a22, eye: 0xd6ff5c,
  },
  runner: {
    hp: 58, speed: 4.2, damage: 7, reach: 1.75, scale: 0.93, score: 160,
    skin: 0xa88a68, shirt: 0x48282a, pants: 0x2a2020, eye: 0xff7a3d,
  },
  brute: {
    // 340 rather than 430: the balance sim showed the late curve was almost
    // entirely brute hit points, and elite waves spiked 73% in health.
    hp: 340, speed: 1.4, damage: 30, reach: 2.3, scale: 1.6, score: 450,
    skin: 0x7d7452, shirt: 0x2c2822, pants: 0x1f1c18, eye: 0xff2f2f,
  },
  spitter: {
    // Holds range and lobs acid. Fragile enough that the rifle answers it
    // cleanly, dangerous enough that ignoring one is not an option.
    hp: 130, speed: 1.9, damage: 13, reach: 2.0, scale: 1.02, score: 300,
    ranged: true, spitRange: 24, spitCooldown: 2.7,
    skin: 0x94a06a, shirt: 0x3b452c, pants: 0x23271d, eye: 0xb6ff3d,
  },
};

/**
 * Boss roster. A boss lands on every third wave (3, 6, 9 ...), and the same
 * three archetypes keep rotating with a health tier that climbs every cycle,
 * so wave 27 is not wave 3 with a bigger number.
 */
export const BOSSES = [
  {
    id: 'gatekeeper', name: 'GATEKEEPER', base: 'brute',
    hpMul: 2.3, dmgMul: 1.2, scaleMul: 1.3, speedMul: 1, scoreMul: 8,
    line: 'It does not flinch. Keep moving.',
  },
  {
    id: 'howler', name: 'THE HOWLER', base: 'runner',
    hpMul: 13, dmgMul: 1.15, scaleMul: 1.18, speedMul: 0.6, scoreMul: 9,
    line: 'Fast. Loud. It closes before you can reload.',
  },
  {
    id: 'butcher', name: 'THE BUTCHER', base: 'brute',
    hpMul: 4.4, dmgMul: 1.7, scaleMul: 1.55, speedMul: 0.9, scoreMul: 12,
    line: 'Every swing is a two-hit kill. Do not let it reach you.',
  },
];

/** The boss that closes a given wave, with its tier growth baked in. */
export function bossFor(wave) {
  const cycle = Math.max(0, Math.floor((wave - 3) / 9));
  const boss = BOSSES[Math.floor(Math.max(0, wave - 3) / 3) % BOSSES.length];
  const tier = 1 + cycle * 0.28;
  return { ...boss, hpMul: boss.hpMul * tier, dmgMul: boss.dmgMul * (1 + cycle * 0.12) };
}

/** Seconds between bites from a single zombie (windup + recovery). */
export const ATTACK_CYCLE = { walker: 1.47, runner: 1.47, brute: 2.12, spitter: 2.7 };

/**
 * Left-hand melee, in tiers. Free, always available, and the reason to close
 * distance. A knife starts the run; blade caches dropped by the dead upgrade
 * it to a machete and then a bat.
 */
export const MELEE_TIERS = [
  { id: 'knife', name: 'COMBAT KNIFE', damage: 115, range: 2.4, halfAngle: 0.58, cooldown: 0.36 },
  { id: 'machete', name: 'MACHETE', damage: 170, range: 2.9, halfAngle: 0.72, cooldown: 0.5 },
  { id: 'bat', name: 'BALL BAT', damage: 245, range: 3.15, halfAngle: 0.86, cooldown: 0.62 },
];
export const MELEE_KNOCKBACK = 0.6;

/** Frag grenade: the answer to a horde that has closed the distance. */
export const GRENADE = {
  startCount: 2,
  maxCount: 6,
  damage: 300,
  minDamage: 45,
  radius: 5.6,
  fuse: 1.9,
  throwSpeed: 17,
  gravity: 20,
};

/** Armour soaks part of every hit until it is stripped away. */
export const ARMOR_MAX = 100;
export const ARMOR_ABSORB = 0.6;
