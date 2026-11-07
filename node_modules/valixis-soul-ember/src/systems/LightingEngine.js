/**
 * VALIXIS GAMES STUDIO - DYNAMIC 2D LIGHTING & AMBIENT OCCLUSION ENGINE
 * Hardware-accelerated multi-pass radial light halos and darkness mask.
 */

export class LightingEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = null;
    this.ctx = null;
    this.ambientDarkness = 0.82;
    this.lights = [];

    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d');
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    if (this.canvas) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setBiomeAmbient(ambientVal) {
    this.ambientDarkness = Math.max(0.2, Math.min(0.9, 1.0 - ambientVal));
  }

  clear() {
    this.lights = [];
  }

  addLight(x, y, radius, color = '#ffffff', intensity = 1.0) {
    this.lights.push({ x, y, radius, color, intensity });
  }

  render(mainCtx, cameraX, cameraY) {
    if (!this.ctx) return;

    // Fill darkness mask
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(8, 4, 14, ${this.ambientDarkness})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Carve out lights
    this.ctx.globalCompositeOperation = 'destination-out';

    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const screenX = l.x - cameraX;
      const screenY = l.y - cameraY;

      // Viewport culling
      if (
        screenX + l.radius < 0 ||
        screenX - l.radius > this.width ||
        screenY + l.radius < 0 ||
        screenY - l.radius > this.height
      ) {
        continue;
      }

      const grad = this.ctx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, l.radius
      );
      grad.addColorStop(0, `rgba(0, 0, 0, ${l.intensity})`);
      grad.addColorStop(0.4, `rgba(0, 0, 0, ${l.intensity * 0.7})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, l.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Blend darkness over game canvas
    mainCtx.drawImage(this.canvas, 0, 0);

    // Emissive color pass for vivid spell colors
    mainCtx.globalCompositeOperation = 'screen';
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      if (l.color === '#ffffff') continue; // Skip plain white lights

      const screenX = l.x - cameraX;
      const screenY = l.y - cameraY;
      if (
        screenX + l.radius < 0 ||
        screenX - l.radius > this.width ||
        screenY + l.radius < 0 ||
        screenY - l.radius > this.height
      ) {
        continue;
      }

      const flare = mainCtx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, l.radius * 0.6
      );
      flare.addColorStop(0, l.color);
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mainCtx.fillStyle = flare;
      mainCtx.beginPath();
      mainCtx.arc(screenX, screenY, l.radius * 0.6, 0, Math.PI * 2);
      mainCtx.fill();
    }
    mainCtx.globalCompositeOperation = 'source-over';
  }
}
