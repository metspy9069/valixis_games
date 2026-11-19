// Pure game data: no DOM, no Three.js.
//
// Both the browser game and tools/balance-sim.mjs import this file, so the
// arithmetic in the simulator can never drift from what the game actually
// uses. Keep it free of imports and side effects.

export const WEAPONS = [
  // Baseline targets: a walker (100 hp) dies to one pistol headshot, three
  // pistol body shots (~0.4 s), six SMG rounds (~0.37 s) or one point-blank
  // shell. Kept deliberately stable so headshots never stop working.
  //
  // Design rule (deliberate, not an oversight): the sidearm has an infinite
  // reserve. The pistol is the guaranteed fallback, so a run can never soft
  // lock on ammo; scarcity therefore only ever constrains the secondaries.
  {
    id: 'pistol', name: 'M9 SIDEARM', key: '1',
    damage: 40, magSize: 15, reserveMax: Infinity,
    rpm: 300, spread: 0.011, adsSpread: 0.0035, recoil: 1.6,
    pellets: 1, reloadTime: 1.45, auto: false, sound: 'pistol',
    falloffStart: 30, falloffEnd: 65, falloffMin: 0.6,
  },
  {
    id: 'smg', name: 'VECTOR-9', key: '2',
    damage: 19, magSize: 32, reserveMax: 224,
    rpm: 820, spread: 0.03, adsSpread: 0.014, recoil: 0.8,
    pellets: 1, reloadTime: 1.85, auto: true, sound: 'smg',
    falloffStart: 15, falloffEnd: 40, falloffMin: 0.5,
  },
  {
    id: 'shotgun', name: 'BREACHER 12', key: '3',
    damage: 11, magSize: 6, reserveMax: 48,
    rpm: 78, spread: 0.085, adsSpread: 0.055, recoil: 5.6,
    pellets: 12, reloadTime: 2.5, auto: false, sound: 'shotgun',
    falloffStart: 7, falloffEnd: 20, falloffMin: 0.3,
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
};

/** Seconds between bites from a single zombie (windup + recovery). */
export const ATTACK_CYCLE = { walker: 1.47, runner: 1.47, brute: 2.12 };
