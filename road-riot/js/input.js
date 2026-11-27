// road-riot/js/input.js
// Unified Mobile Virtual Floating Joystick, Multi-Touch Safety Tracker,
// HTML5 Gamepad API Mapper, and Haptic / Dual-Rumble Controller.

/**
 * Compute continuous analog steering and clamped knob offsets for a virtual joystick.
 * @param {number} dx Horizontal delta from origin in CSS pixels.
 * @param {number} dy Vertical delta from origin in CSS pixels.
 * @param {number} maxRadius Maximum visual throw radius in pixels.
 * @param {number} deadzone Normalized deadzone threshold [0..0.9].
 */
export function computeVirtualJoystickOutput(dx, dy, maxRadius = 56, deadzone = 0.14) {
  const safeRadius = Math.max(10, maxRadius);
  const dist = Math.hypot(dx, dy);
  let clampedDx = dx;
  let clampedDy = dy;

  if (dist > safeRadius && dist > 0) {
    const scale = safeRadius / dist;
    clampedDx = dx * scale;
    clampedDy = dy * scale;
  }

  const rawX = Math.max(-1, Math.min(1, clampedDx / safeRadius));
  const absX = Math.abs(rawX);

  let steer = 0;
  if (absX > deadzone) {
    // Rescale [deadzone..1] to [0..1] and apply mild precision curve (blend linear + quad)
    const normalized = (absX - deadzone) / (1 - deadzone);
    const curved = normalized * 0.65 + (normalized * normalized) * 0.35;
    steer = Math.sign(rawX) * Math.min(1, curved);
  }

  return {
    clampedDx,
    clampedDy,
    rawX,
    steer: parseFloat(steer.toFixed(4)),
    magnitude: Math.min(1, dist / safeRadius)
  };
}

/**
 * Multi-touch pointer lifecycle tracker preventing stuck-key leaks across
 * pointercancel, touchcancel, multi-finger lift, and window blur.
 */
export class TouchInputTracker {
  constructor() {
    this.activePointers = new Map(); // pointerId -> key
    this.joystick = {
      active: false,
      pointerId: null,
      originX: 0,
      originY: 0,
      clampedDx: 0,
      clampedDy: 0,
      steer: 0
    };
  }

  pressButton(pointerId, key) {
    if (pointerId === undefined || pointerId === null || !key) return;
    this.activePointers.set(pointerId, key);
  }

  startJoystick(pointerId, clientX, clientY) {
    this.joystick.active = true;
    this.joystick.pointerId = pointerId;
    this.joystick.originX = clientX;
    this.joystick.originY = clientY;
    this.joystick.clampedDx = 0;
    this.joystick.clampedDy = 0;
    this.joystick.steer = 0;
  }

  moveJoystick(pointerId, clientX, clientY, maxRadius = 56, deadzone = 0.14) {
    if (!this.joystick.active || this.joystick.pointerId !== pointerId) return null;
    const dx = clientX - this.joystick.originX;
    const dy = clientY - this.joystick.originY;
    const out = computeVirtualJoystickOutput(dx, dy, maxRadius, deadzone);
    this.joystick.clampedDx = out.clampedDx;
    this.joystick.clampedDy = out.clampedDy;
    this.joystick.steer = out.steer;
    return out;
  }

  releasePointer(pointerId) {
    let releasedKey = null;
    let releasedJoystick = false;

    if (this.activePointers.has(pointerId)) {
      releasedKey = this.activePointers.get(pointerId);
      this.activePointers.delete(pointerId);
    }

    if (this.joystick.active && this.joystick.pointerId === pointerId) {
      this.joystick.active = false;
      this.joystick.pointerId = null;
      this.joystick.clampedDx = 0;
      this.joystick.clampedDy = 0;
      this.joystick.steer = 0;
      releasedJoystick = true;
    }

    return { releasedKey, releasedJoystick };
  }

  hasActiveKey(key) {
    for (const heldKey of this.activePointers.values()) {
      if (heldKey === key) return true;
    }
    return false;
  }

  resetAll() {
    this.activePointers.clear();
    this.joystick.active = false;
    this.joystick.pointerId = null;
    this.joystick.clampedDx = 0;
    this.joystick.clampedDy = 0;
    this.joystick.steer = 0;
  }
}

/**
 * Normalize raw HTML5 Gamepad API snapshot into progressive analog vehicle inputs.
 * Handles left stick deadzone, D-pad fallback, RT throttle, LT progressive braking,
 * face/shoulder boost & drift, and edge-triggered EMP / Pause buttons.
 */
