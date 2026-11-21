// Endless-plus.
//
// The 40-body cap means the late game cannot grow by adding zombies, and enemy
// health must not climb (a walker headshot has to stay a kill). So past wave
// 20 every fifth wave permanently stacks a pressure modifier instead: faster
// arrivals and tighter spacing, one new stack at a time and never reset.
export const ENDLESS_START = 20;
export const ENDLESS_STEP = 5;
export const ENDLESS_STACKS = ['SPRINTERS', 'ELITES', 'STALKERS', 'BLACKOUT'];

/** The stacks earned by a wave: one per five waves after 20, cycling. */
export function endlessStacksFor(wave) {
  if (!Number.isFinite(wave) || wave <= ENDLESS_START) return [];
  const count = Math.floor((wave - ENDLESS_START) / ENDLESS_STEP);
  return Array.from({ length: count }, (_, i) => ENDLESS_STACKS[i % ENDLESS_STACKS.length]);
}

/**
 * Pressure from those stacks. Speed climbs 6% and the delivery gap tightens 7%
 * per stack, floored so a wave never arrives as one instant. Counts are left
 * to wavePlan so the body cap is respected.
 */
export function endlessEffects(wave) {
  const stacks = endlessStacksFor(wave);
  const n = stacks.length;
  return {
    stacks,
    speedMul: 1 + n * 0.06,
    spacingMul: Math.max(0.5, 1 - n * 0.07),
    count: n,
  };
}
