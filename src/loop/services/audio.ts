/**
 * THE LAST LOOP — procedural WebAudio. Zero audio files: every sound is
 * synthesized so the build stays tiny and iframe-safe.
 */

export class LoopAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicNodes: Array<OscillatorNode> = [];
  private humNode: { osc: OscillatorNode; gain: GainNode } | null = null;
  sfxOn = true;
  musicOn = true;

  private context(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Called on the first user gesture — browsers block autoplay otherwise. */
  unlock(): void {
    this.context();
    if (this.musicOn) this.startMusic();
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
  }

  private startMusic(): void {
    const ctx = this.context();
    if (!ctx || this.musicNodes.length) return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 3);
    gain.connect(this.master!);
    this.musicGain = gain;
    // A dark, slowly beating drone: two low sines + a quiet fifth.
    this.musicNodes = [55, 55.4, 82.5].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      return osc;
    });
  }

  private stopMusic(): void {
    if (!this.ctx || !this.musicNodes.length) return;
    const t = this.ctx.currentTime;
    this.musicGain?.gain.cancelScheduledValues(t);
    this.musicGain?.gain.setValueAtTime(this.musicGain?.gain.value ?? 0, t);
    this.musicGain?.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    const nodes = this.musicNodes;
    window.setTimeout(() => nodes.forEach((o) => o.stop()), 700);
    this.musicNodes = [];
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number, sweepTo?: number, delay = 0): void {
    const ctx = this.context();
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    const ctx = this.context();
    if (!ctx || !this.sfxOn) return;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(t);
  }

  footstep(): void {
    this.blip(85, 0.06, 'triangle', 0.05, 60);
  }

  switchClick(): void {
    this.blip(660, 0.05, 'square', 0.08, 330);
    this.noise(0.08, 0.1, 2400);
  }

  hum(): void {
    this.blip(120, 0.4, 'sawtooth', 0.03, 118);
  }

  glassUnlock(): void {
    this.blip(880, 0.14, 'sine', 0.09, 1320);
    this.noise(0.16, 0.06, 3600);
  }

  cardPickup(): void {
    this.noise(0.14, 0.09, 5000);
    this.blip(990, 0.1, 'sine', 0.05, 1180);
  }

  doorUnlock(): void {
    this.blip(440, 0.1, 'square', 0.06, 392);
    this.blip(560, 0.12, 'square', 0.06, 520, 0.12);
  }

  doorOpen(): void {
    this.noise(0.5, 0.12, 900);
    this.blip(180, 0.5, 'sine', 0.05, 240);
  }

  /** The signature: hum → pitch drop → distortion → silence. */
  loopReset(): void {
    this.blip(220, 0.55, 'sawtooth', 0.09, 38);
    this.noise(0.3, 0.08, 700, 0.25);
    this.blip(60, 0.2, 'square', 0.05, 30, 0.32);
  }

  ghostAppear(): void {
    this.blip(520, 0.8, 'sine', 0.035, 780);
    this.blip(524, 0.8, 'sine', 0.035, 776);
  }

  warning(strong: boolean): void {
    this.blip(strong ? 320 : 260, 0.16, 'triangle', 0.07, strong ? 240 : 220);
  }

  success(): void {
    const notes = [392, 494, 587, 784];
    notes.forEach((f, i) => this.blip(f, 0.5, 'sine', 0.08, f, i * 0.14));
  }

  denied(): void {
    this.blip(160, 0.1, 'square', 0.05, 140);
  }

  clue(): void {
    this.blip(740, 0.16, 'sine', 0.055, 920);
    this.blip(1110, 0.12, 'sine', 0.04, 1320, 0.07);
  }

  discovery(): void {
    this.blip(392, 0.18, 'sine', 0.05, 523);
    this.blip(659, 0.22, 'sine', 0.05, 784, 0.14);
  }

  finalRecording(): void {
    this.noise(0.25, 0.06, 1100);
    this.blip(110, 0.7, 'sine', 0.045, 70, 0.18);
  }
}
