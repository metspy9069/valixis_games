/**
 * VALIXIS GAMES STUDIO - PROCEDURAL AUDIO SYNTHESIZER
 * 100% Web Audio API synthesis. ZERO EXTERNAL AUDIO FILES.
 */

class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.musicMuted = false;
    this.musicPlaying = false;
    this.musicStep = 0;
    this.musicInterval = null;
    this.bpm = 128;
    this.scale = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // A Minor Pentatonic / Hexatonic
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('AudioContext not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- SOUND EFFECTS ---
  playShoot(freq = 440) {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playHit() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCrit() {
    if (!this.ctx) return;
    this.resume();
    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.03);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.03 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + idx * 0.03);
      osc.stop(this.ctx.currentTime + idx * 0.03 + 0.25);
    });
  }

  playDash() {
    if (!this.ctx) return;
    this.resume();
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2200, this.ctx.currentTime + 0.15);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  playParry() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playLevelUp() {
    if (!this.ctx) return;
    this.resume();
    const notes = [329.63, 392.00, 493.88, 587.33, 659.25, 783.99]; // E Minor rising
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.35);
    });
  }

  playUltimate() {
    if (!this.ctx) return;
    this.resume();
    // Sub bass drop + chord burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);

    [440, 554.37, 659.25, 880].forEach(f => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, this.ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.4, this.ctx.currentTime + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(this.ctx.currentTime + 0.15);
      o.stop(this.ctx.currentTime + 0.8);
    });
  }

  playChest() {
    if (!this.ctx) return;
    this.resume();
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(this.ctx.currentTime + i * 0.06);
      osc.stop(this.ctx.currentTime + i * 0.06 + 0.3);
    });
  }

  playBossRoar() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  playHover() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  playClick() {
    if (!this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // --- DYNAMIC MUSIC GENERATOR ---
  toggleMusic() {
    this.init();
    this.resume();
    this.musicMuted = !this.musicMuted;
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(this.musicMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    if (!this.musicMuted && !this.musicPlaying) {
      this.startMusic();
    }
    return !this.musicMuted;
  }

  startMusic() {
    if (this.musicPlaying || !this.ctx) return;
    this.musicPlaying = true;
    const intervalMs = (60 / this.bpm) * 1000 / 4; // 16th notes
    const bassline = [55, 55, 55, 55, 49, 49, 49, 49, 43.65, 43.65, 43.65, 43.65, 41.2, 41.2, 49, 49];
    const arps = [220, 329.63, 261.63, 440, 293.66, 349.23, 246.94, 392.00];

    this.musicInterval = setInterval(() => {
      if (this.musicMuted || !this.ctx) return;

      const step = this.musicStep % 16;
      // Kick drum on 1, 5, 9, 13
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, this.ctx.currentTime);
        kickOsc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.08);
        kickGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);
        kickOsc.start();
        kickOsc.stop(this.ctx.currentTime + 0.08);
      }

      // Bass note
      if (step % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        const bassFreq = bassline[step] || 55;
        bassOsc.frequency.setValueAtTime(bassFreq, this.ctx.currentTime);
        bassGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);
        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);
        bassOsc.start();
        bassOsc.stop(this.ctx.currentTime + 0.14);
      }

      // Synth Arpeggio lead
      if (Math.random() > 0.25) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = 'square';
        const arpFreq = arps[this.musicStep % arps.length];
        leadOsc.frequency.setValueAtTime(arpFreq, this.ctx.currentTime);
        leadGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        leadGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        leadOsc.connect(leadGain);
        leadGain.connect(this.musicGain);
        leadOsc.start();
        leadOsc.stop(this.ctx.currentTime + 0.1);
      }

      this.musicStep++;
    }, intervalMs);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.musicPlaying = false;
  }
}

export const AudioSys = new AudioSynthesizer();
