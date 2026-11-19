// Balance simulator for Dead Signal.
//
// Imports the same waves.js and data.js the browser runs, so the arithmetic
// here cannot drift from the game. Answers the questions that are expensive to
// answer by playing: how much health a wave actually contains, how long it
// takes to clear with each weapon, and how much damage it can deal back.
//
//   node tools/balance-sim.mjs
import { waveTable } from '../js/waves.js';
import { WEAPONS, TYPES, ATTACK_CYCLE } from '../js/data.js';

const PISTOL = WEAPONS.find((w) => w.id === 'pistol');
const SMG = WEAPONS.find((w) => w.id === 'smg');
const SHOTGUN = WEAPONS.find((w) => w.id === 'shotgun');
const IFrames = 0.32;      // seconds of damage gating in game.js
const PLAYER_HP = 100;

/** Total hit points a wave's composition contains. */
function waveHealth(plan, mix) {
  return mix.walkers * TYPES.walker.hp + mix.runners * TYPES.runner.hp + mix.brutes * TYPES.brute.hp;
}

/** Seconds to fire `shots` rounds including magazine reloads. */
function clearTime(weapon, shots) {
  const interval = 60 / weapon.rpm;
  const mags = Math.floor((shots - 1) / weapon.magSize);
  return (shots - 1) * interval + mags * weapon.reloadTime;
}

/** Worst-case incoming damage per second once the wave is on top of you. */
function incomingDps(plan, mix) {
  const total = Math.max(1, mix.walkers + mix.runners + mix.brutes);
  const avgDamage = (
    mix.walkers * TYPES.walker.damage +
    mix.runners * TYPES.runner.damage +
    mix.brutes * TYPES.brute.damage
  ) / total;
  // The gate allows at most one accepted hit per IFrames window.
  const gated = avgDamage / IFrames;
  // A single zombie is also limited by its own attack cycle.
  const single = avgDamage / ATTACK_CYCLE.walker;
  return { gated: gated * (plan.damageScale || 1), single: single * (plan.damageScale || 1) };
}

const rows = waveTable(30);
console.log('wave  body  surge  modifier   health   body   all-head  arrive  die   verdict');
console.log('                                 clear    clear     (s)    (s)');

const HEADSHOT = 2.6; // damage multiplier in game.js
let flagged = 0;
for (const plan of rows) {
  const hp = waveHealth(plan, plan.mix);
  const bodyShots = Math.ceil(hp / PISTOL.damage);
  const headShots = Math.ceil(hp / (PISTOL.damage * HEADSHOT));
  const bodyClear = clearTime(PISTOL, bodyShots);
  const headClear = clearTime(PISTOL, headShots);

  // How long before the nearest spawn ring can reach you, and how long you
  // last once they are all in contact.
  const arrive = 34 / Math.max(0.5, TYPES.walker.speed * plan.speedScale);
  const die = PLAYER_HP / Math.max(0.01, incomingDps(plan, plan.mix).gated);

  // Mixed aim: assumes a competent player lands roughly every other shot as a
  // headshot, and that kiting buys about 1.5x the standing-still death time.
  const effective = headClear * 0.6 + bodyClear * 0.4;
  const budget = arrive + die * 1.5;
  const verdict = effective <= budget ? 'ok' : effective <= budget * 1.5 ? 'tight' : 'overrun';
  if (verdict === 'overrun') flagged++;

  if (plan.wave <= 20 || plan.wave % 5 === 0) {
    console.log(
      String(plan.wave).padStart(4),
      String(plan.count).padStart(5),
      (plan.surge ? 'yes' : '-').padStart(6),
      (plan.modifier === 'none' ? '-' : plan.modifier).padStart(10),
      String(Math.round(hp)).padStart(8),
      bodyClear.toFixed(0).padStart(8),
      headClear.toFixed(0).padStart(10),
      arrive.toFixed(0).padStart(8),
      die.toFixed(1).padStart(5),
      '  ' + verdict,
    );
  }
}

// Weapon comparison on the wave where the horde first fills the cap.
const capWave = rows.find((r) => r.count >= 40);
const capHp = waveHealth(capWave, capWave.mix);
console.log(`\nFirst capped wave: ${capWave.wave} (${capWave.count} bodies, ${Math.round(capHp)} hp)`);
for (const w of [PISTOL, SMG, SHOTGUN]) {
  const perShot = w.damage * (w.pellets || 1);
  const shots = Math.ceil(capHp / perShot);
  console.log(
    `  ${w.name.padEnd(12)} ${String(shots).padStart(4)} rounds  ` +
    `${clearTime(w, shots).toFixed(1)}s  ` +
    `${(shots / w.magSize).toFixed(1)} mags`,
  );
}

const healths = rows.map((r) => waveHealth(r, r.mix));
console.log(`\nWaves simulated: ${rows.length} | flagged overrun: ${flagged}`);
console.log(`Health curve: w1 ${Math.round(healths[0])} -> w10 ${Math.round(healths[9])} -> w20 ${Math.round(healths[19])} -> w30 ${Math.round(healths[29])}`);
console.log(`Bodies: ${rows[0].count} -> ${rows[19].count} -> ${rows[29].count} (cap ${Math.max(...rows.map((r) => r.count))})`);
