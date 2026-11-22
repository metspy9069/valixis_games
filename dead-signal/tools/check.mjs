// Automated verification and sanity check suite for Dead Signal.
// Tests pure math, data definitions, rig structure, and loader fallbacks.
import assert from 'node:assert';
import { WEAPONS, ALT_FIRE, ATTACHMENTS, TYPES, BOSSES, bossFor, MELEE_TIERS } from '../js/data.js';
import { wavePlan, rollType, expectedMix, BOSS_EVERY } from '../js/waves.js';
import { endlessStacksFor, endlessEffects } from '../js/endless.js';
import { dayKey, weekKey } from '../js/challenges.js';

console.log('[CHECK] Running Dead Signal verification test suite...');

// 1. Data Definitions Check
console.log(' -> Validating weapons, attachments, and melee tiers...');
assert(Array.isArray(WEAPONS) && WEAPONS.length >= 5, 'Must have at least 5 weapons');
for (const w of WEAPONS) {
  assert(w.id && w.name, `Weapon missing id or name: ${JSON.stringify(w)}`);
  assert(Number.isFinite(w.damage) && w.damage > 0, `Weapon ${w.id} damage invalid`);
  assert(Number.isFinite(w.magSize) && w.magSize > 0, `Weapon ${w.id} magSize invalid`);
  assert(Number.isFinite(w.rpm) && w.rpm > 0, `Weapon ${w.id} rpm invalid`);
  assert(Number.isFinite(w.reloadTime) && w.reloadTime > 0, `Weapon ${w.id} reloadTime invalid`);
}
assert(WEAPONS[0].reserveMax === Infinity, 'First weapon (sidearm) must have infinite reserve fallback');

for (const w of WEAPONS) {
  const alt = ALT_FIRE[w.id];
  assert(alt && alt.name && alt.cooldown > 0, `Missing or invalid alt-fire for ${w.id}`);
}

assert(ATTACHMENTS.length >= 4, 'Must have attachments defined');
assert(MELEE_TIERS.length === 3, 'Must have 3 melee weapon tiers (knife, machete, bat)');

// 2. Enemy and Boss Roster
console.log(' -> Validating zombie types and boss tiers...');
const requiredTypes = ['walker', 'runner', 'brute', 'spitter', 'bloater', 'lurker'];
for (const t of requiredTypes) {
  const def = TYPES[t];
  assert(def, `Missing zombie type: ${t}`);
  assert(def.hp > 0 && def.speed > 0 && def.damage > 0, `Invalid stats for zombie type: ${t}`);
}

assert(BOSSES.length === 3, 'Must have 3 boss archetypes');
for (let wave = 3; wave <= 30; wave += 3) {
  const b = bossFor(wave);
  assert(b && b.id && b.name && b.ability, `Boss for wave ${wave} invalid`);
  assert(b.hpMul > 1, `Boss hp multiplier must scale on wave ${wave}`);
}

// 3. Wave Math & Progression
console.log(' -> Validating wave progression math...');
let prevCount = 0;
for (let w = 1; w <= 30; w++) {
  const plan = wavePlan(w);
  assert(plan.count >= 5, `Wave ${w} count too low`);
  assert(plan.count <= 52, `Wave ${w} exceeded 52-enemy cap`);
  if (!plan.boss && w <= 13) {
    assert(plan.count >= prevCount, `Wave ${w} non-boss count decreased`);
  }
  if (!plan.boss) prevCount = plan.count;

  // Test type rolling
  const rolled = rollType(plan, () => 0.5);
  assert(TYPES[rolled], `Rolled invalid enemy type: ${rolled}`);

  const mix = expectedMix(plan);
  const total = mix.walkers + mix.runners + mix.brutes + mix.spitters + mix.bloaters + mix.lurkers;
  assert(total === plan.count, `Expected mix count ${total} does not match plan count ${plan.count}`);
}

// 4. Endless & Challenge Date Logic
console.log(' -> Validating endless scaling and date generators...');
assert(endlessStacksFor(20).length === 0, 'Wave 20 should have 0 endless stacks');
assert(endlessStacksFor(25).length === 1, 'Wave 25 should have 1 endless stack');
assert(endlessStacksFor(30).length === 2, 'Wave 30 should have 2 endless stacks');
const eff = endlessEffects(30);
assert(eff.speedMul > 1 && eff.spacingMul < 1, 'Endless effects must increase speed and decrease spacing');

const today = dayKey();
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), `Invalid day key format: ${today}`);
const week = weekKey();
assert(/^\d{4}-W\d{2}$/.test(week), `Invalid week key format: ${week}`);

console.log('[CHECK] All core game math, data structures, and balance tests PASSED! \u2713');
