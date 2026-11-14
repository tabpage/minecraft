/**
 * Pure Web Audio API Procedural Sound Synthesizer for TERRAVEX.
 * Produces crisp, zero-dependency audio cues for footsteps, mining, placement,
 * combat, crafting, enchanting, eating, weather thunder, and creature sounds.
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public volume = 0.65;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0.01) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    return this.ctx;
  }

  public setSettings(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : volume;
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainVal: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainVal: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playStep(material: 'grass' | 'stone' | 'wood' | 'sand' | 'water' = 'grass') {
    const pitchJitter = 0.88 + Math.random() * 0.24;
    if (material === 'water') {
      this.playNoiseBurst(0.11, 900 * pitchJitter, 0.14);
    } else if (material === 'stone') {
      this.playNoiseBurst(0.055, 1350 * pitchJitter, 0.12);
      this.playTone(180 * pitchJitter, 95, 0.05, 'triangle', 0.08);
    } else if (material === 'wood') {
      this.playTone(230 * pitchJitter, 110, 0.06, 'triangle', 0.12);
    } else if (material === 'sand') {
      this.playNoiseBurst(0.075, 1800 * pitchJitter, 0.09);
    } else {
      this.playNoiseBurst(0.06, 720 * pitchJitter, 0.1);
    }
  }

  public playMineTick() {
    const j = 0.85 + Math.random() * 0.3;
    this.playNoiseBurst(0.045, 950 * j, 0.13);
    this.playTone(220 * j, 130, 0.05, 'square', 0.05);
  }

  public playBlockBreak() {
    this.playNoiseBurst(0.12, 650, 0.24);
    this.playTone(190, 68, 0.13, 'sawtooth', 0.12);
  }

  public playBlockPlace() {
    this.playTone(165, 250, 0.07, 'triangle', 0.18);
    this.playNoiseBurst(0.05, 850, 0.12);
  }

  public playPickup() {
    this.playTone(540, 880, 0.09, 'sine', 0.14);
  }

  public playCraft() {
    this.playTone(392, 523, 0.09, 'triangle', 0.14);
    setTimeout(() => this.playTone(523, 659, 0.11, 'triangle', 0.14), 70);
  }

  public playEnchant() {
    const notes = [440, 554, 659, 880];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.04, 0.18, 'sine', 0.13), idx * 65);
    });
  }

  public playEat() {
    this.playNoiseBurst(0.08, 1200, 0.16);
    setTimeout(() => this.playNoiseBurst(0.08, 1000, 0.14), 90);
  }

  public playHitEntity() {
    this.playNoiseBurst(0.08, 520, 0.22);
    this.playTone(260, 95, 0.11, 'sawtooth', 0.16);
  }

  public playPlayerHurt() {
    this.playTone(180, 65, 0.18, 'sawtooth', 0.22);
    this.playNoiseBurst(0.12, 400, 0.2);
  }

  public playLeverClick() {
    this.playTone(340, 480, 0.05, 'square', 0.1);
  }

  public playLevelUp() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, n, 0.16, 'triangle', 0.15), i * 80);
    });
  }

  public playBossRoar() {
    this.playTone(115, 42, 0.75, 'sawtooth', 0.28);
    this.playNoiseBurst(0.55, 220, 0.25);
  }

  public playThunder() {
    this.playNoiseBurst(0.9, 140, 0.3);
    this.playTone(85, 36, 0.85, 'sine', 0.22);
  }
}
