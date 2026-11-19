// Road Riot 3D - High Octane Audio & Synth Engine
// Combines authentic audio samples with 100% reliable procedural Web Audio synthesizers

class RoadAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.engineGain = null;

    this.isMuted = localStorage.getItem('roadriot_mute') === 'true';
    this.musicEnabled = localStorage.getItem('roadriot_music') !== 'false';
    this.volume = parseFloat(localStorage.getItem('roadriot_vol') || '0.75');

    // Engine sound sources
    this.engineBuffer = null;
    this.engineSource = null;
    this.engineFilter = null;
    this.engineLoading = false;

    // Procedural Synth Engine
    this.proceduralEngine = null;

    // Music Sequencer
    this.musicPlaying = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.bpm = 132;
    this.filterEnvelope = 1200;

    // Sound asset URLs
    this.clipUrls = {
      boost: './assets/audio/boost.wav',
      collision: './assets/audio/crash.wav',
      pickup: './assets/audio/pickup.wav',
      engine: './assets/audio/engine-natural.mp3'
    };
    this.buffers = {};
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.masterGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.38 : 0;
      this.musicGain.connect(this.masterGain);

      // Engine Bus with low-pass filter
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 1600;
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.preloadSamples();
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  async resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
  }

  async preloadSamples() {
    for (const [key, url] of Object.entries(this.clipUrls)) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(ab);
          this.buffers[key] = decoded;
          if (key === 'engine') {
            this.engineBuffer = decoded;
          }
        }
      } catch (err) {
        // Fallback to procedural audio gracefully
      }
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    localStorage.setItem('roadriot_mute', muted ? 'true' : 'false');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('roadriot_music', this.musicEnabled ? 'true' : 'false');
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.38 : 0, this.ctx.currentTime, 0.1);
    }
    return this.musicEnabled;
  }

  // --- PROCEDURAL ENGINE NOISE & SAMPLES ---
  startEngine() {
    if (!this.ctx) this.init();
    this.resume();

    if (this.engineBuffer && !this.engineSource) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.engineBuffer;
        src.loop = true;
        src.loopStart = Math.min(2.15, this.engineBuffer.duration * 0.4);
        src.loopEnd = Math.max(src.loopStart + 1.2, this.engineBuffer.duration - 0.1);
        src.playbackRate.value = 0.85;
        src.connect(this.engineFilter);
        src.start(0);
        this.engineSource = src;
      } catch (e) {
        this.engineSource = null;
      }
    }

    // Also spin up procedural backup engine synth
    if (!this.proceduralEngine && this.ctx) {
      this.startProceduralEngine();
    }

    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0.24, this.ctx.currentTime, 0.15);
    }
  }

  startProceduralEngine() {
    if (!this.ctx || this.proceduralEngine) return;
    try {
      const t = this.ctx.currentTime;
      // White noise generator for exhaust rumble
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 180;
      noiseFilter.Q.value = 3.5;

      // Primary cylinder rumble oscillator
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;

      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.value = 28;

      const pGain = this.ctx.createGain();
      pGain.gain.value = 0.08;

      noise.connect(noiseFilter);
      noiseFilter.connect(pGain);
      osc.connect(pGain);
      sub.connect(pGain);
      pGain.connect(this.engineFilter);

      noise.start(t);
      osc.start(t);
      sub.start(t);

      this.proceduralEngine = { noise, osc, sub, noiseFilter, pGain };
    } catch (e) {}
  }

  stopEngine() {
    if (this.engineSource) {
      try {
        this.engineSource.stop();
        this.engineSource.disconnect();
      } catch (e) {}
      this.engineSource = null;
    }
    if (this.proceduralEngine) {
      try {
        this.proceduralEngine.noise.stop();
        this.proceduralEngine.osc.stop();
        this.proceduralEngine.sub.stop();
        this.proceduralEngine.pGain.disconnect();
      } catch (e) {}
      this.proceduralEngine = null;
    }
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  updateEngine(speed, isBoosting, maxSpeed = 30) {
    if (!this.ctx || !this.engineGain) return;
    const ratio = Math.max(0, Math.min(1.4, speed / maxSpeed));
    const now = this.ctx.currentTime;

    // Pitch shift natural audio
    if (this.engineSource) {
      const targetRate = 0.75 + ratio * 0.75 + (isBoosting ? 0.35 : 0);
      this.engineSource.playbackRate.setTargetAtTime(targetRate, now, 0.05);
    }

    // Pitch shift procedural backup
    if (this.proceduralEngine) {
      const baseFreq = 48 + ratio * 95 + (isBoosting ? 45 : 0);
      this.proceduralEngine.osc.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.proceduralEngine.sub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
      this.proceduralEngine.noiseFilter.frequency.setTargetAtTime(140 + ratio * 280, now, 0.06);
    }

    // Engine Filter cutoff expands with speed
    const cutoff = 1000 + ratio * 2800 + (isBoosting ? 2000 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
  }

  // --- SOUND EFFECTS ---
  play(type) {
    if (!this.ctx) return;
    this.resume();

    // If we have a cached decoded buffer, play it
    if (this.buffers[type]) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[type];
        src.connect(this.sfxGain);
        src.start(0);
        return;
      } catch (e) {}
    }

    // Otherwise, trigger rich procedural sound effect
    const now = this.ctx.currentTime;
    switch (type) {
      case 'nearmiss':
        this.synthNearMiss(now);
        break;
      case 'boost':
        this.synthBoost(now);
        break;
      case 'collision':
        this.synthCrash(now);
        break;
      case 'pickup':
      case 'coin':
        this.synthCoin(now);
        break;
      case 'missile':
        this.synthMissile(now);
        break;
      case 'emp':
        this.synthEmp(now);
        break;
      case 'shield':
        this.synthShield(now);
        break;
      case 'fever':
        this.synthFever(now);
        break;
      case 'drift':
        this.synthDrift(now);
        break;
      default:
        break;
    }
  }

  synthNearMiss(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.28);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  synthBoost(t) {
    // Jet hiss + rising laser whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.45);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  synthCrash(t) {
    // Heavy crunch + noise explosion
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  synthCoin(t) {
    // Twin arpeggio crystal ding
    [880, 1320].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.28, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.25);
    });
  }

  synthMissile(t) {
    // Rocket ignition sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  synthEmp(t) {
    // Electromagnetic surge
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(700, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  synthShield(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  synthFever(t) {
    [440, 554, 659, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.35, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.32);
    });
  }

  synthDrift(t) {
    // Tire squeal burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750 + Math.random() * 200, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // --- PROCEDURAL 80s CYBERPUNK SYNTHWAVE MUSIC SEQUENCER ---
  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.resume();
    this.musicStep = 0;
    this.scheduleNextBeat();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleNextBeat() {
    if (!this.musicPlaying || !this.ctx) return;
    const stepDuration = 60 / this.bpm / 4; // 16th note
    const now = this.ctx.currentTime;

    if (this.musicEnabled) {
      this.playSequencerStep(this.musicStep, now);
    }

    this.musicStep = (this.musicStep + 1) % 64;
    this.musicTimer = setTimeout(() => this.scheduleNextBeat(), stepDuration * 1000);
  }

  playSequencerStep(step, t) {
    // 16-step bass progression in D minor [D, F, G, Bb]
    const rootNotes = [73.42, 73.42, 87.31, 87.31, 98.0, 98.0, 116.54, 116.54]; // D2, F2, G2, Bb2
    const currentChordIndex = Math.floor(step / 8) % rootNotes.length;
    const root = rootNotes[currentChordIndex];

    // Driving Bassline (plays on 16th notes with rhythmic accent)
    if (step % 2 === 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      const bassFilter = this.ctx.createBiquadFilter();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(step % 4 === 2 ? root * 2 : root, t);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(650, t);
      bassFilter.frequency.exponentialRampToValueAtTime(180, t + 0.12);

      bassGain.gain.setValueAtTime(0.24, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);

      bassOsc.start(t);
      bassOsc.stop(t + 0.15);
    }

    // 4-on-the-floor Kick Drum (beats 0, 4, 8, 12)
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(140, t);
      kickOsc.frequency.exponentialRampToValueAtTime(42, t + 0.08);

      kickGain.gain.setValueAtTime(0.48, t);
      kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);
      kickOsc.start(t);
      kickOsc.stop(t + 0.18);
    }

    // Snare / Clap on beats 4 and 12
    if (step % 8 === 4) {
      const snareNoise = this.ctx.createOscillator();
      const snareGain = this.ctx.createGain();
      snareNoise.type = 'triangle';
      snareNoise.frequency.setValueAtTime(220, t);
      snareGain.gain.setValueAtTime(0.22, t);
      snareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      snareNoise.connect(snareGain);
      snareGain.connect(this.musicGain);
      snareNoise.start(t);
      snareNoise.stop(t + 0.14);
    }

    // Synth Arpeggios (in upper register)
    if (step % 4 === 2 || step % 4 === 3) {
      const arpNotes = [293.66, 349.23, 440.0, 523.25, 587.33]; // D, F, A, C, D
      const note = arpNotes[(step * 3) % arpNotes.length];
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      arpOsc.type = 'sine';
      arpOsc.frequency.setValueAtTime(note, t);

      arpGain.gain.setValueAtTime(0.08, t);
      arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      arpOsc.connect(arpGain);
      arpGain.connect(this.musicGain);
      arpOsc.start(t);
      arpOsc.stop(t + 0.14);
    }
  }
}

export const audio = new RoadAudioEngine();
