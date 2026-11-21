// Weekly ladder.
//
// No backend, so the ladder is local: the best five runs on the current weekly
// contract, kept in localStorage. Each entry stores the seed the run used, so
// two players on the same contract can compare like for like even though the
// spawn rolls happen on each machine.
const KEY = 'deadSignalLadder';
const MAX = 5;

/** FNV-1a, so a contract id becomes a stable 32-bit seed on any machine. */
export function seedForKey(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) { return {}; }
}

function save(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) { /* storage can be blocked */ }
}

/** Best five for a contract, highest score first. */
export function ladderFor(contractId) {
  const list = load()[contractId];
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && Number.isFinite(e.score))
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);
}

/**
 * Files a finished weekly run and returns its rank (1..5) or 0 if it did not
 * make the board.
 * @param {string} contractId
 * @param {{score:number,wave:number,kills:number,seed:number,date?:string}} run
 */
export function recordLadder(contractId, run) {
  const all = load();
  const list = Array.isArray(all[contractId]) ? all[contractId].slice() : [];
  const entry = {
    score: Math.max(0, Math.round(run.score || 0)),
    wave: Math.max(0, Math.round(run.wave || 0)),
    kills: Math.max(0, Math.round(run.kills || 0)),
    seed: (run.seed >>> 0) || 0,
    date: run.date || new Date().toISOString().slice(0, 10),
  };
  list.push(entry);
  list.sort((a, b) => (b.score || 0) - (a.score || 0));
  const trimmed = list.slice(0, MAX);
  all[contractId] = trimmed;
  save(all);
  const rank = trimmed.indexOf(entry) + 1;
  return { rank: rank || 0, list: trimmed };
}

export function clearLadder(contractId) {
  const all = load();
  if (contractId) delete all[contractId];
  else for (const k of Object.keys(all)) delete all[k];
  save(all);
}
