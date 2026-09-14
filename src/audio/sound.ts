export type SoundName = 'select' | 'valid' | 'invalid' | 'reaction' | 'win' | 'hint';

/** Tiny WebAudio synth: zero downloaded audio files, iframe-safe, <1KB assets. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  muted = false;
  private musicOn = false;
  private musicNodes: { stop: () => void } | null = null;

  constructor(muted = false) {
    this.muted = muted;
  }

  private context(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Quiet procedural ambient pad — the Music toggle in settings drives this. */
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) {
      this.musicNodes?.stop();
      this.musicNodes = null;
      return;
    }
    const ctx = this.context();
    if (!ctx || this.musicNodes) return;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 2.5);
    // Slow breathing so the pad feels alive.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.01;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    const oscs = [110, 164.81, 220, 329.63].map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.9 / (i + 1.4);
      osc.connect(g);
      g.connect(master);
      osc.start();
      return osc;
    });
    this.musicNodes = {
      stop: () => {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.8);
        window.setTimeout(() => {
          oscs.forEach((o) => o.stop());
          lfo.stop();
          master.disconnect();
        }, 900);
      },
    };
  }

  musicEnabled() {
    return this.musicOn;
  }

  play(name: SoundName) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(name === 'invalid' ? 0.035 : 0.055, t + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, t + (name === 'win' ? 0.75 : 0.25));
    master.connect(ctx.destination);
    const notes: Record<SoundName, number[]> = {
      select: [330],
      valid: [440, 660],
      invalid: [130, 110],
      reaction: [390, 590, 880],
      win: [392, 494, 587, 784],
      hint: [523, 659],
    };
    notes[name].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'invalid' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.6 / notes[name].length, t + i * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.22);
    });
  }

  dispose() {
    this.setMusic(false);
    void this.ctx?.close();
    this.ctx = null;
  }
}
