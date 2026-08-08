const CHIME_URL = '/pomodoro-chime.wav';

export const audioService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  },

  playChime(): void {
    if (typeof window === 'undefined') return;
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(CHIME_URL);
        audio.volume = 0.6;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => this.playToneChime());
        }
        return;
      } catch {
        // fallthrough to tone chime
      }
    }
    this.playToneChime();
  },

  playToneChime(): void {
    if (!this.isSupported()) return;

    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextCtor();

      const playTone = (frequency: number, delay: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(ctx.currentTime + delay);
        oscillator.stop(ctx.currentTime + delay + duration + 0.05);
      };

      playTone(880, 0, 0.25);
      playTone(1174.66, 0.28, 0.4);

      window.setTimeout(() => ctx.close().catch(() => undefined), 1200);
    } catch {
      // ignore audio failures
    }
  },
};
