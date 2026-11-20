// Daily and weekly challenges.
//
// No backend: the challenge of the day is derived from the calendar date, so
// every player opening the game on the same day gets the same contract, and a
// new one appears at local midnight without anyone deploying anything. Results
// are kept beside the best-run record in localStorage.

const DAILY = [
  {
    name: 'SIDEARM PROTOCOL',
    desc: 'M9 only. No secondaries, no excuses.',
    mods: { startWeapon: 0, weaponLock: 0, scoreMul: 1.2 },
    targetLabel: 'Reach wave 6',
    targetWave: 6,
  },
  {
    name: 'HEADHUNTER',
    desc: 'Body shots do a third of their damage.',
    mods: { headshotOnly: true, scoreMul: 1.25 },
    targetLabel: 'Reach wave 6',
    targetWave: 6,
  },
  {
    name: 'SURGE WATCH',
    desc: 'They arrive almost twice as fast.',
    mods: { spawnMul: 0.55, scoreMul: 1.2 },
    targetLabel: 'Reach wave 7',
    targetWave: 7,
  },
  {
    name: 'BLACKOUT DRILL',
    desc: 'The grid is already down. Flashlight only.',
    mods: { alwaysBlackout: true, scoreMul: 1.15 },
    targetLabel: 'Reach wave 7',
    targetWave: 7,
  },
  {
    name: 'GLASS CANNON',
    desc: '60 vitals, but everything you touch dies faster.',
    mods: { healthMul: 0.6, damageMul: 1.4, scoreMul: 1.3 },
    targetLabel: 'Reach wave 8',
    targetWave: 8,
  },
  {
    name: 'TWIN HEAVIES',
    desc: 'A boss every second wave.',
    mods: { bossEvery: 2, scoreMul: 1.35 },
    targetLabel: 'Reach wave 8',
    targetWave: 8,
  },
  {
    name: 'CLOSE QUARTERS',
    desc: 'Breacher 12 only. The horde arrives tight.',
    mods: { startWeapon: 2, weaponLock: 2, spawnMul: 0.8, scoreMul: 1.3 },
    targetLabel: 'Reach wave 6',
    targetWave: 6,
  },
  {
    name: 'LONGSHOT DUTY',
    desc: 'Marksman rifle only. Pick your shots.',
    mods: { startWeapon: 3, weaponLock: 3, scoreMul: 1.25 },
    targetLabel: 'Reach wave 7',
    targetWave: 7,
  },
  {
    name: 'NO PLATE CARRIER',
    desc: 'No armour drops, and they move a little faster.',
    mods: { noArmor: true, enemySpeedMul: 1.12, scoreMul: 1.2 },
    targetLabel: 'Reach wave 8',
    targetWave: 8,
  },
  {
    name: 'STALKER HUNT',
    desc: 'Every wave is a spitter wave.',
    mods: { stalkers: true, scoreMul: 1.3 },
    targetLabel: 'Reach wave 7',
    targetWave: 7,
  },
];

const WEEKLY = [
  {
    name: 'THE LONG NIGHT',
    desc: 'Hold to wave 15 with bosses every other wave.',
    mods: { bossEvery: 2, scoreMul: 2.2 },
    targetLabel: 'Reach wave 15',
    targetWave: 15,
  },
  {
    name: 'ONE GUN, ONE SHIFT',
    desc: 'Pistol only, no armour, to wave 12.',
    mods: { startWeapon: 0, weaponLock: 0, noArmor: true, scoreMul: 2.4 },
    targetLabel: 'Reach wave 12',
    targetWave: 12,
  },
  {
    name: 'ACID RAIN',
    desc: 'Spitters in every wave and double bosses to wave 14.',
    mods: { stalkers: true, bossEvery: 2, scoreMul: 2.5 },
    targetLabel: 'Reach wave 14',
    targetWave: 14,
  },
  {
    name: 'IRON WEEK',
    desc: 'Elite pressure, faster spawns, no plate carrier. Wave 13.',
    mods: { spawnMul: 0.7, noArmor: true, enemySpeedMul: 1.15, scoreMul: 2.6 },
    targetLabel: 'Reach wave 13',
    targetWave: 13,
  },
  {
    name: 'MARKSMAN SIEGE',
    desc: 'Rifle only, headshots matter, wave 12.',
    mods: { startWeapon: 3, weaponLock: 3, headshotOnly: true, scoreMul: 2.8 },
    targetLabel: 'Reach wave 12',
    targetWave: 12,
  },
  {
    name: 'TOTAL BLACKOUT',
    desc: 'No lights, no armour, no breaks. Wave 14.',
    mods: { alwaysBlackout: true, noArmor: true, spawnMul: 0.8, scoreMul: 3 },
    targetLabel: 'Reach wave 14',
    targetWave: 14,
  },
];

function hash(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local calendar date, so the contract rolls over at local midnight. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Week key (year + week number), so the weekly rolls over on Monday. */
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // ISO-ish: shift to the Thursday of the current week, then count from Jan 1.
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${d.getFullYear()}-W${pad(week)}`;
}

const DONE_KEY = 'deadSignalChallenges';

export function loadChallengeState() {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) { return {}; }
}

function saveChallengeState(state) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify(state)); } catch (err) { /* storage can be blocked */ }
}

/**
 * @param {'daily'|'weekly'} kind
 * @returns {{kind:string,id:string,name:string,desc:string,mods:object,targetLabel:string,targetWave:number,done:boolean}}
 */
export function challengeFor(kind, date = new Date()) {
  const list = kind === 'weekly' ? WEEKLY : DAILY;
  const key = kind === 'weekly' ? weekKey(date) : dayKey(date);
  const pick = list[hash(`${kind}:${key}`) % list.length];
  const id = `${kind}:${key}`;
  const done = !!loadChallengeState()[id];
  return { kind, id, key, ...pick, done };
}

/** Records a cleared contract and returns true if this was the first clear. */
export function markChallengeDone(id) {
  const state = loadChallengeState();
  if (state[id]) return false;
  state[id] = Date.now();
  saveChallengeState(state);
  return true;
}

/** Most recent clear, for the menu line. */
export function clearedCount() {
  return Object.keys(loadChallengeState()).length;
}
