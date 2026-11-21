// Road Riot 3D - High-Octane Audio & Procedural Synthesizer Engine
// Features authentic sample playback + multi-oscillator V8 transmission, turbo spool,
// blow-off valves, tire screech, stunt jumps, and 80s synthwave sequencer.

class RoadAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.engineGain = null;

    // Volume Settings (0.0 to 1.0)
    this.masterVolume = parseFloat(localStorage.getItem('roadriot_vol_master') ?? '0.85');
    this.engineVolume = parseFloat(localStorage.getItem('roadriot_vol_engine') ?? '0.75');
    this.sfxVolume = parseFloat(localStorage.getItem('roadriot_vol_sfx') ?? '0.85');
    this.musicVolume = parseFloat(localStorage.getItem('roadriot_vol_music') ?? '0.50');
    this.isMuted = localStorage.getItem('roadriot_mute') === 'true';

    // Natural Audio Buffer Cache & High-Fidelity Racing SFX
    this.buffers = {};
    this.clipUrls = {
      boost: './assets/audio/boost.wav',
      collision: './assets/audio/crash.wav',
      pickup: './assets/audio/pickup.wav',
      engine: './assets/audio/engine-natural.mp3',
      engine_ogg: './assets/audio/engine.ogg',
      boost_pad: './assets/audio/boost_pad.wav',
      booster: './assets/audio/boost_pad.wav',
      ramp_launch: './assets/audio/ramp_launch.wav',
      jump: './assets/audio/ramp_launch.wav',
      ramp_land: './assets/audio/ramp_land.wav',
      land: './assets/audio/ramp_land.wav',
      blowoff: './assets/audio/blowoff.wav',
      gear_shift: './assets/audio/gear_shift.wav',
      near_miss: './assets/audio/near_miss.wav',
      nearmiss: './assets/audio/near_miss.wav'
    };

    // Engine Synthesizer State (6-Speed Dual-Clutch Supercar Model)
    this.gear = 1;
    this.rpm = 1200; // 1000 to 7800 RPM
    this.targetRpm = 1200;
    this.lastSpeed = 0;
    this.isShifting = false;
    this.shiftTimer = 0;
    this.lastBoosting = false;
    this.isEngineRunning = false;
    this.proceduralEngine = null;
    this.engineSampleNode = null;
    this.engineSampleGain = null;
    this.windNode = null;
    this.windGain = null;

    // Tire Screech Generator
    this.tireScreech = null;

    // Music Sequencer State
    this.musicPlaying = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.bpm = 132;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Music Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      // Engine Bus with low-pass & warmth
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = this.engineVolume * 0.45;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 1800;
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

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
          if ((key === 'engine' || key === 'engine_ogg') && this.isEngineRunning && !this.engineSampleNode) {
            this.startEngineSample();
          }
        }
      } catch (err) {
        // Procedural fallbacks seamlessly handle missing audio
      }
    }
  }

  startEngineSample() {
    if (!this.ctx || this.engineSampleNode) return;
    const buf = this.buffers['engine'] || this.buffers['engine_ogg'];
    if (!buf) return;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = 0.75;

      this.engineSampleGain = this.ctx.createGain();
      this.engineSampleGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      src.connect(this.engineSampleGain);
      this.engineSampleGain.connect(this.engineFilter);

      src.start(0);
      this.engineSampleNode = src;
    } catch (err) {
      console.warn('Engine sample playback error:', err);
    }
  }

  makeDistortionCurve(k = 8) {
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // --- VOLUME & MIXER CONTROLS ---
  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('roadriot_vol_master', this.masterVolume.toString());
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setEngineVolume(val) {
    this.engineVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('roadriot_vol_engine', this.engineVolume.toString());
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(this.engineVolume * 0.45, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('roadriot_vol_sfx', this.sfxVolume.toString());
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('roadriot_vol_music', this.musicVolume.toString());
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    localStorage.setItem('roadriot_mute', muted ? 'true' : 'false');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  // --- AUTHENTIC SUPERCAR ENGINE & 6-SPEED DUAL-CLUTCH TRANSMISSION ---
  startEngine() {
    if (!this.ctx) this.init();
    this.resume();
    this.isEngineRunning = true;

    // 1. Natural Recorded Supercar Sample Playback (Looping Engine Core)
    this.startEngineSample();

    // 2. Warm Sub-Bass Rumble & Harmonics (Soft acoustic support, NO harsh buzzing)
    if (!this.proceduralEngine && this.ctx) {
      this.initProceduralEngine();
    }

    // 3. High-Speed Aerodynamic Wind Shearing Generator
    if (!this.windNode && this.ctx) {
      this.initWindShear();
    }

    // 4. Tire Screech for Drifts
    if (!this.tireScreech && this.ctx) {
      this.initTireScreech();
    }

    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(this.engineVolume * 0.55, this.ctx.currentTime, 0.1);
    }
  }

  initProceduralEngine() {
    const t = this.ctx.currentTime;

    // Soft Deep Sub-Bass Exhaust Purr (Triangle wave at 38 Hz - warm and punchy)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(38, t);

    // Warm Low-Mid Harmonic (Gentle triangle wave for smooth automotive rumble, no harsh buzzer)
    const midOsc = this.ctx.createOscillator();
    midOsc.type = 'triangle';
    midOsc.frequency.setValueAtTime(76, t);

    // Subtle Analog Warmth Saturation
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(1.5);
    shaper.oversample = '2x';

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.18, t);

    // Resonant Lowpass Filter (velvety automotive rumble)
    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(160, t);
    subFilter.Q.setValueAtTime(1.2, t);

    subOsc.connect(subFilter);
    midOsc.connect(subFilter);
    subFilter.connect(shaper);
    shaper.connect(subGain);
    subGain.connect(this.engineFilter);

    subOsc.start(t);
    midOsc.start(t);

    this.proceduralEngine = {
      subOsc,
      midOsc,
      subGain,
      subFilter
    };
  }

  initWindShear() {
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // High-speed air rush bandpass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, t);
    filter.Q.setValueAtTime(1.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    this.windNode = noise;
    this.windGain = gain;
    this.windFilter = filter;
  }

  initTireScreech() {
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.Q.setValueAtTime(4.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    this.tireScreech = { noise, filter, gain };
  }

  stopEngine() {
    this.isEngineRunning = false;
    if (this.engineSampleNode) {
      try {
        this.engineSampleNode.stop();
        this.engineSampleNode.disconnect();
      } catch (e) {}
      this.engineSampleNode = null;
    }
    if (this.proceduralEngine) {
      try {
        this.proceduralEngine.subOsc.stop();
        this.proceduralEngine.midOsc.stop();
        this.proceduralEngine.subGain.disconnect();
      } catch (e) {}
      this.proceduralEngine = null;
    }
    if (this.windNode) {
      try {
        this.windNode.stop();
        this.windGain.disconnect();
      } catch (e) {}
      this.windNode = null;
    }
    if (this.tireScreech) {
      try {
        this.tireScreech.noise.stop();
        this.tireScreech.gain.disconnect();
      } catch (e) {}
      this.tireScreech = null;
    }
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  updateEngine(speedKmh, isBoosting, isDrifting = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Lazily mount supercar audio sample if decoding completed during run
    if (!this.engineSampleNode && (this.buffers['engine'] || this.buffers['engine_ogg']) && this.isEngineRunning) {
      this.startEngineSample();
    }

    // 6-Speed Dual-Clutch Supercar Transmission Ratios
    // Gear thresholds:
    // 1st: 0-65 km/h
    // 2nd: 65-120 km/h
    // 3rd: 120-175 km/h
    // 4th: 175-230 km/h
    // 5th: 230-285 km/h
    // 6th: 285+ km/h
    let targetGear = 1;
    let gearMinSpeed = 0;
    let gearMaxSpeed = 65;

    if (speedKmh > 285) {
      targetGear = 6;
      gearMinSpeed = 285;
      gearMaxSpeed = 380;
    } else if (speedKmh > 230) {
      targetGear = 5;
      gearMinSpeed = 230;
      gearMaxSpeed = 285;
    } else if (speedKmh > 175) {
      targetGear = 4;
      gearMinSpeed = 175;
      gearMaxSpeed = 230;
    } else if (speedKmh > 120) {
      targetGear = 3;
      gearMinSpeed = 120;
      gearMaxSpeed = 175;
    } else if (speedKmh > 65) {
      targetGear = 2;
      gearMinSpeed = 65;
      gearMaxSpeed = 120;
    }

    // Upshift Detection -> Exhaust Crackle & Dual-Clutch Pop!
    if (targetGear > this.gear && !this.isShifting) {
      this.gear = targetGear;
      this.isShifting = true;
      this.shiftTimer = 0.12; // 120ms dual-clutch shift
      this.play('gear_shift');
    } else if (targetGear < this.gear) {
      this.gear = targetGear;
    }

    // Handle shift transition dip
    if (this.isShifting) {
      this.shiftTimer -= 0.016;
      if (this.shiftTimer <= 0) this.isShifting = false;
    }

    // Turbo blow-off valve detection on boost release
    if (this.lastBoosting && !isBoosting) {
      this.play('blowoff');
    }
    this.lastBoosting = isBoosting;

    // Calculate RPM inside current gear (1200 idle to 7800 redline)
    const gearSpan = Math.max(20, gearMaxSpeed - gearMinSpeed);
    const gearProgress = Math.max(0, Math.min(1, (speedKmh - gearMinSpeed) / gearSpan));
    let baseRpm = 1600 + gearProgress * 5600; // 1600 to 7200 RPM
    if (this.isShifting) {
      baseRpm *= 0.68; // RPM drop during shift
    }
    if (isBoosting) {
      baseRpm = Math.min(8200, baseRpm + 950);
    }

    this.rpm += (baseRpm - this.rpm) * 0.18;

    // Modulate Natural Sample Pitch (playbackRate: 0.68 idle -> 2.05 redline)
    if (this.engineSampleNode && this.engineSampleNode.playbackRate) {
      const targetRate = 0.68 + (this.rpm / 7800) * 1.35;
      this.engineSampleNode.playbackRate.setTargetAtTime(targetRate, now, 0.04);
    }

    // Sub-Bass Acoustic Exhaust Pulse
    if (this.proceduralEngine) {
      const pulseFreq = 34 + (this.rpm / 7800) * 65;
      this.proceduralEngine.subOsc.frequency.setTargetAtTime(pulseFreq, now, 0.04);
      this.proceduralEngine.midOsc.frequency.setTargetAtTime(pulseFreq * 2.0, now, 0.04);
      this.proceduralEngine.subFilter.frequency.setTargetAtTime(140 + (this.rpm / 7800) * 220, now, 0.04);
    }

    // Dynamic Engine Low-Pass Master Filter (opens up as RPM climbs for high-rev scream)
    if (this.engineFilter) {
      const filterFreq = 1200 + (this.rpm / 7800) * 3600 + (isBoosting ? 2000 : 0);
      this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
    }

    // Aerodynamic High-Speed Wind Shearing Noise (rises above 130 km/h)
    if (this.windGain && this.windFilter) {
      const windFactor = Math.max(0, (speedKmh - 130) / 220); // 0 at 130 km/h to 1.0 at 350 km/h
      const windVol = Math.pow(windFactor, 1.6) * 0.32;
      this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
      this.windFilter.frequency.setTargetAtTime(450 + windFactor * 850, now, 0.08);
    }

    // Tire Screech Volume during Drifts
    if (this.tireScreech) {
      const targetScreechGain = isDrifting ? 0.35 : 0;
      this.tireScreech.gain.gain.setTargetAtTime(targetScreechGain, now, 0.05);
      this.tireScreech.filter.frequency.setTargetAtTime(800 + Math.random() * 250, now, 0.04);
    }
  }

  getGear() {
    return this.gear;
  }

  getRpm() {
    return Math.round(this.rpm);
  }

  synthBlowOffValve(t) {
    // Turbo flutter / blow-off release ("stututu")
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.22);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, t);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    } catch (e) {}
  }

  // --- SOUND EFFECTS ---
  play(type) {
    if (!this.ctx) return;
    this.resume();

    // Natural Audio Buffer Playback
    if (this.buffers[type]) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[type];
        src.connect(this.sfxGain);
        src.start(0);
        return;
      } catch (e) {}
    }

    // Procedural Synthesizer SFX
    const now = this.ctx.currentTime;
    switch (type) {
      case 'nearmiss':
      case 'near_miss':
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
        // Handled dynamically in updateEngine()
        break;
      case 'jump':
      case 'ramp_launch':
        this.synthJumpLaunch(now);
        break;
      case 'land':
      case 'ramp_land':
        this.synthJumpLand(now);
        break;
      case 'booster':
      case 'boost_pad':
        this.synthBoosterSurge(now);
        break;
      case 'nitro_pickup':
      case 'nitro':
        this.synthNitroPickup(now);
        break;
      case 'countdown_tick':
        this.synthCountdownTick(now);
        break;
      case 'countdown_go':
        this.synthCountdownGo(now);
        break;
      case 'achievement':
        this.synthAchievement(now);
        break;
      case 'red_alert':
        this.synthRedAlert(now);
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
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.26);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(350, t + 0.26);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  synthBoost(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.42);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  synthCrash(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(24, t + 0.36);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  synthCoin(t) {
    [920, 1380].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.32, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.24);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.26);
    });
  }

  synthJumpLaunch(t) {
    // Sonic whoosh taking off
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(840, t + 0.35);

    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  synthJumpLand(t) {
    // Heavy suspension clunk & thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.28);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  synthBoosterSurge(t) {
    // Highway dash panel pulse
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(920, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.45);

    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.52);
  }

  synthNitroPickup(t) {
    // Supersonic high-octane pneumatic rush
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);

    // Chime harmonic
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, t + 0.05);
    chime.frequency.setValueAtTime(1760, t + 0.15);
    chimeGain.gain.setValueAtTime(0.35, t + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chime.start(t + 0.05);
    chime.stop(t + 0.48);
  }

  synthMissile(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.32);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  synthEmp(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(750, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.55);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  synthShield(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(960, t + 0.28);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

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

      gain.gain.setValueAtTime(0.38, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.35);
    });
  }

  synthRedAlert(t) {
    // Dual-tone high-urgency cockpit emergency warning pulse (880Hz -> 660Hz)
    [880, 660].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      const startTime = t + idx * 0.08;
      osc.frequency.setValueAtTime(freq, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startTime);

      gain.gain.setValueAtTime(0.32, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  synthCountdownTick(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  synthCountdownGo(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.48);
  }

  synthAchievement(t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.09);

      gain.gain.setValueAtTime(0.4, t + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.09);
      osc.stop(t + idx * 0.09 + 0.38);
    });
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

    if (!this.isMuted && this.musicVolume > 0) {
      this.playSequencerStep(this.musicStep, now);
    }

    this.musicStep = (this.musicStep + 1) % 64;
    this.musicTimer = setTimeout(() => this.scheduleNextBeat(), stepDuration * 1000);
  }

  playSequencerStep(step, t) {
    // 16-step bass progression in D minor [D, F, G, Bb]
    const rootNotes = [73.42, 73.42, 87.31, 87.31, 98.0, 98.0, 116.54, 116.54];
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

    // Lush 80s Synth Pad Chords (every 8 steps / 2 beats)
    if (step % 8 === 0) {
      const chordFreqs = [
        [146.83, 220.0, 293.66], // Dm (D3, A3, D4)
        [174.61, 261.63, 349.23], // F (F3, C4, F4)
        [196.0, 293.66, 392.0],   // G (G3, D4, G4)
        [233.08, 349.23, 466.16]  // Bb (Bb3, F4, Bb4)
      ];
      const chord = chordFreqs[Math.floor(step / 16) % chordFreqs.length];
      chord.forEach(f => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.linearRampToValueAtTime(1400, t + 0.3);
        filter.frequency.exponentialRampToValueAtTime(600, t + 0.85);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.88);
      });
    }

    // Crisp Hi-Hat tick on offbeats
    if (step % 4 === 2) {
      const hhOsc = this.ctx.createOscillator();
      const hhGain = this.ctx.createGain();
      hhOsc.type = 'square';
      hhOsc.frequency.setValueAtTime(4500, t);
      hhGain.gain.setValueAtTime(0.06, t);
      hhGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      hhOsc.connect(hhGain);
      hhGain.connect(this.musicGain);
      hhOsc.start(t);
      hhOsc.stop(t + 0.05);
    }

    // Synth Arpeggios (in upper register)
    if (step % 4 === 2 || step % 4 === 3) {
      const arpNotes = [293.66, 349.23, 440.0, 523.25, 587.33];
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
