class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.08,
    freqEnd?: number,
    delay: number = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        now + duration
      );
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect() {
    this.playTone(520, 0.08, 'triangle', 0.05, 640);
  }

  public playDeploy() {
    this.playTone(260, 0.11, 'triangle', 0.08, 390);
  }

  public playBattle() {
    this.playTone(170, 0.14, 'sawtooth', 0.07, 75);
    this.playTone(120, 0.12, 'square', 0.04, 60, 0.05);
  }

  public playCapture() {
    this.playTone(440, 0.12, 'triangle', 0.08, 554);
    this.playTone(659, 0.18, 'triangle', 0.09, 880, 0.09);
  }

  public playOrder() {
    this.playTone(330, 0.12, 'sine', 0.07, 520);
    this.playTone(587, 0.16, 'triangle', 0.07, 740, 0.08);
  }

  public playTurnEnd() {
    this.playTone(392, 0.14, 'sine', 0.06, 330);
  }

  public playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.24, 'triangle', 0.09, undefined, idx * 0.11);
    });
  }

  public playDefeat() {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.28, 'sine', 0.08, undefined, idx * 0.14);
    });
  }
}

export const soundEngine = new SoundEngine();
