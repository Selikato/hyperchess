import type { Chess, Square } from "chess.js";

export type PromotionPiece = "q" | "r" | "b" | "n";

export type PendingPromotion = {
  from: string;
  to: string;
};

const PROMOTION_ORDER: PromotionPiece[] = ["q", "r", "b", "n"];

export function getPromotionChoices(
  game: Chess,
  from: string,
  to: string
): PromotionPiece[] {
  try {
    const legalPromotions = new Set(
      game
        .moves({ square: from as Square, verbose: true })
        .filter((move) => move.to === to && move.promotion)
        .map((move) => move.promotion as PromotionPiece)
    );

    return PROMOTION_ORDER.filter((piece) => legalPromotions.has(piece));
  } catch {
    return [];
  }
}
