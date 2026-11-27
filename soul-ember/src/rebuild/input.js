export class Input {
  static processStickVector(dx, dz, maxRadius = 48, deadzone = 0.15) {
    const dist = Math.hypot(dx, dz);
    const raw = Math.min(1.0, dist / maxRadius);
    const dirX = dist > 0 ? dx / dist : 0;
    const dirZ = dist > 0 ? dz / dist : 0;
    const clampedDist = Math.min(maxRadius, dist);
    if (raw <= deadzone) {
      return { x: 0, z: 0, magnitude: 0, clampedDist: 0, dirX, dirZ, clampedX: 0, clampedZ: 0 };
    }
    const norm = (raw - deadzone) / (1.0 - deadzone);
    const curve = norm * (0.85 + 0.15 * norm);
    const mag = Math.min(1.0, curve);
    return {
      x: dirX * mag,
      z: dirZ * mag,
      magnitude: mag,
      clampedDist,
      dirX,
      dirZ,
      clampedX: dirX * clampedDist,
      clampedZ: dirZ * clampedDist
    };
  }

  constructor(action) {
    this.keys = new Set();
    this.touch = { x: 0, z: 0 };
    this.gamepadVector = { x: 0, z: 0 };
    this.aimVector = null;
    this.action = action;
    this.isGamepad = false;
    this.prevGamepadButtons = [];

    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      if (e.target.closest("input,select,textarea")) return;
      this.isGamepad = false;
      this.keys.add(e.key.toLowerCase());
      if (
        [" ", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      )
        e.preventDefault();
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " ") action("dash");
      if (k === "q") action("skill", 0);
      if (k === "e") action("skill", 1);
      if (k === "r") action("ultimate");
      if (k === "p" || k === "escape") action("pause");
      if (k === "b" || k === "tab") action("shop");
      if (k === "f") action("fullscreen");
      if (["1", "2", "3"].includes(k)) action("choice", Number(k) - 1);
    });

    window.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.touch = { x: 0, z: 0 };
      this.gamepadVector = { x: 0, z: 0 };
      action("autopause");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.keys.clear();
        this.touch = { x: 0, z: 0 };
        this.gamepadVector = { x: 0, z: 0 };
        action("autopause");
      }
    });

    // Touch controls (dynamic recenter-on-touch virtual joystick with deadzone and multi-touch isolation)
    let pad = document.querySelector("#stick");
    this.stickPointerId = null;
    this.stickOrigin = null;

    const getPad = () => {
      if (!pad) pad = document.querySelector("#stick");
      return pad;
    };

    const handlePointerDown = (e) => {
      if (this.stickPointerId !== null) return;
      if (e.target && typeof e.target.closest === "function" && e.target.closest("button, input, select, textarea, a, #minimap, .hud-top, .modal-card, [data-action], [data-skill]")) return;
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      const h = typeof window !== "undefined" ? window.innerHeight : 600;
      const isLeftZone = e.clientX < w * 0.48 && e.clientY > h * 0.25;
      const currentPad = getPad();
      const isDirectPad = currentPad && (e.target === currentPad || (typeof currentPad.contains === "function" && currentPad.contains(e.target)));
      if (!isLeftZone && !isDirectPad) return;

      this.stickPointerId = e.pointerId;
      this.isGamepad = false;
      this.stickOrigin = { x: e.clientX, y: e.clientY };

      if (currentPad) {
        currentPad.classList.add("active");
        currentPad.style.left = `${e.clientX}px`;
        currentPad.style.top = `${e.clientY}px`;
        currentPad.style.bottom = "auto";
        currentPad.style.transform = "translate(-50%, -50%)";
        try {
          if (typeof currentPad.setPointerCapture === "function") {
            currentPad.setPointerCapture(e.pointerId);
          }
        } catch (_) {}
      }
      this.touch = { x: 0, z: 0 };
    };

    const handlePointerMove = (e) => {
      if (e.pointerId !== this.stickPointerId || !this.stickOrigin) return;
      this.isGamepad = false;
      const dx = e.clientX - this.stickOrigin.x;
      const dz = e.clientY - this.stickOrigin.y;
      const res = Input.processStickVector(dx, dz, 48, 0.15);
      this.touch = { x: res.x, z: res.z };
      const currentPad = getPad();
      if (currentPad && currentPad.firstElementChild) {
        currentPad.firstElementChild.style.transform = `translate(${res.clampedX * 0.62}px, ${res.clampedZ * 0.62}px)`;
      }
    };

    const handlePointerUp = (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickOrigin = null;
      this.touch = { x: 0, z: 0 };
      const currentPad = getPad();
      if (currentPad) {
        currentPad.classList.remove("active");
        currentPad.style.left = "";
        currentPad.style.top = "";
        currentPad.style.bottom = "";
        currentPad.style.transform = "";
        if (currentPad.firstElementChild) {
          currentPad.firstElementChild.style.transform = "";
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", handlePointerDown, { passive: true });
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("pointerdown", handlePointerDown, { passive: true });
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerUp);
    }
    const currentPad = getPad();
    if (currentPad && typeof currentPad.addEventListener === "function") {
      currentPad.addEventListener("lostpointercapture", handlePointerUp);
    }

    document.querySelectorAll("[data-skill]").forEach((button) =>
      button.addEventListener("click", () => {
        this.isGamepad = false;
        action("skill", Number(button.dataset.skill));
      }),
    );

    // Native Gamepad API listeners
    window.addEventListener("gamepadconnected", (e) => {
      this.isGamepad = true;
      const id = e.gamepad?.id ? e.gamepad.id.slice(0, 24) : "Controller";
      action("toast", `🎮 Gamepad Connected: ${id}`);
    });

    window.addEventListener("gamepaddisconnected", () => {
      this.isGamepad = false;
      this.gamepadVector = { x: 0, z: 0 };
      this.aimVector = null;
      action("toast", "🎮 Gamepad Disconnected");
    });
  }

  updateGamepad() {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    let active = null;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        active = gp;
        break;
      }
    }

    if (!active) {
      this.gamepadVector = { x: 0, z: 0 };
      this.aimVector = null;
      return;
    }

    // Left analog stick (movement) with 0.18 deadzone
    const rawX = active.axes[0] || 0;
    const rawZ = active.axes[1] || 0;
    const mag = Math.hypot(rawX, rawZ);
    if (mag > 0.18) {
      const scaled = Math.min(1, (mag - 0.18) / 0.82);
      this.gamepadVector = {
        x: (rawX / mag) * scaled,
        z: (rawZ / mag) * scaled,
      };
      this.isGamepad = true;
    } else {
      this.gamepadVector = { x: 0, z: 0 };
    }

    // D-Pad movement fallback (buttons 12: Up, 13: Down, 14: Left, 15: Right)
    const dpadUp = active.buttons[12]?.pressed;
    const dpadDown = active.buttons[13]?.pressed;
    const dpadLeft = active.buttons[14]?.pressed;
    const dpadRight = active.buttons[15]?.pressed;
    if (dpadUp || dpadDown || dpadLeft || dpadRight) {
      const dx = (dpadRight ? 1 : 0) - (dpadLeft ? 1 : 0);
      const dz = (dpadDown ? 1 : 0) - (dpadUp ? 1 : 0);
      const dlen = Math.hypot(dx, dz) || 1;
      this.gamepadVector = { x: dx / dlen, z: dz / dlen };
      this.isGamepad = true;
    }

    // Right analog stick (manual aim vector) with 0.22 deadzone
    const rx = active.axes[2] || 0;
    const rz = active.axes[3] || 0;
    const rmag = Math.hypot(rx, rz);
    if (rmag > 0.22) {
      this.aimVector = { x: rx / rmag, z: rz / rmag };
      this.isGamepad = true;
    } else {
      this.aimVector = null;
    }

    // Edge-triggered button detection
    const pressed = (btnIdx) => {
      const btn = active.buttons[btnIdx];
      const isDown = typeof btn === "object" ? btn.pressed : btn > 0.5;
      const wasDown = !!this.prevGamepadButtons[btnIdx];
      this.prevGamepadButtons[btnIdx] = isDown;
      return isDown && !wasDown;
    };

    // Button 0 (A / Cross): Dodge
    if (pressed(0)) {
      this.isGamepad = true;
      this.action("dash");
      this.action("choice", 0);
    }
    // Button 2 (X / Square): Skill Q (slot 0)
    if (pressed(2)) {
      this.isGamepad = true;
      this.action("skill", 0);
      this.action("choice", 1);
    }
    // Button 3 (Y / Triangle): Skill E (slot 1)
    if (pressed(3)) {
      this.isGamepad = true;
      this.action("skill", 1);
      this.action("choice", 2);
    }
    // Button 1 (B / Circle): Signature Ultimate
    if (pressed(1)) {
      this.isGamepad = true;
      this.action("ultimate");
    }
    // Button 4 (LB / L1) or Button 8 (Select/Back): Build & Reliquary Shop
    if (pressed(4) || pressed(8)) {
      this.isGamepad = true;
      this.action("shop");
    }
    // Button 9 (Start / Options / Menu): Pause / Resume
    if (pressed(9)) {
      this.isGamepad = true;
      this.action("pause");
    }
    // Button 5 (RB / R1): Alternative Dodge
    if (pressed(5)) {
      this.isGamepad = true;
      this.action("dash");
    }
    // Button 7 (RT / R2): Alternative Ultimate
    if (pressed(7)) {
      this.isGamepad = true;
      this.action("ultimate");
    }
  }

  vector() {
    this.updateGamepad();
    const kx =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const kz =
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);

    const x = this.touch.x + this.gamepadVector.x + kx;
    const z = this.touch.z + this.gamepadVector.z + kz;
    const len = Math.hypot(x, z);
    if (len > 1) {
      return { x: x / len, z: z / len };
    }
    return { x, z };
  }
}
