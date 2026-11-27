// Pure Web Audio DSP helpers: 3D spatial panning, voice concurrency budgeting,
// and concussion/tinnitus curves. Zero DOM / AudioContext dependencies so unit
// tests verify exact audio math directly.

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Compute stereo pan (-1..1) and rear-hemisphere factor (0..1) using the
 * player camera's Three.js YXZ basis (yaw=0 looks down -Z, right is +X).
 * Includes a near-origin deadzone so sounds directly at the listener do not
 * violently flip channels.
 */
export function computeSpatialAudio(listenerPos, listenerYaw, sourcePos) {
  const dx = sourcePos.x - listenerPos.x;
  const dz = sourcePos.z - listenerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-5) {
    return { pan: 0, rearFactor: 0, distance: 0, rearCutoffHz: 20000 };
  }

  const nx = dx / dist;
  const nz = dz / dist;

  // Camera right = (cos(yaw), -sin(yaw)), forward = (-sin(yaw), -cos(yaw))
  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);
  const fwdX = -Math.sin(listenerYaw);
  const fwdZ = -Math.cos(listenerYaw);

  const rawPan = clamp(nx * rightX + nz * rightZ, -1, 1);
  // Smooth deadzone inside 0.25m prevents 180-deg flip when standing over source
  const deadzoneScale = dist < 0.25 ? dist / 0.25 : 1;
  const pan = rawPan * deadzoneScale;

  const fwdDot = nx * fwdX + nz * fwdZ;
  const rearFactor = Math.max(0, -fwdDot);
  const rearCutoffHz = Math.round(20000 - rearFactor * 14000);

  return { pan, rearFactor, distance: dist, rearCutoffHz };
}

/**
 * Concurrency cap and priority-based voice stealing to prevent Web Audio
 * thread starvation during multi-grenade chains and dense horde waves.
 */
export class VoiceBudget {
  constructor(softCap = 28, hardCap = 40) {
    this.softCap = softCap;
    this.hardCap = hardCap;
    this.voices = [];
    this.dropped = 0;
    this.stolen = 0;
  }

  prune(now) {
    let write = 0;
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i].endTime > now) {
        this.voices[write++] = this.voices[i];
      }
    }
    this.voices.length = write;
  }

  activeCount(now = null) {
    if (now !== null) this.prune(now);
    return this.voices.length;
  }

  /**
   * Request a voice slot of given `duration` and `priority` (0..3).
   * Returns `{ allowed: boolean, stolenVoice: object|null }`.
   */
  acquire(now, duration, priority = 1, onSteal = null) {
    this.prune(now);

    if (this.voices.length >= this.softCap && priority <= 0) {
      this.dropped++;
      return false;
    }

    if (this.voices.length >= this.hardCap) {
      if (priority < 2) {
        this.dropped++;
        return false;
      }
      // Steal oldest lowest-priority voice to guarantee critical player/explosion audio
      let victimIdx = -1;
      for (let i = 0; i < this.voices.length; i++) {
        if (this.voices[i].priority < priority) {
          if (victimIdx === -1 || this.voices[i].priority < this.voices[victimIdx].priority) {
            victimIdx = i;
          }
        }
      }
      if (victimIdx === -1) {
        this.dropped++;
        return false;
      }
      const victim = this.voices[victimIdx];
      this.voices.splice(victimIdx, 1);
      this.stolen++;
      if (victim.stop) {
        try { victim.stop(); } catch (_) {}
      }
      if (onSteal) onSteal(victim);
    }

    const entry = { endTime: now + Math.max(0.02, duration), priority, stop: null };
    this.voices.push(entry);
    return entry;
  }
}

/**
 * Compute concussion low-pass sweep and tinnitus ringing intensity for an
 * explosion at `distance` metres from the player.
 */
export function computeConcussionProfile(distance, maxRadius = 11) {
  if (!Number.isFinite(distance) || distance >= maxRadius) {
    return { active: false, intensity: 0, cutoffHz: 20000, recoverSec: 0, tinnitusGain: 0 };
  }
  const t = clamp(1 - Math.max(0, distance) / maxRadius, 0, 1);
  const intensity = Math.pow(t, 1.35);
  return {
    active: intensity > 0.08,
    intensity,
    cutoffHz: Math.round(340 + (1 - intensity) * 1800),
    recoverSec: +(1.6 + intensity * 1.8).toFixed(2),
    tinnitusGain: +(intensity * 0.042).toFixed(4),
  };
}
