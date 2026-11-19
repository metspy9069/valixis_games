// Procedural audio for Dead Signal. No sample files: every sound is synthesised
// from noise buffers and oscillators at runtime.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.ambient = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this._makeNoise();
    this._startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.7;
  }

  _makeNoise() {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * 2, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noise({ dur = 0.2, gain = 0.4, type = 'lowpass', freq = 1200, q = 1, sweepTo = 0, attack = 0.002 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _tone({ freq = 220, to = 0, dur = 0.2, gain = 0.25, type = 'sine', attack = 0.004, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    if (detune) osc.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _startAmbient() {
    if (!this.ctx || this.ambient) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;
    // Slow LFO on the cutoff keeps the wind moving instead of hissing flat.
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.ambient = { src, lfo, gain };
  }

  setAmbientLevel(v) {
    if (this.ambient) this.ambient.gain.gain.value = 0.09 * v;
  }

  shot(kind) {
    if (!this.ctx) return;
    if (kind === 'pistol') {
      this._noise({ dur: 0.16, gain: 0.5, type: 'bandpass', freq: 1900, q: 0.8, sweepTo: 400 });
      this._tone({ freq: 150, to: 58, dur: 0.14, gain: 0.34, type: 'square' });
    } else if (kind === 'smg') {
      this._noise({ dur: 0.1, gain: 0.34, type: 'bandpass', freq: 2600, q: 1.1, sweepTo: 700 });
      this._tone({ freq: 190, to: 80, dur: 0.08, gain: 0.2, type: 'square' });
    } else {
      this._noise({ dur: 0.34, gain: 0.62, type: 'lowpass', freq: 1500, sweepTo: 120 });
      this._tone({ freq: 90, to: 36, dur: 0.3, gain: 0.42, type: 'sine' });
    }
  }

  dryFire() { this._noise({ dur: 0.04, gain: 0.16, type: 'highpass', freq: 2400 }); }

  reloadStart() { this._noise({ dur: 0.06, gain: 0.16, type: 'highpass', freq: 1800 }); }
  reloadStep() { this._noise({ dur: 0.05, gain: 0.22, type: 'bandpass', freq: 1200, q: 2 }); }
  reloadEnd() { this._noise({ dur: 0.08, gain: 0.26, type: 'highpass', freq: 900 }); this._tone({ freq: 620, to: 320, dur: 0.07, gain: 0.1, type: 'square' }); }

  weaponSwap() { this._noise({ dur: 0.09, gain: 0.18, type: 'bandpass', freq: 900, q: 1.6 }); }

  hit(head) {
    if (head) {
      this._tone({ freq: 1450, to: 650, dur: 0.1, gain: 0.24, type: 'triangle' });
      this._noise({ dur: 0.11, gain: 0.3, type: 'bandpass', freq: 2400, q: 1.4 });
    } else {
      this._noise({ dur: 0.07, gain: 0.22, type: 'bandpass', freq: 700, q: 1.2 });
    }
  }

  kill() { this._tone({ freq: 420, to: 180, dur: 0.16, gain: 0.18, type: 'triangle' }); }

  hurt() {
    this._noise({ dur: 0.22, gain: 0.4, type: 'lowpass', freq: 600, sweepTo: 90 });
    this._tone({ freq: 74, to: 48, dur: 0.28, gain: 0.35, type: 'sine' });
  }

  growl(distance = 10) {
    const falloff = Math.max(0.05, Math.min(1, 12 / Math.max(2, distance)));
    const base = 70 + Math.random() * 40;
    this._tone({ freq: base, to: base * 0.6, dur: 0.5, gain: 0.1 * falloff, type: 'sawtooth' });
    this._noise({ dur: 0.42, gain: 0.09 * falloff, type: 'lowpass', freq: 420, q: 3, sweepTo: 180 });
  }

  zombieDeath() {
    this._tone({ freq: 120, to: 40, dur: 0.55, gain: 0.16, type: 'sawtooth' });
    this._noise({ dur: 0.3, gain: 0.16, type: 'lowpass', freq: 500, sweepTo: 120 });
  }

  footstep(sprint) {
    this._noise({ dur: 0.09, gain: sprint ? 0.16 : 0.1, type: 'bandpass', freq: 420 + Math.random() * 200, q: 1.4 });
  }

  pickup() {
    this._tone({ freq: 520, to: 900, dur: 0.12, gain: 0.16, type: 'triangle' });
    this._tone({ freq: 780, to: 1180, dur: 0.14, gain: 0.1, type: 'sine' });
  }

  waveAlarm(surge) {
    if (surge) {
      // Surge waves carry the same body count, so the alarm has to say it.
      this._tone({ freq: 300, to: 780, dur: 0.3, gain: 0.2, type: 'sawtooth' });
      this._tone({ freq: 780, to: 300, dur: 0.32, gain: 0.17, type: 'sawtooth' });
      this._tone({ freq: 260, to: 820, dur: 0.34, gain: 0.15, type: 'square' });
      return;
    }
    this._tone({ freq: 320, to: 620, dur: 0.5, gain: 0.16, type: 'sawtooth' });
    this._tone({ freq: 620, to: 300, dur: 0.7, gain: 0.12, type: 'sawtooth' });
  }

  heartbeat() { this._tone({ freq: 60, to: 40, dur: 0.16, gain: 0.24, type: 'sine' }); }
}
