// Procedural audio for Dead Signal. No sample files: every sound is synthesised
// from noise buffers and oscillators at runtime.
//
// Two things do most of the work here. First, every gunshot is layered into a
// crack, a body thump and a tail, which is what separates a pistol from a
// rifle far more than pitch does. Second, all of it feeds a small procedural
// convolution reverb, so shots ring off the buildings instead of stopping dead
// in the air.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.ambient = null;
    this.reverb = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // A compressor keeps a shotgun blast and forty growls from clipping.
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.compressor);

    this.noiseBuffer = this._makeNoise(3);
    this._buildReverb();
    this._startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.7;
  }

  _makeNoise(seconds = 2) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A short synthetic impulse response: dense early, smooth decay. */
  _buildReverb() {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * 1.6);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.3) * (i < rate * 0.02 ? t * 50 : 1);
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = buffer;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.42;
    convolver.connect(wet).connect(this.master);
    this.reverb = convolver;
  }

  _panner(pan) {
    if (typeof pan !== 'number') return this.master;
    if (!this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    return p;
  }

  /**
   * Band-passed noise burst.
   * `send` copies the signal into the room reverb, which is the difference
   * between a click in a void and a shot in a street.
   */
  _noise({ dur = 0.2, gain = 0.4, type = 'lowpass', freq = 1200, q = 1, sweepTo = 0, attack = 0.002, pan = null, send = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = this._panner(pan);
    src.connect(filter).connect(g).connect(out);
    if (send > 0 && this.reverb) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = send;
      g.connect(sendGain).connect(this.reverb);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _tone({ freq = 220, to = 0, dur = 0.2, gain = 0.25, type = 'sine', attack = 0.004, detune = 0, pan = null, send = 0 }) {
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
    const out = this._panner(pan);
    osc.connect(g).connect(out);
    if (send > 0 && this.reverb) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = send;
      g.connect(sendGain).connect(this.reverb);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _startAmbient() {
    if (!this.ctx || this.ambient) return;
    // Wind: filtered noise with a slow moving cutoff.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();

    // City hum: a pair of detuned low saws, almost inaudible, that stop the
    // night from sounding like a vacuum.
    const hum = this.ctx.createGain();
    hum.gain.value = 0.014;
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 180;
    humFilter.connect(hum).connect(this.master);
    for (const f of [41, 55.3]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(humFilter);
      o.start();
    }

    this.ambient = { src, lfo, gain };
  }

  setAmbientLevel(v) {
    if (this.ambient) this.ambient.gain.gain.value = 0.09 * v;
  }

  // ---------------------------------------------------------------- weapons

  /** Layered gunshot: supersonic crack, body thump, room tail. */
  shot(kind) {
    if (!this.ctx) return;
    const cfg = {
      pistol: { crack: [0.05, 3600, 0.46], body: [150, 54, 0.12, 0.4], tail: [0.36, 0.22, 900] },
      smg: { crack: [0.03, 4300, 0.3], body: [185, 84, 0.07, 0.22], tail: [0.2, 0.14, 1500] },
      shotgun: { crack: [0.08, 2100, 0.55], body: [96, 33, 0.32, 0.52], tail: [0.62, 0.28, 620] },
      rifle: { crack: [0.045, 5400, 0.55], body: [124, 40, 0.17, 0.44], tail: [0.5, 0.26, 760] },
      lmg: { crack: [0.035, 3100, 0.36], body: [132, 58, 0.1, 0.28], tail: [0.26, 0.16, 1050] },
    }[kind] || { crack: [0.05, 3000, 0.4], body: [140, 60, 0.1, 0.3], tail: [0.3, 0.2, 900] };

    const [cd, cf, cg] = cfg.crack;
    this._noise({ dur: cd, gain: cg, type: 'highpass', freq: cf, q: 0.8, sweepTo: cf * 0.35, attack: 0.001, send: 0.5 });
    // Transient "tick" that makes the shot read as a mechanical event.
    this._tone({ freq: cf * 0.5, to: cf * 0.2, dur: 0.018, gain: cg * 0.35, type: 'square' });

    const [bf, bt, bd, bg] = cfg.body;
    this._tone({ freq: bf, to: bt, dur: bd, gain: bg, type: 'sine', attack: 0.002, send: 0.35 });
    this._noise({ dur: bd * 0.8, gain: bg * 0.5, type: 'lowpass', freq: 480, sweepTo: 120, q: 1.1 });

    const [td, tg, tf] = cfg.tail;
    this._noise({ dur: td, gain: tg, type: 'lowpass', freq: tf, sweepTo: tf * 0.4, q: 0.6, attack: 0.012, send: 1 });
  }

  dryFire() { this._noise({ dur: 0.035, gain: 0.16, type: 'highpass', freq: 2600 }); }
  pinPull() {
    this._tone({ freq: 1250, to: 720, dur: 0.05, gain: 0.1, type: 'triangle' });
    this._noise({ dur: 0.05, gain: 0.14, type: 'bandpass', freq: 2400, q: 2 });
  }

  reloadStart() { this._noise({ dur: 0.06, gain: 0.15, type: 'highpass', freq: 1900 }); }
  reloadStep() {
    this._noise({ dur: 0.05, gain: 0.22, type: 'bandpass', freq: 1150, q: 2.2 });
    this._tone({ freq: 380, to: 210, dur: 0.05, gain: 0.08, type: 'square' });
  }
  reloadEnd() {
    this._noise({ dur: 0.08, gain: 0.26, type: 'highpass', freq: 900 });
    this._tone({ freq: 640, to: 300, dur: 0.07, gain: 0.11, type: 'square' });
  }

  weaponSwap() { this._noise({ dur: 0.09, gain: 0.18, type: 'bandpass', freq: 900, q: 1.6 }); }

  /** Blade leaving the sheath: air moving, not a gun. */
  melee() {
    this._noise({ dur: 0.17, gain: 0.24, type: 'bandpass', freq: 500, q: 0.6, sweepTo: 2800, attack: 0.02, send: 0.25 });
    this._tone({ freq: 900, to: 260, dur: 0.13, gain: 0.06, type: 'sawtooth' });
  }

  /** Blade meeting a body: a wet chop with a ring on the metal. */
  meleeHit() {
    this._noise({ dur: 0.13, gain: 0.4, type: 'lowpass', freq: 1400, sweepTo: 140, q: 1.4 });
    this._noise({ dur: 0.09, gain: 0.29, type: 'bandpass', freq: 620, q: 1.1, sweepTo: 220 });
    this._tone({ freq: 1650, to: 900, dur: 0.16, gain: 0.07, type: 'triangle', send: 0.4 });
    this._tone({ freq: 92, to: 46, dur: 0.12, gain: 0.18, type: 'sine' });
  }

  /** Grenade launch: the pin, then the body of the blast. */
  explosion() {
    this._noise({ dur: 0.9, gain: 0.72, type: 'lowpass', freq: 1700, sweepTo: 90, q: 0.9, attack: 0.004, send: 1 });
    this._tone({ freq: 82, to: 26, dur: 0.75, gain: 0.62, type: 'sine', attack: 0.003, send: 0.6 });
    this._tone({ freq: 46, to: 20, dur: 1.1, gain: 0.4, type: 'triangle' });
    // Debris pattering down after the blast.
    for (let i = 0; i < 5; i++) {
      this._noise({
        dur: 0.1 + Math.random() * 0.1,
        gain: 0.1 + Math.random() * 0.1,
        type: 'bandpass',
        freq: 800 + Math.random() * 1800,
        q: 3,
        attack: 0.001,
        send: 0.5,
      });
    }
  }

  grenadeBounce() { this._tone({ freq: 420, to: 260, dur: 0.05, gain: 0.08, type: 'triangle' }); }

  /** A bloater coming apart: wet tearing over a low, gassy thump. */
  bloaterBurst() {
    this._noise({ dur: 0.55, gain: 0.5, type: 'lowpass', freq: 1100, sweepTo: 110, q: 1.1, attack: 0.004, send: 0.8 });
    this._tone({ freq: 72, to: 28, dur: 0.5, gain: 0.4, type: 'sine', attack: 0.003, send: 0.5 });
    this._noise({ dur: 0.34, gain: 0.3, type: 'bandpass', freq: 680, q: 1.4, sweepTo: 220 });
    for (let i = 0; i < 3; i++) {
      this._noise({ dur: 0.09 + Math.random() * 0.08, gain: 0.09, type: 'bandpass', freq: 500 + Math.random() * 900, q: 3, send: 0.4 });
    }
  }

  hit(head) {
    if (head) {
      this._tone({ freq: 1450, to: 620, dur: 0.1, gain: 0.22, type: 'triangle' });
      this._noise({ dur: 0.12, gain: 0.28, type: 'bandpass', freq: 2500, q: 1.5, send: 0.3 });
      // The wet part, so a headshot is not just a chime.
      this._noise({ dur: 0.08, gain: 0.18, type: 'lowpass', freq: 700, sweepTo: 260 });
    } else {
      this._noise({ dur: 0.07, gain: 0.22, type: 'bandpass', freq: 720, q: 1.3 });
      this._noise({ dur: 0.08, gain: 0.14, type: 'lowpass', freq: 420, sweepTo: 180 });
    }
  }

  kill() { this._tone({ freq: 430, to: 170, dur: 0.16, gain: 0.16, type: 'triangle' }); }

  // ---------------------------------------------------------------- zombies

  /** Guttural growl with a throat formant and a breath layer. */
  growl(distance = 10, pan = 0) {
    const falloff = Math.max(0.06, Math.min(1, 12 / Math.max(2, distance)));
    const base = 62 + Math.random() * 38;
    this._tone({ freq: base, to: base * 0.55, dur: 0.55, gain: 0.11 * falloff, type: 'sawtooth', pan, send: 0.5 });
    this._noise({ dur: 0.5, gain: 0.1 * falloff, type: 'bandpass', freq: 320, q: 3.5, sweepTo: 180, pan, send: 0.4 });
    this._noise({ dur: 0.38, gain: 0.045 * falloff, type: 'highpass', freq: 900, pan });
    // A second, detuned voice gives the "many mouths" impression up close.
    if (falloff > 0.45) {
      this._tone({ freq: base * 1.6, to: base * 0.9, dur: 0.4, gain: 0.05 * falloff, type: 'sawtooth', detune: 22, pan });
    }
  }

  /** Short, aggressive snarl when a zombie commits to a bite. */
  snarl(distance = 5, pan = 0) {
    const falloff = Math.max(0.08, Math.min(1, 10 / Math.max(2, distance)));
    this._noise({ dur: 0.32, gain: 0.2 * falloff, type: 'bandpass', freq: 900, q: 2.6, sweepTo: 380, pan, send: 0.4 });
    this._tone({ freq: 180, to: 90, dur: 0.3, gain: 0.12 * falloff, type: 'sawtooth', pan });
  }

  /** Dying gurgle: pitch collapses, breath bubbles out. */
  zombieDeath() {
    this._tone({ freq: 130, to: 32, dur: 0.75, gain: 0.16, type: 'sawtooth', send: 0.4 });
    this._noise({ dur: 0.7, gain: 0.16, type: 'lowpass', freq: 620, sweepTo: 110, send: 0.3 });
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this._noise({ dur: 0.08, gain: 0.06, type: 'bandpass', freq: 260 + Math.random() * 260, q: 4 }), 90 + i * 80);
    }
  }

  /** A distant moan drifting across the city between waves. */
  distantMoan() {
    if (!this.ctx) return;
    const base = 58 + Math.random() * 40;
    this._tone({ freq: base, to: base * 0.8, dur: 1.9, gain: 0.045, type: 'sawtooth', attack: 0.4, send: 1 });
    this._noise({ dur: 1.7, gain: 0.03, type: 'bandpass', freq: 300, q: 3, attack: 0.5, send: 1 });
  }

  footstep(sprint) {
    this._noise({ dur: 0.09, gain: sprint ? 0.16 : 0.1, type: 'bandpass', freq: 420 + Math.random() * 200, q: 1.4 });
  }

  hurt() {
    this._noise({ dur: 0.22, gain: 0.4, type: 'lowpass', freq: 600, sweepTo: 90 });
    this._tone({ freq: 74, to: 48, dur: 0.28, gain: 0.35, type: 'sine' });
  }

  /** Damage cue panned to the side the hit came from. */
  impact(pan = 0) {
    if (!this.ctx) return;
    const out = this._panner(pan);
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.2);
  }

  pickup() {
    this._tone({ freq: 520, to: 900, dur: 0.12, gain: 0.16, type: 'triangle' });
    this._tone({ freq: 780, to: 1180, dur: 0.14, gain: 0.1, type: 'sine' });
  }

  /** Acid leaving a throat: a wet, descending squelch. */
  spit() {
    this._noise({ dur: 0.22, gain: 0.3, type: 'bandpass', freq: 620, q: 2.2, sweepTo: 180 });
    this._tone({ freq: 240, to: 90, dur: 0.24, gain: 0.14, type: 'sine' });
  }

  waveAlarm(surge) {
    if (surge) {
      // Surge waves carry the same body count, so the alarm has to say it.
      this._tone({ freq: 300, to: 780, dur: 0.3, gain: 0.2, type: 'sawtooth', send: 0.3 });
      this._tone({ freq: 780, to: 300, dur: 0.32, gain: 0.17, type: 'sawtooth', send: 0.3 });
      this._tone({ freq: 260, to: 820, dur: 0.34, gain: 0.15, type: 'square' });
      return;
    }
    this._tone({ freq: 320, to: 620, dur: 0.5, gain: 0.16, type: 'sawtooth', send: 0.25 });
    this._tone({ freq: 620, to: 300, dur: 0.7, gain: 0.12, type: 'sawtooth', send: 0.25 });
  }

  /** Boss arrival: a long, low horn under a rising rattle. */
  bossAlarm() {
    this._tone({ freq: 58, to: 96, dur: 1.1, gain: 0.34, type: 'sawtooth', send: 0.6 });
    this._tone({ freq: 150, to: 74, dur: 1.4, gain: 0.22, type: 'square', send: 0.4 });
    this._noise({ dur: 1.2, gain: 0.16, type: 'lowpass', freq: 340, q: 2, sweepTo: 120, send: 0.6 });
  }

  heartbeat() { this._tone({ freq: 60, to: 40, dur: 0.16, gain: 0.24, type: 'sine' }); }
}
