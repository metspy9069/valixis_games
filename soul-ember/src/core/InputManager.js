/**
 * VALIXIS GAMES STUDIO - INPUT MANAGER
 * Keyboard, Mouse, Mobile Touch, and Gamepad API with Haptic Feedback.
 */

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false, rightDown: false };
    this.touch = { active: false, startX: 0, startY: 0, curX: 0, curY: 0, dx: 0, dy: 0 };
    this.gamepadIndex = null;
    this.gamepadState = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, dash: false, ultimate: false };

    this.onDash = null;
    this.onUltimate = null;
    this.onInteract = null;
    this.onPause = null;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.code === 'Space') {
        if (this.onDash) this.onDash();
      }
      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'r') {
        if (this.onUltimate) this.onUltimate();
      }
      if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'f') {
        if (this.onInteract) this.onInteract();
      }
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (this.onPause) this.onPause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.isDown = true;
      if (e.button === 2) {
        this.mouse.rightDown = true;
        if (this.onUltimate) this.onUltimate();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.isDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Gamepad connection
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      console.log('Gamepad connected:', e.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = null;
    });
  }

  vibrateGamepad(duration = 80, weak = 0.4, strong = 0.4) {
    if (this.gamepadIndex === null || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: duration,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).catch(() => {});
    }
  }

  pollGamepad() {
    if (this.gamepadIndex === null || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return;

    // Left Stick (Movement)
    let lx = gp.axes[0] || 0;
    let ly = gp.axes[1] || 0;
    if (Math.abs(lx) < 0.15) lx = 0;
    if (Math.abs(ly) < 0.15) ly = 0;
    this.gamepadState.moveX = lx;
    this.gamepadState.moveY = ly;

    // Right Stick (Aiming)
    let rx = gp.axes[2] || 0;
    let ry = gp.axes[3] || 0;
    if (Math.abs(rx) < 0.15) rx = 0;
    if (Math.abs(ry) < 0.15) ry = 0;
    this.gamepadState.aimX = rx;
    this.gamepadState.aimY = ry;

    // Buttons
    // A button (index 0) or LT/RT (indices 6, 7)
    const btnA = gp.buttons[0] && gp.buttons[0].pressed;
    const btnB = gp.buttons[1] && gp.buttons[1].pressed;
    const btnX = gp.buttons[2] && gp.buttons[2].pressed;
    const btnY = gp.buttons[3] && gp.buttons[3].pressed;
    const btnLT = gp.buttons[6] && gp.buttons[6].pressed;
    const btnRT = gp.buttons[7] && gp.buttons[7].pressed;

    if (btnA || btnLT) {
      if (!this.gamepadState.dash) {
        if (this.onDash) this.onDash();
        this.gamepadState.dash = true;
      }
    } else {
      this.gamepadState.dash = false;
    }

    if (btnY || btnRT) {
      if (!this.gamepadState.ultimate) {
        if (this.onUltimate) this.onUltimate();
        this.gamepadState.ultimate = true;
      }
    } else {
      this.gamepadState.ultimate = false;
    }

    if (btnX && this.onInteract) {
      this.onInteract();
    }
  }

  getMovementVector() {
    this.pollGamepad();

    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // Mobile touch
    if (this.touch.active) {
      dx += this.touch.dx;
      dy += this.touch.dy;
    }

    // Gamepad
    if (this.gamepadIndex !== null) {
      if (Math.abs(this.gamepadState.moveX) > 0.1 || Math.abs(this.gamepadState.moveY) > 0.1) {
        dx = this.gamepadState.moveX;
        dy = this.gamepadState.moveY;
      }
    }

    // Normalize
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    return { dx, dy, moving: len > 0.05 };
  }
}
