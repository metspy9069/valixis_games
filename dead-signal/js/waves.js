// Wave curve for Dead Signal.
//
// Pure arithmetic, no DOM and no Three.js, so the same numbers can drive the
// game and be printed by a script to sanity-check the ramp before a run.
//
// Design rules:
//  - Enemy health never scales, so a headshot stays a one-shot kill forever.
//  - Body count is strictly non-decreasing and saturates at the cap. A
//    bigger-than-normal surge would have to be followed by a smaller wave,
//    which is the dip we do not want.
//  - A surge is therefore a DELIVERY spike, not extra bodies: the whole wave
//    arrives tighter and its first 40% lands as one opening burst. The HUD and
//    the alarm call it out, because the body count does not.
//  - Once the count saturates, pressure keeps climbing on the other axes
//    (speed, bite, spawn density, brute share) for the rest of the run.

/** Absolute ceiling on a single wave, surge included. */
export const MAX_WAVE_ENEMIES = 40;

/** Fraction of a surge wave that arrives in the opening burst. */
export const SURGE_LEAD = 0.4;

/**
 * Late-wave modifiers. The 40-body cap leaves no room for count to grow, so
 * variety has to come from how a wave plays instead of how many arrive.
 *   sprinters - almost no walkers; the whole wave closes fast
 *   blackout  - the city lights go down and the fog thickens
 *   elites    - a heavy brute majority
 */
export const MODIFIERS = ['sprinters', 'blackout', 'elites'];

export function modifierFor(wave) {
  if (wave < 6) return 'none';
  if (wave % 10 === 0) return 'elites';
  if (wave % 7 === 0) return 'blackout';
  if (wave % 4 === 0) return 'sprinters';
  return 'none';
}

export function wavePlan(n) {
  const wave = Math.max(1, Math.round(n));

  // Bodies: smooth, strictly non-decreasing, saturating at the cap (~wave 13).
  const count = Math.min(MAX_WAVE_ENEMIES, Math.round(6 + 1.8 * wave + 0.06 * wave * wave));

  const surge = wave % 5 === 0;

  // Spacing tightens in two stages: steady early, then a slow grind.
  const baseSpacing = wave <= 11
    ? Math.max(0.3, 0.85 - wave * 0.05)
    : Math.max(0.16, 0.3 - (wave - 11) * 0.012);
  const spacing = surge ? Math.max(0.1, baseSpacing * 0.55) : baseSpacing;
  const burstLead = surge ? Math.max(4, Math.round(count * SURGE_LEAD)) : 0;

  // Asymptotic, so late waves keep moving without ever outrunning a sprint
  // (runner base speed is 4.2 m/s against a 7.3 m/s sprint).
  const speedScale = 1 + 0.6 * (1 - Math.exp(-(wave - 1) / 12));
  const damageScale = 1 + 1.0 * (1 - Math.exp(-(wave - 1) / 14));

  let bruteChance = wave >= 7
    ? Math.min(0.28, 0.22 + (wave - 7) * 0.006)
    : wave >= 3 ? 0.12 : 0;
  let runnerChance = wave >= 2 ? Math.min(0.58, 0.18 + wave * 0.03) : 0.1;

  const modifier = modifierFor(wave);
  if (modifier === 'sprinters') {
    bruteChance = 0.08;
    runnerChance = 0.9;
  } else if (modifier === 'elites') {
    // 30%, not 45%: at the 40-body cap, 45% brutes doubled the wave's health.
    bruteChance = 0.3;
    runnerChance = 0.3;
  }
  const walkerChance = Math.max(0.05, 1 - bruteChance - runnerChance);

  return {
    wave,
    count,
    surge,
    modifier,
    boss: wave % 10 === 0,
    burstLead,
    spacing,
    speedScale,
    damageScale,
    bruteChance,
    runnerChance,
    walkerChance,
  };
}

/** Roll an enemy type against the plan's mix. */
export function rollType(plan, rng = Math.random) {
  const r = rng();
  if (r < plan.bruteChance) return 'brute';
  if (r < plan.bruteChance + plan.runnerChance) return 'runner';
  return 'walker';
}

/** Rounded expected mix, for tuning read-outs and the wave banner. */
export function expectedMix(plan) {
  const brutes = Math.round(plan.count * plan.bruteChance);
  const runners = Math.round(plan.count * plan.runnerChance);
  return { walkers: plan.count - brutes - runners, runners, brutes };
}

/** Every wave from 1..n, for inspection. */
export function waveTable(n = 20) {
  return Array.from({ length: n }, (_, i) => {
    const plan = wavePlan(i + 1);
    return { ...plan, mix: expectedMix(plan) };
  });
}
