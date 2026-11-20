// Wave curve for Dead Signal.
//
// Pure arithmetic, no DOM and no Three.js, so the same numbers can drive the
// game and be printed by a script to sanity-check the ramp before a run.
//
// Design rules:
//  - Waves 1 and 2 are the tutorial: a handful of walkers, loose spacing, full
//    speed, no bites worth worrying about. The run is meant to be winnable
//    before it is meant to be interesting.
//  - From wave 3 the ramp is steep: counts, density, speed and bite all climb,
//    and the mix keeps widening (runners, brutes, acid spitters).
//  - Enemy health never scales, so a headshot stays a one-shot kill forever.
//  - Body count is strictly non-decreasing and saturates at the cap. A surge
//    is therefore a DELIVERY spike, not extra bodies: the whole wave arrives
//    tighter and its first 45% lands as one opening burst.
//  - A boss closes every third wave.

/** Absolute ceiling on a single wave, surge included. */
export const MAX_WAVE_ENEMIES = 40;

/** Fraction of a surge wave that arrives in the opening burst. */
export const SURGE_LEAD = 0.45;

/** Boss cadence: one every third wave. */
export const BOSS_EVERY = 3;

/**
 * Late-wave modifiers. The 40-body cap leaves no room for count to grow, so
 * variety has to come from how a wave plays instead of how many arrive.
 *   sprinters - almost no walkers; the whole wave closes fast
 *   blackout  - the city lights go down and the fog thickens
 *   elites    - a heavy brute majority
 *   stalkers  - spitters and runners; the wave that shoots back
 */
export const MODIFIERS = ['sprinters', 'blackout', 'elites', 'stalkers'];

export function modifierFor(wave) {
  if (wave < 6) return 'none';
  if (wave % 10 === 0) return 'elites';
  if (wave % 9 === 0) return 'stalkers';
  if (wave % 7 === 0) return 'blackout';
  if (wave % 4 === 0) return 'sprinters';
  return 'none';
}

export function wavePlan(n) {
  const wave = Math.max(1, Math.round(n));
  const boss = wave % BOSS_EVERY === 0;

  // Bodies. Hand-set openings, then a curve that reaches the cap around
  // wave 12 and holds it.
  let count;
  if (wave === 1) count = 5;
  else if (wave === 2) count = 8;
  else count = Math.min(MAX_WAVE_ENEMIES, Math.round(10 + 2.5 * (wave - 2) + 0.075 * wave * wave));

  // Boss waves trade escort bodies for one very large one.
  if (boss) count = Math.max(5, Math.round(count * 0.62));

  const surge = wave >= 5 && wave % 5 === 0 && !boss;

  // Spacing: wide open for the first two, then a steady squeeze.
  const baseSpacing = wave === 1 ? 1.6 : wave === 2 ? 1.15
    : Math.max(0.16, 0.8 - (wave - 2) * 0.055);
  const spacing = surge ? Math.max(0.1, baseSpacing * 0.5) : baseSpacing;
  const burstLead = surge ? Math.max(4, Math.round(count * SURGE_LEAD)) : 0;

  // Asymptotic, so late waves keep moving without ever outrunning a sprint
  // (runner base speed is 4.2 m/s against a 7.3 m/s sprint).
  const speedScale = wave <= 2 ? 1 : 1 + 0.62 * (1 - Math.exp(-(wave - 2) / 11));
  const damageScale = wave <= 2 ? 1 : 1 + 1.05 * (1 - Math.exp(-(wave - 2) / 13));

  // Mix. Wave 1 is pure walkers; everything else opens up in stages.
  let runnerChance = 0;
  if (wave === 2) runnerChance = 0.12;
  else if (wave >= 3) runnerChance = Math.min(0.6, 0.18 + (wave - 2) * 0.035);

  let bruteChance = 0;
  if (wave >= 4 && wave < 6) bruteChance = 0.08;
  else if (wave >= 6) bruteChance = Math.min(0.3, 0.16 + (wave - 6) * 0.009);

  let spitterChance = wave >= 5 ? Math.min(0.18, 0.06 + (wave - 5) * 0.008) : 0;
  // Bloaters appear once the player has met brutes and spitters. They are few:
  // one in the wrong place does more than a dozen walkers could.
  let bloaterChance = wave >= 7 ? Math.min(0.12, 0.04 + (wave - 7) * 0.006) : 0;

  const modifier = modifierFor(wave);
  if (modifier === 'sprinters') {
    bruteChance = 0.06;
    runnerChance = 0.86;
    spitterChance = 0.04;
    bloaterChance = 0.02;
  } else if (modifier === 'elites') {
    // 30%, not 45%: at the 40-body cap, 45% brutes doubled the wave's health.
    bruteChance = 0.3;
    runnerChance = 0.32;
    spitterChance = 0.08;
    bloaterChance = 0.1;
  } else if (modifier === 'stalkers') {
    bruteChance = 0.08;
    runnerChance = 0.38;
    spitterChance = 0.24;
    bloaterChance = 0.04;
  }

  // Boss waves keep the escort lean but nasty.
  if (boss) {
    bruteChance = Math.max(bruteChance, 0.18);
    spitterChance = Math.max(spitterChance, 0.1);
  }

  // Keep the mix a real distribution. Modifiers and the boss bumps stack, and
  // on a sprinter boss wave the specials alone used to total 119%: rollType is
  // checked in order, so the excess silently starved walkers and spitters.
  const specials = bruteChance + runnerChance + spitterChance + bloaterChance;
  if (specials > 0.95) {
    const k = 0.95 / specials;
    bruteChance *= k;
    runnerChance *= k;
    spitterChance *= k;
    bloaterChance *= k;
  }
  const walkerChance = Math.max(0.05, 1 - bruteChance - runnerChance - spitterChance - bloaterChance);

  // A horde wave is a mid-fight flanking pack; which direction it comes from
  // is rolled live in the game, not here.
  const horde = !boss && !surge && wave >= 6 && wave % 4 === 2;

  return {
    wave,
    count,
    surge,
    horde,
    modifier,
    boss,
    bossEvery: BOSS_EVERY,
    burstLead,
    spacing,
    speedScale,
    damageScale,
    bruteChance,
    runnerChance,
    spitterChance,
    bloaterChance,
    walkerChance,
  };
}

/** Roll an enemy type against the plan's mix. */
export function rollType(plan, rng = Math.random) {
  const r = rng();
  let edge = plan.bruteChance;
  if (r < edge) return 'brute';
  edge += plan.runnerChance;
  if (r < edge) return 'runner';
  edge += plan.spitterChance || 0;
  if (r < edge) return 'spitter';
  edge += plan.bloaterChance || 0;
  if (r < edge) return 'bloater';
  return 'walker';
}

/** Rounded expected mix, for tuning read-outs and the wave banner. */
export function expectedMix(plan) {
  const brutes = Math.round(plan.count * plan.bruteChance);
  const runners = Math.round(plan.count * plan.runnerChance);
  const spitters = Math.round(plan.count * (plan.spitterChance || 0));
  const bloaters = Math.round(plan.count * (plan.bloaterChance || 0));
  return {
    walkers: Math.max(0, plan.count - brutes - runners - spitters - bloaters),
    runners, brutes, spitters, bloaters,
  };
}

/** Every wave from 1..n, for inspection. */
export function waveTable(n = 20) {
  return Array.from({ length: n }, (_, i) => {
    const plan = wavePlan(i + 1);
    return { ...plan, mix: expectedMix(plan) };
  });
}
