/** Yeni profiller ve maç tabanı için varsayılan Elo */
export const DEFAULT_ELO = 700;

/** Bot maçı sonrası hedef üst sınır (bunun üstünde +WIN_DELTA) */
export const WIN_CAP = 800;
export const WIN_DELTA = 20;

/** Bot maçı sonrası hedef alt sınır (bunun altında -LOSS_DELTA) */
export const LOSS_FLOOR = 600;
export const LOSS_DELTA = 20;

export type BotMatchOutcome = "win" | "loss" | "draw";

/**
 * Bot (Stockfish) maçı sonrası yeni Elo.
 * - Kazanç: ≤800 → 800; >800 → +20
 * - Yenilgi: ≥600 → 600; <600 → -20
 * - Beraberlik: değişmez
 */
export function computeEloAfterBotMatch(
  current: number,
  outcome: BotMatchOutcome
): number {
  if (outcome === "draw") return current;
  if (outcome === "win") {
    return current > WIN_CAP ? current + WIN_DELTA : WIN_CAP;
  }
  return current < LOSS_FLOOR ? current - LOSS_DELTA : LOSS_FLOOR;
}

/** Ekranda sayıyı yumuşak geçişle güncelle */
export function animateEloNumber(
  from: number,
  to: number,
  durationMs: number,
  onFrame: (value: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      onFrame(from + (to - from) * eased);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        onFrame(to);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}