export function normalizeGamepadState(gp, prevButtons = { pause: false, emp: false }) {
  const empty = {
    connected: false,
    id: null,
    steer: 0,
    throttle: 1.0,
    hasAnalogThrottle: false,
    brakeIntensity: 0,
    boost: false,
    drift: false,
    empPressed: false,
    pausePressed: false,
    nextPrevButtons: { pause: false, emp: false }
  };

  if (!gp || !gp.connected) return empty;

  const axes = gp.axes || [];
  const buttons = gp.buttons || [];
  const deadzone = 0.14;

  // 1. Left Analog Stick Steering + D-Pad Fallback
  let steer = 0;
  const rawAxisX = axes[0] || 0;
  if (Math.abs(rawAxisX) > deadzone) {
    const norm = (Math.abs(rawAxisX) - deadzone) / (1 - deadzone);
    const curved = norm * 0.65 + (norm * norm) * 0.35;
    steer = Math.sign(rawAxisX) * Math.min(1, curved);
  } else if (buttons[14]?.pressed) {
    steer = -1;
  } else if (buttons[15]?.pressed) {
    steer = 1;
  }

  // 2. Progressive Right Trigger (RT) Throttle & Left Trigger (LT) Brake
  const rtVal = Math.max(0, Math.min(1, buttons[7]?.value ?? (buttons[7]?.pressed ? 1 : 0)));
  const ltVal = Math.max(0, Math.min(1, buttons[6]?.value ?? (buttons[6]?.pressed ? 1 : 0)));

  const hasAnalogThrottle = rtVal > 0.05;
  const throttle = hasAnalogThrottle ? (0.35 + 0.65 * rtVal) : 1.0;

  const brakeHeld = Boolean(buttons[1]?.pressed);
  let brakeIntensity = ltVal > 0.06 ? (ltVal - 0.06) / 0.94 : 0;
  if (brakeHeld) brakeIntensity = Math.max(brakeIntensity, 1.0);
  brakeIntensity = Math.max(0, Math.min(1, brakeIntensity));

  // 3. Nitro Boost (A / X / RB) & Drift (B / LT with steering)
  const boost = Boolean(buttons[0]?.pressed || buttons[5]?.pressed);
  const drift = Boolean(buttons[1]?.pressed || (brakeIntensity > 0.25 && Math.abs(steer) > 0.15));

  // 4. Edge-triggered EMP (Y or LB) and Pause (Start/Menu)
  const empDown = Boolean(buttons[2]?.pressed || buttons[3]?.pressed || buttons[4]?.pressed);
  const pauseDown = Boolean(buttons[9]?.pressed);

  return {
    connected: true,
    id: gp.id || 'Standard Gamepad',
    steer: parseFloat(steer.toFixed(4)),
    throttle: parseFloat(throttle.toFixed(4)),
    hasAnalogThrottle,
    brakeIntensity: parseFloat(brakeIntensity.toFixed(4)),
    boost,
    drift,
    empPressed: empDown && !prevButtons.emp,
    pausePressed: pauseDown && !prevButtons.pause,
    nextPrevButtons: {
      pause: pauseDown,
      emp: empDown
    }
  };
}

/**
 * Throttled dual-channel Haptics controller (Mobile navigator.vibrate + Gamepad dual-rumble).
 */
export class HapticController {
  constructor() {
    this.lastChannelTime = new Map();
    this.history = [];
  }

  trigger(channel, options = {}, env = {}) {
    const {
      vibratePattern = 20,
      weakMagnitude = 0.4,
      strongMagnitude = 0.5,
      durationMs = 45,
      cooldownMs = 0
    } = options;

    const {
      now = (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      hapticEnabled = true,
      gamepadRumbleEnabled = true,
      vibrateFn = (typeof navigator !== 'undefined' && navigator.vibrate ? p => navigator.vibrate(p) : null),
      getGamepadsFn = (typeof navigator !== 'undefined' && navigator.getGamepads ? () => navigator.getGamepads() : null)
    } = env;

    if (!hapticEnabled && !gamepadRumbleEnabled) return false;

    const lastTime = this.lastChannelTime.get(channel) ?? -Infinity;
    if (cooldownMs > 0 && (now - lastTime) < cooldownMs) {
      return false;
    }
    this.lastChannelTime.set(channel, now);

    let fired = false;

    if (hapticEnabled && vibrateFn) {
      try {
        vibrateFn(vibratePattern);
        fired = true;
      } catch (e) {}
    }

    if (gamepadRumbleEnabled && getGamepadsFn) {
      try {
        const gamepads = getGamepadsFn();
        if (gamepads) {
          for (const gp of gamepads) {
            if (gp && gp.connected && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
              gp.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: durationMs,
                weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
                strongMagnitude: Math.max(0, Math.min(1, strongMagnitude))
              });
              fired = true;
            }
          }
        }
      } catch (e) {}
    }

    this.history.push({ channel, now, weakMagnitude, strongMagnitude, durationMs });
    if (this.history.length > 32) this.history.shift();
    return fired;
  }
}
