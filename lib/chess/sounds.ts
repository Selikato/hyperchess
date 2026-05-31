/** Kısa tahta / taş sesi (Web Audio — harici dosya gerekmez). */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** İlk kullanıcı etkileşiminde ses bağlamını hazırlar (tarayıcı autoplay kısıtı). */
export function primeChessAudio(): void {
  getAudioContext();
}

/** Hamle sesi — `capture` alışverişlerinde biraz daha tok. */
export function playMoveSound(capture = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(capture ? 720 : 1100, t);
  filter.Q.value = 0.6;

  osc.type = "triangle";
  osc.frequency.setValueAtTime(capture ? 160 : 210, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);

  const peak = capture ? 0.42 : 0.32;
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + 0.12);

  // Hafif “tık” katmanı
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(capture ? 90 : 120, t);
  clickGain.gain.setValueAtTime(capture ? 0.06 : 0.04, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(t);
  click.stop(t + 0.03);
}

export function playMoveSoundForMove(move: { captured?: string | null } | null): void {
  playMoveSound(Boolean(move?.captured));
}
