export class Input {
  constructor(action) {
    this.keys = new Set();
    this.touch = { x: 0, z: 0 };
    this.action = action;
    window.addEventListener("keydown", (e) => {
      if (e.target.closest("input,select,textarea")) return;
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
      action("autopause");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.keys.clear();
        action("autopause");
      }
    });
    const pad = document.querySelector("#stick");
    let pointer = null;
    const move = (e) => {
      const b = pad.getBoundingClientRect();
      this.touch = {
        x: Math.max(-1, Math.min(1, (e.clientX - b.left - b.width / 2) / 45)),
        z: Math.max(-1, Math.min(1, (e.clientY - b.top - b.height / 2) / 45)),
      };
      pad.firstElementChild.style.transform = `translate(${this.touch.x * 25}px,${this.touch.z * 25}px)`;
    };
    pad.addEventListener("pointerdown", (e) => {
      pointer = e.pointerId;
      pad.setPointerCapture(pointer);
      move(e);
    });
    pad.addEventListener("pointermove", (e) => {
      if (e.pointerId === pointer) move(e);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      pad.addEventListener(name, () => {
        pointer = null;
        this.touch = { x: 0, z: 0 };
        pad.firstElementChild.style.transform = "";
      });
    document.querySelectorAll("[data-skill]").forEach((button) =>
      button.addEventListener("click", () => action("skill", Number(button.dataset.skill))),
    );
  }
  vector() {
    return {
      x:
        this.touch.x +
        (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
        (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0),
      z:
        this.touch.z +
        (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) -
        (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0),
    };
  }
}
