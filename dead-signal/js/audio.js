// Procedural audio for Dead Signal. There are no sample files: every sound is
// synthesised from noise buffers and oscillators at runtime.
//
// Three ideas carry most of the realism here.
//
// 1. Nothing loud is a single layer. A gunshot is a firing-pin click, a
//    saturated muzzle blast, a supersonic crack, a chest thump and a room tail.
//    The balance between those layers is what makes a pistol sound different
//    from a rifle, not the pitch of one oscillator.
// 2. A voice is a source plus formants. Growls and moans run a buzzy glottal
//    saw through three resonant band-passes tuned to a vowel, with pitch drift
//    and breath on top. That is far closer to a throat than a filtered saw.
// 3. The room matters. Shots, impacts and distant events all feed a synthetic
//    convolution reverb, so a gunshot rings off the buildings instead of
//    stopping dead in the air.
//
// The score is separate: a small step sequencer (76 BPM, 16th notes) drives
// layered pads, sub pulse, industrial percussion and a sparse motif. Layers
// fade in with `setMusicIntensity`, which the game sets from the wave state.

// D minor, with an A-major (harmonic minor) turnaround on the fourth bar.
const CHORDS = [
  [73.42, 87.31, 110.0], // Dm
  [73.42, 87.31, 110.0], // Dm
  [58.27, 73.42, 87.31], // Bb
  [55.0, 69.3, 82.41], // A
];
// D minor pentatonic, an octave up: the motif only ever uses these.
const MOTIF = [293.66, 349.23, 392.0, 440.0, 523.25];
const BPM = 76;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const VOWELS = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.effects = null;
    this.ambienceBus = null;
    this.musicBus = null;
    this.volumes = { master: 0.7, effects: 0.85, ambience: 0.75, music: 0.6 };
    this.muted = false;
    this.noiseBuffer = null;
    this.ambient = null;
    this.reverb = null;
    this.music = null;
    this.musicIntensity = -1;
    this.musicStep = 0;
    this.musicNext = 0;
    this.motifIndex = 0;
    this.pendingIntensity = 0.2;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // A compressor keeps a shotgun blast and forty growls from clipping.
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -15;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(this.compressor);

    // Three buses under the master so the score, the world and the gunfire can
    // be balanced separately: the wind should never have to be as loud as a
    // shotgun, and the music should not duck the shot that saves your life.
    this.effects = this.ctx.createGain();
    this.effects.gain.value = this.volumes.effects;
    this.effects.connect(this.master);

    this.ambienceBus = this.ctx.createGain();
    this.ambienceBus.gain.value = this.volumes.ambience;
    this.ambienceBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);

    this.noiseBuffer = this._makeNoise(3);
    this._buildReverb();
    this._startAmbient();
    this.startMusic();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volumes.master;
  }

  /** Master / effects / ambience / music, each 0..1. Safe before init(). */
  setVolumes({ master, effects, ambience, music } = {}) {
    if (typeof master === 'number') this.volumes.master = clamp(master, 0, 1);
    if (typeof effects === 'number') this.volumes.effects = clamp(effects, 0, 1);
    if (typeof ambience === 'number') this.volumes.ambience = clamp(ambience, 0, 1);
    if (typeof music === 'number') this.volumes.music = clamp(music, 0, 1);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volumes.master;
    if (this.effects) this.effects.gain.value = this.volumes.effects;
    if (this.ambienceBus) this.ambienceBus.gain.value = this.volumes.ambience;
    if (this.musicBus) this.musicBus.gain.value = this.volumes.music;
  }

  // ------------------------------------------------------------- primitives

  _makeNoise(seconds = 2) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Soft-clip curve. Grit, not a fuzz pedal: only the peaks fold. */
  _saturator(amount = 6) {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    const node = this.ctx.createWaveShaper();
    node.curve = curve;
    node.oversample = '2x';
    return node;
  }

  /**
   * A synthetic impulse response: a short pre-delay (the far wall), then dense
   * early reflections and a smooth decay, with the highs rolling off as the
   * tail travels. Stereo, because a mono tail sounds like a closet.
   */
  _buildReverb() {
    const rate = this.ctx.sampleRate;
    const seconds = 2.1;
    const length = Math.floor(rate * seconds);
    const preDelay = Math.floor(rate * 0.012);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        if (i < preDelay) { data[i] = 0; continue; }
        const t = (i - preDelay) / (length - preDelay);
        // Early reflections are discrete; the tail is dense.
        const early = i < rate * 0.09 && Math.random() > 0.86 ? 2.4 : 1;
        const decay = Math.pow(1 - t, 2.4);
        // One-pole low-pass so the tail darkens as it decays, like real air.
        const k = 0.32 - t * 0.2;
        lp += ((Math.random() * 2 - 1) - lp) * k;
        data[i] = lp * decay * early;
      }
    }
    const convolver = this.ctx.createConvolver();
    convolver.buffer = buffer;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.46;
    convolver.connect(wet).connect(this.effects);
    this.reverb = convolver;
  }

  _panner(pan) {
    const bus = this.effects || this.master;
    if (typeof pan !== 'number') return bus;
    if (!this.ctx.createStereoPanner) return bus;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(bus);
    return p;
  }

  _ramp(param, to, seconds = 1.2, when = 0) {
    const t = this.ctx.currentTime + when;
    const from = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(from, t);
    param.linearRampToValueAtTime(to, t + seconds);
  }

  /**
   * Band-passed noise burst.
   * `send` copies the signal into the room reverb, which is the difference
   * between a click in a void and a shot in a street.
   */
  _noise({
    dur = 0.2, gain = 0.4, type = 'lowpass', freq = 1200, q = 1, sweepTo = 0,
    attack = 0.002, pan = null, send = 0, when = 0, rate = 1, drive = 0,
  }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = this._panner(pan);
    src.connect(filter);
    let node = filter;
    if (drive > 0) {
      const sat = this._saturator(drive);
      node.connect(sat);
      node = sat;
    }
    node.connect(g).connect(out);
    if (send > 0 && this.reverb) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = send;
      g.connect(sendGain).connect(this.reverb);
    }
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _tone({
    freq = 220, to = 0, dur = 0.2, gain = 0.25, type = 'sine', attack = 0.004,
    detune = 0, pan = null, send = 0, when = 0,
  }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(16, to), t + dur);
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

  /**
   * One vocalised breath. A sawtooth glottal source with drift, three formant
   * resonators, a rasp layer and a breath layer, all under a syllable
   * envelope. This is the engine behind every growl, snarl and scream.
   */
  _voice({
    f0 = 90, dur = 0.6, vowel = 'a', gain = 0.2, pan = 0, send = 0.4,
    rasp = 0.5, breath = 0.3, syllables = 2, distance = 6, glide = 0.8,
    bite = 0.06, tremolo = 0,
  } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this._panner(pan);
    // Occlusion: distance is mostly a low-pass and a loss of level.
    const occl = ctx.createBiquadFilter();
    occl.type = 'lowpass';
    occl.frequency.value = clamp(11000 / (1 + distance * 0.55), 620, 11000);
    occl.Q.value = 0.4;
    occl.connect(out);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    const seg = dur / Math.max(1, syllables);
    for (let i = 0; i < syllables; i++) {
      const s0 = t + i * seg;
      env.gain.setValueAtTime(0.0001, s0);
      env.gain.linearRampToValueAtTime(gain, s0 + Math.min(bite, seg * 0.45));
      env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.34), s0 + seg * 0.88);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(occl);
    if (send > 0 && this.reverb) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = send;
      env.connect(sendGain).connect(this.reverb);
    }

    // Glottal source: a saw with a falling pitch envelope and slow drift.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 1.12, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, f0 * glide), t + dur);
    const drift = ctx.createOscillator();
    drift.frequency.value = 4.6 + Math.random() * 3.4;
    const driftGain = ctx.createGain();
    driftGain.gain.value = f0 * 0.035;
    drift.connect(driftGain).connect(osc.frequency);
    drift.start(t);
    drift.stop(t + dur + 0.05);

    if (tremolo > 0) {
      const trem = ctx.createOscillator();
      trem.frequency.value = 7 + Math.random() * 5;
      const tg = ctx.createGain();
      tg.gain.value = gain * tremolo;
      trem.connect(tg).connect(env.gain);
      trem.start(t);
      trem.stop(t + dur + 0.05);
    }

    const formants = VOWELS[vowel] || VOWELS.a;
    const weights = [1, 0.55, 0.28];
    formants.forEach((freq, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * (0.94 + Math.random() * 0.12), t);
      // Formants sag slightly through the phrase, as a tired throat does.
      bp.frequency.linearRampToValueAtTime(freq * 0.88, t + dur);
      bp.Q.value = 7 + i * 2.5;
      const fg = ctx.createGain();
      fg.gain.value = weights[i];
      osc.connect(bp).connect(fg).connect(env);
    });

    // The rasp: broadband noise forced through the same throat, plus a
    // subharmonic that gives big creatures their chest.
    if (rasp > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      src.playbackRate.value = 0.7 + Math.random() * 0.3;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = clamp(f0 * 4.5, 400, 3200);
      bp.Q.value = 1.6;
      const rg = ctx.createGain();
      rg.gain.value = rasp * 0.32;
      src.connect(bp).connect(rg).connect(env);
      src.start(t);
      src.stop(t + dur + 0.05);
    }
    if (breath > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1100 + Math.random() * 700;
      const bg = ctx.createGain();
      bg.gain.value = breath * 0.16;
      src.connect(hp).connect(bg).connect(env);
      src.start(t);
      src.stop(t + dur + 0.05);
    }

    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------- ambience

  _startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const bus = this.ambienceBus || this.master;

    // Wind: two filtered noise layers, one broad and one whistling through a
    // narrow band, both with slow, uncorrelated gusts.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 260;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.08;
    wind.connect(windFilter).connect(windGain).connect(bus);

    const gust = ctx.createOscillator();
    gust.frequency.value = 0.06;
    const gustGain = ctx.createGain();
    gustGain.gain.value = 150;
    gust.connect(gustGain).connect(windFilter.frequency);

    const gustLevel = ctx.createOscillator();
    gustLevel.frequency.value = 0.031;
    const gustLevelGain = ctx.createGain();
    gustLevelGain.gain.value = 0.035;
    gustLevel.connect(gustLevelGain).connect(windGain.gain);

    const whistle = ctx.createBufferSource();
    whistle.buffer = this.noiseBuffer;
    whistle.loop = true;
    whistle.playbackRate.value = 1.4;
    const whistleFilter = ctx.createBiquadFilter();
    whistleFilter.type = 'bandpass';
    whistleFilter.frequency.value = 780;
    whistleFilter.Q.value = 18;
    const whistleGain = ctx.createGain();
    whistleGain.gain.value = 0.01;
    whistle.connect(whistleFilter).connect(whistleGain).connect(bus);

    const wLfo = ctx.createOscillator();
    wLfo.frequency.value = 0.017;
    const wLfoGain = ctx.createGain();
    wLfoGain.gain.value = 340;
    wLfo.connect(wLfoGain).connect(whistleFilter.frequency);

    wind.start();
    gust.start();
    gustLevel.start();
    whistle.start();
    wLfo.start();

    // City hum: a pair of detuned low saws, almost inaudible, that stop the
    // night from sounding like a vacuum.
    const hum = ctx.createGain();
    hum.gain.value = 0.012;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 170;
    humFilter.connect(hum).connect(bus);
    for (const f of [41, 55.3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(humFilter);
      o.start();
    }

    const timer = window.setInterval(() => this._ambientEvent(), 11000);
    this.ambient = { wind, gust, windGain, whistle, whistleGain, gain: windGain, timer, level: 1 };
  }

  setAmbientLevel(v) {
    if (!this.ambient) return;
    this.ambient.level = clamp(v, 0, 1);
    this._ramp(this.ambient.windGain.gain, 0.08 * this.ambient.level + 0.004, 1.5);
    this._ramp(this.ambient.whistleGain.gain, 0.01 * this.ambient.level, 1.5);
  }

  /** Something happening three streets away, so the city is never empty. */
  _ambientEvent() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.ambient || this.ambient.level < 0.3) return;
    const roll = Math.random();
    const level = this.ambient.level;
    if (roll < 0.34) {
      // A short firefight nobody is winning: muffled, distant, uneven.
      const volley = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < volley; i++) {
        const when = 0.05 + i * (0.1 + Math.random() * 0.16);
        this._noise({
          dur: 0.12, gain: 0.05 * level, type: 'lowpass', freq: 1200,
          sweepTo: 300, q: 1.2, when, send: 0.9, pan: (Math.random() * 2 - 1) * 0.8,
        });
        this._tone({
          freq: 90 + Math.random() * 30, to: 42, dur: 0.14,
          gain: 0.035 * level, type: 'sine', when, send: 0.6,
        });
      }
    } else if (roll < 0.58) {
      // Torn metal: a long, uneasy resonance.
      this._tone({
        freq: 210 + Math.random() * 260, to: 120, dur: 2.4, gain: 0.022 * level,
        type: 'triangle', attack: 0.3, send: 1, when: 0, pan: (Math.random() * 2 - 1) * 0.9,
      });
    } else if (roll < 0.82) {
      // A far-off horde, many mouths at once.
      for (let i = 0; i < 3; i++) {
        this._voice({
          f0: 62 + Math.random() * 34, dur: 1.6 + Math.random(), vowel: 'o',
          gain: 0.028 * level, pan: (Math.random() * 2 - 1) * 0.9, send: 1,
          rasp: 0.7, breath: 0.4, syllables: 2, distance: 26, glide: 0.82,
        });
      }
    } else {
      // A siren dying somewhere south of the relay.
      this._tone({
        freq: 420, to: 560, dur: 3.2, gain: 0.02 * level, type: 'sine',
        attack: 0.6, send: 1, pan: (Math.random() * 2 - 1) * 0.7,
      });
      this._tone({
        freq: 560, to: 420, dur: 2.6, gain: 0.016 * level, type: 'sine',
        attack: 0.5, send: 1, when: 0.2,
      });
    }
  }

  // ---------------------------------------------------------------- music

  startMusic() {
    if (!this.ctx || this.music) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.musicBus || this.master);

    const room = ctx.createGain();
    room.gain.value = 0.5;
    out.connect(room).connect(this.reverb);

    // ---- drone: three detuned voices through a slowly breathing filter.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(out);
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 620;
    droneFilter.Q.value = 1.1;
    droneFilter.connect(droneGain);
    const droneOscs = [];
    for (const [type, detune, level, mult] of [
      ['sawtooth', -8, 0.16, 1], ['sawtooth', 9, 0.13, 1], ['triangle', 0, 0.2, 2],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.value = CHORDS[0][0] * mult;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(droneFilter);
      o.start();
      droneOscs.push({ osc: o, mult });
    }
    const breathe = ctx.createOscillator();
    breathe.frequency.value = 0.045;
    const breatheGain = ctx.createGain();
    breatheGain.gain.value = 240;
    breathe.connect(breatheGain).connect(droneFilter.frequency);
    breathe.start();

    // ---- sub pulse: the heartbeat under everything.
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0;
    pulseGain.connect(out);

    // ---- percussion.
    const percGain = ctx.createGain();
    percGain.gain.value = 0;
    percGain.connect(out);

    // ---- motif, with a dotted-eighth echo so it sits behind the gunfire.
    const motifGain = ctx.createGain();
    motifGain.gain.value = 0;
    motifGain.connect(out);
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.36;
    delay.connect(feedback).connect(delay);
    const echo = ctx.createGain();
    echo.gain.value = 0.4;
    delay.connect(echo).connect(out);
    motifGain.connect(delay);

    // ---- boss layer: low brass-ish weight that only arrives with a boss.
    const bossGain = ctx.createGain();
    bossGain.gain.value = 0;
    bossGain.connect(out);
    const bossFilter = ctx.createBiquadFilter();
    bossFilter.type = 'lowpass';
    bossFilter.frequency.value = 420;
    bossFilter.Q.value = 2;
    bossFilter.connect(bossGain);
    const bossOscs = [];
    for (const mult of [0.5, 0.75, 1]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = (Math.random() * 2 - 1) * 14;
      o.frequency.value = CHORDS[0][0] * mult;
      const g = ctx.createGain();
      g.gain.value = 0.07;
      o.connect(g).connect(bossFilter);
      o.start();
      bossOscs.push({ osc: o, mult });
    }

    this.music = {
      out, droneGain, droneOscs, droneFilter, pulseGain, percGain, motifGain, bossGain, bossOscs, delay,
    };
    this.musicStep = 0;
    this.musicNext = ctx.currentTime + 0.1;
    this.musicIntensity = -1;
    this.music.timer = window.setInterval(() => this._scheduleMusic(), 55);
    this.setMusicIntensity(this.pendingIntensity);
  }

  /**
   * 0 = menu hush (pad and the odd motif note), 0.3 = between waves,
   * 0.6 = a wave, 0.85 = surge, 1 = boss.
   */
  setMusicIntensity(value) {
    const x = clamp(value, 0, 1);
    this.pendingIntensity = x;
    if (!this.ctx || !this.music) return;
    if (Math.abs(x - this.musicIntensity) < 0.02) return;
    this.musicIntensity = x;
    const m = this.music;
    this._ramp(m.droneGain.gain, 0.3 + x * 0.22, 1.8);
    this._ramp(this.music.droneFilter.frequency, 480 + x * 520, 1.8);
    this._ramp(m.pulseGain.gain, x > 0.22 ? 0.28 + x * 0.18 : 0, 1.4);
    this._ramp(m.percGain.gain, clamp((x - 0.3) * 1.5, 0, 0.85), 1.2);
    this._ramp(m.motifGain.gain, clamp((x - 0.42) * 1.6, 0, 0.7), 1.4);
    this._ramp(m.bossGain.gain, clamp((x - 0.8) * 3, 0, 0.75), 1.0);
  }

  stopMusic() {
    if (!this.music) return;
    window.clearInterval(this.music.timer);
    this._ramp(this.music.out.gain, 0, 1.2);
    const m = this.music;
    window.setTimeout(() => m.out.disconnect(), 1400);
    this.music = null;
  }

  _scheduleMusic() {
    if (!this.ctx || !this.music) return;
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // A throttled background tab can leave the clock far behind; skip the gap
    // instead of firing a burst of notes when it wakes up.
    if (this.musicNext < now) this.musicNext = now + 0.06;
    while (this.musicNext < now + 0.28) {
      this._musicStep(this.musicStep, this.musicNext);
      this.musicStep += 1;
      this.musicNext += STEP;
    }
  }

  _musicStep(step, t) {
    const m = this.music;
    if (!m) return;
    const x = this.musicIntensity;
    const bar = Math.floor(step / STEPS_PER_BAR) % CHORDS.length;
    const s = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];
    const when = Math.max(0, t - this.ctx.currentTime);

    if (s === 0) {
      // The pad changes chord once a bar, gliding rather than cutting.
      for (const { osc, mult } of m.droneOscs) {
        const target = chord[0] * mult;
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(target, t + 1.1);
      }
      for (const { osc, mult } of m.bossOscs) {
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(chord[0] * mult, t + 0.9);
      }
    }

    if (x <= 0.22) {
      // Menu / results: one distant motif note every couple of bars is all.
      if (s === 0 && this.musicStep % (STEPS_PER_BAR * 2) === 0) {
        this._pluck(MOTIF[2], t, 0.11);
      }
      return;
    }

    // Sub pulse on the downbeat and the half-bar.
    if (s === 0 || s === 8) {
      this._sub(chord[0] / 2, t, 0.34 + x * 0.2);
    }

    if (x > 0.3) {
      // Kick: downbeat, the "and" of two, and a late push.
      if (s === 0 || s === 6 || s === 10 || (s === 12 && x > 0.78)) {
        this._kick(t, 0.3 + x * 0.2, when);
      }
      // Industrial percussion: a slack snare on the backbeat.
      if (s === 8) this._clank(t, 0.16 + x * 0.1, when);
      // Hats, sparse and dry.
      if (s % 4 === 2) this._hat(t, 0.028 + x * 0.02, when);
    }

    if (x > 0.42) {
      // The motif: sparse, never on every beat, always resolving.
      if (s === 0 || s === 7 || s === 11 || s === 14) {
        const notes = [0, 2, 4, 3, 1, 2, 0];
        const n = MOTIF[notes[this.motifIndex % notes.length]];
        this._pluck(n, t, 0.075 + x * 0.05);
        this.motifIndex += 1;
      }
    }

    if (x > 0.9 && s === 0) {
      // Boss: a timpani hit announcing the phrase.
      this._tone({ freq: 62, to: 34, dur: 0.9, gain: 0.34, type: 'sine', attack: 0.004, when, send: 0.5 });
      this._noise({ dur: 0.6, gain: 0.07, type: 'lowpass', freq: 300, sweepTo: 90, when, send: 0.6 });
    }
  }

  _sub(freq, t, gain) {
    const when = Math.max(0, t - this.ctx.currentTime);
    this._tone({ freq, to: freq * 0.92, dur: 0.5, gain, type: 'sine', attack: 0.01, when });
    this._tone({ freq: freq * 2, to: freq * 1.6, dur: 0.22, gain: gain * 0.2, type: 'triangle', when });
  }

  _kick(t, gain, when) {
    this._tone({ freq: 118, to: 44, dur: 0.16, gain, type: 'sine', attack: 0.002, when });
    this._noise({ dur: 0.035, gain: gain * 0.3, type: 'bandpass', freq: 1800, q: 1.2, when });
  }

  _clank(t, gain, when) {
    this._noise({ dur: 0.14, gain, type: 'bandpass', freq: 1900, q: 0.9, sweepTo: 620, when, send: 0.35 });
    this._tone({ freq: 320, to: 190, dur: 0.16, gain: gain * 0.5, type: 'triangle', when, send: 0.3 });
  }

  _hat(t, gain, when) {
    this._noise({ dur: 0.035, gain, type: 'highpass', freq: 7200, q: 0.8, when });
  }

  _pluck(freq, t, gain) {
    const when = Math.max(0, t - this.ctx.currentTime);
    this._tone({ freq, to: freq * 0.999, dur: 0.42, gain, type: 'triangle', attack: 0.006, when, send: 0.4 });
    this._tone({ freq: freq * 2, dur: 0.18, gain: gain * 0.28, type: 'sine', attack: 0.004, when });
    this._tone({ freq: freq * 0.5, dur: 0.5, gain: gain * 0.2, type: 'sine', attack: 0.008, when });
  }

  // ---------------------------------------------------------------- weapons

  /**
   * A gunshot is six events in a fixed order: pin, blast, crack, thump, bark,
   * tail. Get the gaps between them right and the ear hears a real firearm.
   */
  shot(kind) {
    if (!this.ctx) return;
    const cfg = {
      pistol: {
        blast: [0.085, 1900, 0.44], crack: [0.03, 5200, 0.36],
        body: [148, 50, 0.15, 0.42], bark: [0.07, 950, 0.2], tail: [0.5, 0.2, 820],
        action: 2400, drive: 7,
      },
      smg: {
        blast: [0.06, 2400, 0.33], crack: [0.024, 6000, 0.3],
        body: [176, 78, 0.09, 0.26], bark: [0.05, 1300, 0.15], tail: [0.28, 0.15, 1400],
        action: 3100, drive: 6,
      },
      shotgun: {
        blast: [0.15, 1100, 0.62], crack: [0.04, 3400, 0.3],
        body: [86, 30, 0.34, 0.56], bark: [0.12, 620, 0.3], tail: [0.85, 0.3, 560],
        action: 1500, drive: 12,
      },
      rifle: {
        blast: [0.075, 2300, 0.5], crack: [0.028, 6800, 0.48],
        body: [122, 42, 0.19, 0.46], bark: [0.07, 1050, 0.24], tail: [0.68, 0.26, 720],
        action: 2700, drive: 9,
      },
      lmg: {
        blast: [0.08, 1700, 0.44], crack: [0.028, 5000, 0.38],
        body: [128, 52, 0.12, 0.34], bark: [0.06, 880, 0.2], tail: [0.42, 0.2, 980],
        action: 2200, drive: 8,
      },
    }[kind] || {
      blast: [0.08, 1900, 0.4], crack: [0.03, 5200, 0.35],
      body: [140, 55, 0.14, 0.4], bark: [0.06, 900, 0.2], tail: [0.45, 0.2, 850],
      action: 2400, drive: 7,
    };

    // 1. The action, a few milliseconds before the blast: the mechanical tell
    //    that separates a real gunshot from a firework.
    this._noise({ dur: 0.012, gain: 0.13, type: 'bandpass', freq: cfg.action, q: 1.6, attack: 0.0008 });
    this._tone({ freq: cfg.action * 0.5, to: cfg.action * 0.3, dur: 0.02, gain: 0.05, type: 'square' });

    // 2. Muzzle blast: noise through a fast-closing low-pass, saturated.
    const [bd, bf, bg] = cfg.blast;
    this._noise({ dur: bd, gain: bg, type: 'lowpass', freq: bf, sweepTo: bf * 0.28, q: 0.9, attack: 0.0015, send: 0.7, drive: cfg.drive });
    this._noise({ dur: bd * 0.5, gain: bg * 0.4, type: 'bandpass', freq: bf * 1.6, q: 1.1, attack: 0.001, send: 0.4 });

    // 3. Supersonic crack: 20-30 ms of very bright noise, gone instantly.
    const [cd, cf, cg] = cfg.crack;
    this._noise({ dur: cd, gain: cg, type: 'highpass', freq: cf, q: 0.7, sweepTo: cf * 0.4, attack: 0.0006, send: 0.3 });

    // 4. Chest thump: the low pressure wave, felt more than heard.
    const [lf, lt, ld, lg] = cfg.body;
    this._tone({ freq: lf, to: lt, dur: ld, gain: lg, type: 'sine', attack: 0.0018, send: 0.5 });
    this._noise({ dur: ld * 0.7, gain: lg * 0.45, type: 'lowpass', freq: 520, sweepTo: 110, q: 1.2 });

    // 5. Midrange bark: the part a phone speaker can still reproduce.
    const [kd, kf, kg] = cfg.bark;
    this._noise({ dur: kd, gain: kg, type: 'bandpass', freq: kf, q: 1.4, sweepTo: kf * 0.45, attack: 0.002, send: 0.35 });

    // 6. The street answering back: one long tail into the reverb.
    const [td, tg, tf] = cfg.tail;
    this._noise({ dur: td, gain: tg, type: 'lowpass', freq: tf, sweepTo: tf * 0.35, q: 0.6, attack: 0.014, send: 1 });

    // Brass hitting concrete, a moment later. Not on every shot, and quieter
    // than the report, but it is the detail that sells the reload room.
    if (Math.random() < 0.55) {
      const ping = 2400 + Math.random() * 2100;
      this._tone({ freq: ping, to: ping * 0.72, dur: 0.05, gain: 0.035, type: 'triangle', when: 0.045 + Math.random() * 0.05, send: 0.35 });
    }
    if (kind === 'shotgun') {
      // Pump action cycling after the blast.
      this._noise({ dur: 0.05, gain: 0.1, type: 'bandpass', freq: 1300, q: 2.2, when: 0.22 });
      this._noise({ dur: 0.045, gain: 0.08, type: 'bandpass', freq: 900, q: 2, when: 0.34 });
    }
    if (kind === 'rifle' || kind === 'lmg') {
      this._noise({ dur: 0.04, gain: 0.06, type: 'bandpass', freq: 1800, q: 2.4, when: 0.09 });
    }
  }

  dryFire() { this._noise({ dur: 0.035, gain: 0.15, type: 'highpass', freq: 2800, attack: 0.0008 }); }
  pinPull() {
    this._tone({ freq: 1250, to: 720, dur: 0.05, gain: 0.08, type: 'triangle' });
    this._noise({ dur: 0.05, gain: 0.11, type: 'bandpass', freq: 2400, q: 2 });
  }

  /** Magazine out, magazine in: two different metal events, not one click. */
  reloadStart() {
    this._noise({ dur: 0.07, gain: 0.12, type: 'bandpass', freq: 1500, q: 1.6, sweepTo: 700 });
    this._tone({ freq: 620, to: 380, dur: 0.06, gain: 0.05, type: 'square' });
  }
  reloadStep() {
    this._noise({ dur: 0.055, gain: 0.18, type: 'bandpass', freq: 1150, q: 2.2 });
    this._tone({ freq: 380, to: 210, dur: 0.05, gain: 0.06, type: 'square' });
  }
  reloadEnd() {
    this._noise({ dur: 0.09, gain: 0.22, type: 'bandpass', freq: 1050, q: 1.8, sweepTo: 600 });
    this._tone({ freq: 640, to: 300, dur: 0.07, gain: 0.08, type: 'square' });
    this._noise({ dur: 0.04, gain: 0.1, type: 'highpass', freq: 3200, when: 0.05 });
  }

  weaponSwap() { this._noise({ dur: 0.1, gain: 0.14, type: 'bandpass', freq: 1000, q: 1.6, sweepTo: 500 }); }

  /** Blade leaving the sheath: air moving, not a gun. */
  melee() {
    this._noise({ dur: 0.18, gain: 0.22, type: 'bandpass', freq: 480, q: 0.6, sweepTo: 3000, attack: 0.03, send: 0.3 });
    this._tone({ freq: 880, to: 240, dur: 0.14, gain: 0.05, type: 'sawtooth' });
  }

  /** Blade meeting a body: a wet chop, a tear, and a ring on the metal. */
  meleeHit() {
    this._noise({ dur: 0.14, gain: 0.38, type: 'lowpass', freq: 1500, sweepTo: 130, q: 1.3, drive: 4 });
    this._noise({ dur: 0.11, gain: 0.26, type: 'bandpass', freq: 640, q: 1.2, sweepTo: 190 });
    this._noise({ dur: 0.18, gain: 0.1, type: 'bandpass', freq: 1800, q: 3, sweepTo: 600, when: 0.01, send: 0.4 });
    this._tone({ freq: 1650, to: 900, dur: 0.17, gain: 0.06, type: 'triangle', send: 0.45 });
    this._tone({ freq: 96, to: 44, dur: 0.14, gain: 0.2, type: 'sine' });
  }

  /** Grenade detonation: sub, blast, shockwave, falling debris. */
  explosion() {
    this._noise({ dur: 1.0, gain: 0.7, type: 'lowpass', freq: 2000, sweepTo: 80, q: 0.9, attack: 0.003, send: 1, drive: 5 });
    this._tone({ freq: 86, to: 24, dur: 0.85, gain: 0.62, type: 'sine', attack: 0.002, send: 0.6 });
    this._tone({ freq: 44, to: 18, dur: 1.3, gain: 0.42, type: 'triangle' });
    this._noise({ dur: 0.32, gain: 0.28, type: 'bandpass', freq: 2400, q: 0.7, sweepTo: 500, attack: 0.002, send: 0.8 });
    // Debris pattering down after the blast, spread over half a second.
    for (let i = 0; i < 8; i++) {
      this._noise({
        dur: 0.08 + Math.random() * 0.12,
        gain: 0.06 + Math.random() * 0.09,
        type: 'bandpass',
        freq: 700 + Math.random() * 2200,
        q: 3,
        attack: 0.001,
        send: 0.5,
        when: 0.08 + Math.random() * 0.6,
        pan: (Math.random() * 2 - 1) * 0.6,
      });
    }
  }

  grenadeBounce() { this._tone({ freq: 420, to: 260, dur: 0.05, gain: 0.07, type: 'triangle' }); }

  /** A bloater coming apart: wet tearing over a low, gassy thump. */
  bloaterBurst() {
    this._noise({ dur: 0.58, gain: 0.46, type: 'lowpass', freq: 1200, sweepTo: 100, q: 1.1, attack: 0.003, send: 0.8, drive: 5 });
    this._tone({ freq: 70, to: 26, dur: 0.55, gain: 0.36, type: 'sine', attack: 0.003, send: 0.5 });
    // The gas: a wet, descending cloud rather than a clean hit.
    this._noise({ dur: 0.5, gain: 0.2, type: 'bandpass', freq: 700, q: 1.6, sweepTo: 170, attack: 0.02, send: 0.6 });
    for (let i = 0; i < 5; i++) {
      this._noise({
        dur: 0.1 + Math.random() * 0.12, gain: 0.07,
        type: 'bandpass', freq: 400 + Math.random() * 900, q: 4,
        send: 0.4, when: 0.05 + i * 0.07,
      });
    }
  }

  hit(head) {
    // Flesh, not a chime: a dull thud, a wet slap and, on a headshot, bone.
    this._noise({ dur: 0.08, gain: 0.2, type: 'bandpass', freq: 760, q: 1.1, sweepTo: 320 });
    this._noise({ dur: 0.1, gain: 0.13, type: 'lowpass', freq: 420, sweepTo: 150 });
    this._tone({ freq: 120, to: 62, dur: 0.08, gain: 0.12, type: 'sine' });
    if (head) {
      this._noise({ dur: 0.14, gain: 0.24, type: 'bandpass', freq: 2600, q: 1.4, send: 0.4, when: 0.004 });
      this._noise({ dur: 0.1, gain: 0.16, type: 'lowpass', freq: 900, sweepTo: 240, when: 0.01 });
      this._tone({ freq: 1500, to: 700, dur: 0.1, gain: 0.14, type: 'triangle', when: 0.004 });
    }
  }

  kill() { this._tone({ freq: 430, to: 170, dur: 0.16, gain: 0.13, type: 'triangle' }); }

  // ---------------------------------------------------------------- zombies

  /**
   * A growl is one long syllable pair from a throat that is mostly blockage.
   * Distance is handled twice: level and a low-pass, because a far growl is
   * muffled by the buildings between you and it.
   */
  growl(distance = 10, pan = 0) {
    if (!this.ctx) return;
    const falloff = clamp(12 / Math.max(2, distance), 0.05, 1);
    const f0 = 62 + Math.random() * 42;
    const vowel = ['a', 'o', 'a', 'u'][Math.floor(Math.random() * 4)];
    this._voice({
      f0, dur: 0.55 + Math.random() * 0.4, vowel, gain: 0.13 * falloff, pan,
      send: 0.55, rasp: 0.55 + Math.random() * 0.25, breath: 0.3,
      syllables: 2 + (Math.random() < 0.4 ? 1 : 0), distance, glide: 0.62 + Math.random() * 0.2,
      bite: 0.07, tremolo: 0.15,
    });
    // A second, detuned throat close by: the "many mouths" impression.
    if (falloff > 0.5) {
      this._voice({
        f0: f0 * 1.04, dur: 0.5, vowel: 'o', gain: 0.055 * falloff, pan: -pan * 0.6,
        send: 0.4, rasp: 0.7, breath: 0.2, syllables: 2, distance, glide: 0.7, bite: 0.09,
      });
    }
  }

  /**
   * A lurker closing in: a low, fast, breathy rush that reads as a shape moving
   // through the dark rather than a mouth opening.
   */
  lurkerCry(distance = 8, pan = 0) {
    if (!this.ctx) return;
    const falloff = clamp(12 / Math.max(2, distance), 0.05, 1);
    this._voice({
      f0: 96 + Math.random() * 36, dur: 0.26, vowel: 'u', gain: 0.16 * falloff, pan,
      send: 0.5, rasp: 0.85, breath: 0.7, syllables: 1, distance, glide: 0.5,
      bite: 0.11, tremolo: 0.25,
    });
    this._noise({ dur: 0.14, gain: 0.08 * falloff, type: 'bandpass', freq: 900, q: 2, sweepTo: 400, pan, when: 0.03 });
  }

  /** Short, aggressive snarl when a zombie commits to a bite. */
  snarl(distance = 5, pan = 0) {
    if (!this.ctx) return;
    const falloff = clamp(10 / Math.max(2, distance), 0.08, 1);
    this._voice({
      f0: 128 + Math.random() * 70, dur: 0.3, vowel: 'e', gain: 0.2 * falloff, pan,
      send: 0.45, rasp: 0.9, breath: 0.5, syllables: 2, distance, glide: 0.7, bite: 0.035,
    });
    this._noise({ dur: 0.16, gain: 0.1 * falloff, type: 'bandpass', freq: 1500, q: 1.6, sweepTo: 500, pan, when: 0.04 });
  }

  /** Dying gurgle: pitch collapses, the throat fills, the body lands. */
  zombieDeath() {
    if (!this.ctx) return;
    this._voice({
      f0: 128 + Math.random() * 30, dur: 0.9, vowel: 'o', gain: 0.18, send: 0.5,
      rasp: 0.8, breath: 0.35, syllables: 3, distance: 4, glide: 0.32, bite: 0.05,
    });
    for (let i = 0; i < 5; i++) {
      this._noise({
        dur: 0.07 + Math.random() * 0.06,
        gain: 0.05 + Math.random() * 0.03,
        type: 'bandpass', freq: 180 + Math.random() * 220, q: 6,
        when: 0.15 + i * 0.11, send: 0.25,
      });
    }
    // The drop.
    this._tone({ freq: 84, to: 40, dur: 0.16, gain: 0.16, type: 'sine', when: 0.72 });
    this._noise({ dur: 0.2, gain: 0.12, type: 'lowpass', freq: 340, sweepTo: 120, when: 0.72 });
  }

  /** A distant moan drifting across the city between waves. */
  distantMoan() {
    if (!this.ctx) return;
    this._voice({
      f0: 58 + Math.random() * 40, dur: 2.1, vowel: ['o', 'u', 'a'][Math.floor(Math.random() * 3)],
      gain: 0.05, send: 1, rasp: 0.5, breath: 0.5, syllables: 1, distance: 30, glide: 0.78, bite: 0.5,
      pan: (Math.random() * 2 - 1) * 0.85,
    });
  }

  footstep(sprint) {
    // Boot: heel thud, then grit under the sole.
    this._noise({ dur: 0.09, gain: sprint ? 0.14 : 0.09, type: 'bandpass', freq: 400 + Math.random() * 180, q: 1.3 });
    this._noise({
      dur: 0.05, gain: sprint ? 0.06 : 0.04, type: 'highpass', freq: 2600,
      when: 0.02 + Math.random() * 0.02,
    });
  }

  hurt() {
    if (!this.ctx) return;
    this._noise({ dur: 0.24, gain: 0.34, type: 'lowpass', freq: 700, sweepTo: 100, drive: 3 });
    this._tone({ freq: 78, to: 46, dur: 0.3, gain: 0.3, type: 'sine' });
    // A bitten-off grunt: the player is human too.
    this._voice({ f0: 118, dur: 0.24, vowel: 'u', gain: 0.12, rasp: 0.5, breath: 0.6, syllables: 1, bite: 0.02, send: 0.2 });
  }

  /** Damage cue panned to the side the hit came from. */
  impact(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(filter).connect(g).connect(this._panner(pan));
    src.start(t);
    src.stop(t + 0.2);
  }

  pickup() {
    // Cloth and metal, not a coin: a short rustle under a dull clink.
    this._noise({ dur: 0.12, gain: 0.08, type: 'bandpass', freq: 1700, q: 0.9, sweepTo: 3200 });
    this._tone({ freq: 520, to: 780, dur: 0.12, gain: 0.1, type: 'triangle', when: 0.02 });
    this._tone({ freq: 790, to: 1040, dur: 0.14, gain: 0.06, type: 'sine', when: 0.03 });
  }

  /** Acid leaving a throat: a wet, descending squelch. */
  spit() {
    this._noise({ dur: 0.24, gain: 0.28, type: 'bandpass', freq: 700, q: 2, sweepTo: 160 });
    this._tone({ freq: 240, to: 80, dur: 0.26, gain: 0.12, type: 'sine' });
    this._voice({ f0: 150, dur: 0.18, vowel: 'a', gain: 0.06, rasp: 0.8, breath: 0.5, syllables: 1, bite: 0.02 });
  }

  waveAlarm(surge) {
    // An air-raid siren two streets over, not a beep.
    if (surge) {
      this._tone({ freq: 300, to: 780, dur: 0.34, gain: 0.18, type: 'sawtooth', send: 0.4 });
      this._tone({ freq: 780, to: 300, dur: 0.36, gain: 0.15, type: 'sawtooth', send: 0.4, when: 0.32 });
      this._tone({ freq: 260, to: 820, dur: 0.4, gain: 0.12, type: 'square', when: 0.66 });
      this._noise({ dur: 0.5, gain: 0.08, type: 'bandpass', freq: 900, q: 2, send: 0.6, when: 0.05 });
      return;
    }
    this._tone({ freq: 320, to: 620, dur: 0.6, gain: 0.14, type: 'sawtooth', send: 0.35, attack: 0.05 });
    this._tone({ freq: 620, to: 300, dur: 0.85, gain: 0.11, type: 'sawtooth', send: 0.35, when: 0.55, attack: 0.05 });
    this._noise({ dur: 1.1, gain: 0.05, type: 'bandpass', freq: 700, q: 3, send: 0.7, attack: 0.2 });
  }

  /** Boss arrival: a long, low horn under a rising rattle. */
  bossAlarm() {
    this._tone({ freq: 58, to: 96, dur: 1.2, gain: 0.32, type: 'sawtooth', send: 0.7, attack: 0.08 });
    this._tone({ freq: 150, to: 74, dur: 1.5, gain: 0.2, type: 'square', send: 0.5, when: 0.1 });
    this._noise({ dur: 1.3, gain: 0.14, type: 'lowpass', freq: 380, q: 2, sweepTo: 110, send: 0.7, attack: 0.15 });
    this._voice({ f0: 48, dur: 1.6, vowel: 'u', gain: 0.16, rasp: 0.8, breath: 0.3, syllables: 1, distance: 3, glide: 0.9, bite: 0.4, send: 0.7 });
  }

  /** Boss tell: an indrawn, rising growl. This is the warning, so it is
   * deliberately louder and longer than an ordinary snarl. */
  bossTell(pan = 0) {
    this._voice({
      f0: 74, dur: 0.8, vowel: 'o', gain: 0.24, pan, send: 0.65,
      rasp: 0.9, breath: 0.4, syllables: 3, distance: 4, glide: 1.25, bite: 0.08, tremolo: 0.2,
    });
    this._noise({ dur: 0.75, gain: 0.09, type: 'bandpass', freq: 420, q: 2.4, sweepTo: 1100, pan, send: 0.5 });
  }

  /** The instant a boss commits to its move. */
  bossRelease(pan = 0) {
    this._voice({
      f0: 92, dur: 0.5, vowel: 'a', gain: 0.3, pan, send: 0.55,
      rasp: 1, breath: 0.6, syllables: 1, distance: 3, glide: 0.5, bite: 0.015,
    });
    this._tone({ freq: 195, to: 62, dur: 0.42, gain: 0.24, type: 'square', pan, send: 0.5 });
    this._noise({ dur: 0.34, gain: 0.2, type: 'lowpass', freq: 1000, sweepTo: 220, pan, send: 0.4, drive: 4 });
  }

  /** Ground slam: sub-bass thud with a debris tail. */
  bossSlam() {
    this._tone({ freq: 44, to: 23, dur: 0.55, gain: 0.4, type: 'sine' });
    this._noise({ dur: 0.5, gain: 0.28, type: 'lowpass', freq: 260, sweepTo: 60, send: 0.6, drive: 4 });
    this._noise({ dur: 0.34, gain: 0.09, type: 'highpass', freq: 1600, send: 0.4, when: 0.03 });
  }

  heartbeat() { this._tone({ freq: 62, to: 38, dur: 0.17, gain: 0.22, type: 'sine' }); }
}
