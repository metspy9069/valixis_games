// Pure chambered + checkpoint-staged reload state machine.
// Zero DOM / Three.js dependencies so unit tests exercise the exact logic
// used by the game loop.

export const RELOAD_STAGE = {
  READY: 0,
  MAG_DROPPED: 1,
  MAG_INSERTED: 2,
};

/** Total ready rounds in the weapon (magazine + chambered round). */
export function totalLoaded(ammo, index) {
  return (ammo.mag[index] || 0) + (ammo.chambered[index] ? 1 : 0);
}

/**
 * Consume one round from the active weapon.
 * Strips the next round from the magazine if available; if mag is 0, fires
 * the final chambered round and leaves the chamber empty.
 */
export function consumeRound(ammo, index) {
  if (ammo.mag[index] > 0) {
    ammo.mag[index] -= 1;
    ammo.chambered[index] = true;
    return true;
  }
  if (ammo.chambered[index]) {
    ammo.chambered[index] = false;
    return true;
  }
  return false;
}

/**
 * Compute remaining reload duration and stage checkpoints for a weapon.
 * - Tactical (partial) reload while chambered === true is 25% faster and skips
 *   the final charging-handle chambering stage.
 * - Interrupted reloads resume from their saved checkpoint (MAG_DROPPED or
 *   MAG_INSERTED) instead of restarting from scratch.
 */
export function beginReloadState(ammo, def, magSize, baseReloadTime) {
  const idx = ammo.weapon;
  if (ammo.reloading) return null;

  const isPartial = !!ammo.chambered[idx];
  const stage = ammo.reloadStage[idx] || RELOAD_STAGE.READY;

  // Already topped off: full mag (plus chambered if applicable) and no pending stage
  if (stage === RELOAD_STAGE.READY && ammo.mag[idx] >= magSize && isPartial) return null;
  if (stage === RELOAD_STAGE.READY && ammo.mag[idx] >= magSize && !isPartial && ammo.reserve[idx] <= 0 && def.reserveMax !== Infinity) {
    // Only need to chamber the top round already in the mag
  } else if (stage < RELOAD_STAGE.MAG_INSERTED && ammo.reserve[idx] <= 0 && def.reserveMax !== Infinity && ammo.mag[idx] === 0) {
    return null;
  }

  // Tactical reload is 25% faster than a dry/empty reload
  const fullTime = isPartial ? baseReloadTime * 0.75 : baseReloadTime;

  // Determine start progress fraction from saved checkpoint
  let startProgress = 0;
  if (stage === RELOAD_STAGE.MAG_DROPPED) {
    startProgress = isPartial ? 0.35 : 0.28;
  } else if (stage === RELOAD_STAGE.MAG_INSERTED) {
    startProgress = isPartial ? 0.92 : 0.72;
  }

  const remaining = Math.max(0.08, fullTime * (1 - startProgress));
  ammo.reloading = true;
  ammo.reloadTotal = fullTime;
  ammo.reloadTimer = remaining;
  ammo.reloadIsPartial = isPartial;
  ammo.reloadWeapon = idx;
  ammo.reloadStepDone = stage >= RELOAD_STAGE.MAG_INSERTED;
  ammo.reloadEndDone = false;

  return {
    isPartial,
    fullTime,
    remaining,
    stage,
  };
}

/**
 * Advance active reload timer by `dt`, returning audio/checkpoint events
 * ('drop', 'insert', 'chamber', 'complete') without relying on setTimeout.
 */
export function tickReloadState(ammo, def, magSize, dt) {
  if (!ammo.reloading) return null;
  const idx = ammo.weapon;
  // Guard against mismatched weapon index if swapped externally
  if (ammo.reloadWeapon !== idx) {
    ammo.reloading = false;
    ammo.reloadTimer = 0;
    return null;
  }

  ammo.reloadTimer -= dt;
  const total = Math.max(0.01, ammo.reloadTotal || 1);
  const progress = Math.max(0, Math.min(1, 1 - ammo.reloadTimer / total));
  const isPartial = !!ammo.reloadIsPartial;
  const events = [];

  const dropThreshold = isPartial ? 0.35 : 0.28;
  const insertThreshold = isPartial ? 0.95 : 0.72;

  if ((ammo.reloadStage[idx] || 0) < RELOAD_STAGE.MAG_DROPPED && progress >= dropThreshold) {
    ammo.reloadStage[idx] = RELOAD_STAGE.MAG_DROPPED;
    // Bank any remaining rounds in the partial mag back into reserve when dropped
    if (ammo.mag[idx] > 0 && def.reserveMax !== Infinity) {
      ammo.reserve[idx] = Math.min(def.reserveMax, ammo.reserve[idx] + ammo.mag[idx]);
    }
    ammo.mag[idx] = 0;
    events.push('drop');
  }

  if ((ammo.reloadStage[idx] || 0) < RELOAD_STAGE.MAG_INSERTED && progress >= insertThreshold) {
    ammo.reloadStage[idx] = RELOAD_STAGE.MAG_INSERTED;
    if (def.reserveMax === Infinity) {
      ammo.mag[idx] = magSize;
    } else {
      const take = Math.min(magSize, ammo.reserve[idx]);
      ammo.mag[idx] = take;
      ammo.reserve[idx] -= take;
    }
    events.push('insert');
  }

  if (ammo.reloadTimer <= 0) {
    // Ensure mag is filled if timer overshot in one large dt step
    if ((ammo.reloadStage[idx] || 0) < RELOAD_STAGE.MAG_INSERTED) {
      if (ammo.mag[idx] > 0 && def.reserveMax !== Infinity) {
        ammo.reserve[idx] = Math.min(def.reserveMax, ammo.reserve[idx] + ammo.mag[idx]);
      }
      if (def.reserveMax === Infinity) {
        ammo.mag[idx] = magSize;
      } else {
        const take = Math.min(magSize, ammo.reserve[idx]);
        ammo.mag[idx] = take;
        ammo.reserve[idx] -= take;
      }
    }
    // Empty reload racks charging handle to chamber 1 round from the new mag
    if (!ammo.chambered[idx] && ammo.mag[idx] > 0) {
      ammo.mag[idx] -= 1;
      ammo.chambered[idx] = true;
      events.push('chamber');
    }
    ammo.reloadStage[idx] = RELOAD_STAGE.READY;
    ammo.reloading = false;
    ammo.reloadTimer = 0;
    ammo.dryFireLatched = false;
    events.push('complete');
  }

  return events;
}

/**
 * Interrupt an active reload (weapon swap, sprint, melee) while preserving
 * the weapon's achieved checkpoint stage.
 */
export function interruptReloadState(ammo) {
  if (!ammo.reloading) return false;
  ammo.reloading = false;
  ammo.reloadTimer = 0;
  return true;
}
