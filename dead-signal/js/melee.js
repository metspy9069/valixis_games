// Pure melee combo, forward-arc hit detection, and defensive shove math.
// Zero DOM / Three.js dependencies so unit tests verify exact combat rules.

export const MELEE_COMBO_STEPS = [
  {
    step: 0,
    name: 'HORIZONTAL SLASH',
    damageMul: 1.0,
    knockbackMul: 1.0,
    staggerSec: 0.45,
    breaksGuard: false,
    cooldownMul: 0.92,
  },
  {
    step: 1,
    name: 'RETURN CUT',
    damageMul: 1.15,
    knockbackMul: 1.1,
    staggerSec: 0.45,
    breaksGuard: false,
    cooldownMul: 0.88,
  },
  {
    step: 2,
    name: 'OVERHEAD CLEAVE',
    damageMul: 1.75,
    knockbackMul: 1.85,
    staggerSec: 1.1,
    breaksGuard: true,
    cooldownMul: 1.18,
  },
];

export const COMBO_WINDOW_SEC = 1.1;

/**
 * Advance the 3-hit melee combo chain if within `COMBO_WINDOW_SEC`, otherwise
 * reset to Step 0.
 */
export function nextMeleeCombo(state, nowSec) {
  const withinWindow = state.lastSwingAt > 0 && (nowSec - state.lastSwingAt) <= COMBO_WINDOW_SEC;
  const step = withinWindow ? (state.comboStep + 1) % MELEE_COMBO_STEPS.length : 0;
  state.comboStep = step;
  state.lastSwingAt = nowSec;
  return MELEE_COMBO_STEPS[step];
}

/**
 * Strict forward-arc melee hit check.
 * Fixes rear-camera hits by requiring positive forward projection (`>= 0.08`)
 * and checking surface distance `(dist - targetRadius) <= range` instead of
 * inflating reach behind the player.
 */
export function isTargetInMeleeArc(playerPos, forwardDir, targetPos, targetRadius, range, halfAngle) {
  const dx = targetPos.x - playerPos.x;
  const dz = targetPos.z - playerPos.z;
  const dist = Math.hypot(dx, dz);

  // Surface distance check: never hits beyond weapon range
  const edgeDist = Math.max(0, dist - (targetRadius || 0));
  if (edgeDist > range) return { hit: false, dist, dirX: 0, dirZ: 0 };

  // Flatten forward vector onto XZ plane
  const fLen = Math.hypot(forwardDir.x, forwardDir.z) || 1;
  const fx = forwardDir.x / fLen;
  const fz = forwardDir.z / fLen;

  if (dist < 1e-4) {
    // Dead-center overlap is rejected as rear/ambiguous unless in front
    return { hit: false, dist: 0, dirX: fx, dirZ: fz };
  }

  const nx = dx / dist;
  const nz = dz / dist;
  const dot = nx * fx + nz * fz;

  // Must be strictly in front of the player camera plane and within swing half-angle
  if (dot < 0.08 || dot < Math.cos(halfAngle)) {
    return { hit: false, dist, dirX: nx, dirZ: nz };
  }

  return { hit: true, dist, dirX: nx, dirZ: nz };
}

/**
 * Consume durability ONLY when a melee swing actually lands (`hits > 0`).
 * Returns `{ uses, replaced, wearRatio }`.
 */
export function applyMeleeWear(currentUses, maxUses, hits) {
  if (!hits || hits <= 0) {
    return {
      uses: currentUses,
      replaced: false,
      wearRatio: maxUses > 0 ? Math.min(1, currentUses / maxUses) : 0,
    };
  }
  const next = currentUses + 1;
  if (maxUses > 0 && next >= maxUses) {
    return { uses: 0, replaced: true, wearRatio: 0 };
  }
  return {
    uses: next,
    replaced: false,
    wearRatio: maxUses > 0 ? Math.min(1, next / maxUses) : 0,
  };
}
