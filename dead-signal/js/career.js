// Career profile.
//
// The run economy stays exactly as it was: credits and upgrades die with the
// operator. This is the layer that survives a run — totals, the best wave in
// each mode, the last ten runs and the daily contract streak — kept in
// localStorage beside the best-run record, so it needs no backend.
import { dayKey } from './challenges.js';

const KEY = 'deadSignalCareer';
const HISTORY_MAX = 10;
export const CAREER_MODES = ['survival', 'daily', 'weekly'];

function blankCareer() {
  return {
    version: 1,
    runs: 0,
    kills: 0,
    headshots: 0,
    bosses: 0,
    bestWave: { survival: 0, daily: 0, weekly: 0 },
    history: [],
    streak: { count: 0, best: 0, lastDay: '' },
  };
}

function normalise(parsed) {
  const base = blankCareer();
  if (!parsed || typeof parsed !== 'object') return base;
  const num = (value) => (Number.isFinite(value) ? value : 0);
  return {
    ...base,
    runs: num(parsed.runs),
    kills: num(parsed.kills),
    headshots: num(parsed.headshots),
    bosses: num(parsed.bosses),
    bestWave: { ...base.bestWave, ...(parsed.bestWave || {}) },
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, HISTORY_MAX) : [],
    streak: { ...base.streak, ...(parsed.streak || {}) },
  };
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(KEY);
    return normalise(raw ? JSON.parse(raw) : null);
  } catch (err) { return blankCareer(); }
}

function saveCareer(career) {
  try { localStorage.setItem(KEY, JSON.stringify(career)); } catch (err) { /* storage can be blocked */ }
}

function yesterdayKey(date) {
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

/**
 * Logs a finished run and returns whether it set a new best wave for its mode.
 * @param {{mode?:string,wave:number,kills:number,headshots:number,accuracy:number,credits:number,cleared:boolean,bosses:number}} run
 */
export function recordRun(run) {
  const career = loadCareer();
  const mode = CAREER_MODES.includes(run.mode) ? run.mode : 'survival';
  const wave = Math.max(0, Math.round(run.wave || 0));
  const previousBest = career.bestWave[mode] || 0;

  career.runs += 1;
  career.kills += Math.max(0, Math.round(run.kills || 0));
  career.headshots += Math.max(0, Math.round(run.headshots || 0));
  career.bosses += Math.max(0, Math.round(run.bosses || 0));
  if (wave > previousBest) career.bestWave[mode] = wave;

  career.history.unshift({
    date: dayKey(),
    mode,
    wave,
    kills: Math.max(0, Math.round(run.kills || 0)),
    accuracy: Math.max(0, Math.min(100, Math.round(run.accuracy || 0))),
    credits: Math.max(0, Math.round(run.credits || 0)),
    cleared: !!run.cleared,
  });
  career.history.length = Math.min(career.history.length, HISTORY_MAX);
  saveCareer(career);
  return { isBestWave: wave > previousBest, career };
}

/**
 * Daily contracts build the streak: clearing one on consecutive days extends
 * it, a missed day starts it over. Weekly clears deliberately do not count, so
 * the badge means "showed up today".
 */
export function noteContractClear(kind, date = new Date()) {
  const career = loadCareer();
  if (kind !== 'daily') return career.streak;
  const today = dayKey(date);
  if (career.streak.lastDay === today) return career.streak;
  career.streak.count = career.streak.lastDay === yesterdayKey(date) ? career.streak.count + 1 : 1;
  career.streak.lastDay = today;
  career.streak.best = Math.max(career.streak.best, career.streak.count);
  saveCareer(career);
  return career.streak;
}

/**
 * The streak as it should read today: a streak that was not extended today or
 * yesterday is already broken, even though the stored count is stale.
 */
export function activeStreak(date = new Date()) {
  const { streak } = loadCareer();
  if (!streak.lastDay) return 0;
  const today = dayKey(date);
  return streak.lastDay === today || streak.lastDay === yesterdayKey(date) ? streak.count : 0;
}
