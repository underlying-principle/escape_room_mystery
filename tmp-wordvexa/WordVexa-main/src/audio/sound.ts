export type SoundName = 'select' | 'valid' | 'invalid' | 'reaction' | 'win' | 'hint';

/** Tiny WebAudio synth: zero downloaded audio files, iframe-safe, <1KB assets. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  muted = false;

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
    void this.ctx?.close();
    this.ctx = null;
  }
}
