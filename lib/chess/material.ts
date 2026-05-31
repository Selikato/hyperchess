export type MaterialPiece = "p" | "n" | "b" | "r" | "q";

export const PIECE_VALUES: Record<MaterialPiece, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const PIECE_LABELS_TR: Record<MaterialPiece, string> = {
  p: "piyon",
  n: "at",
  b: "fil",
  r: "kale",
  q: "vezir",
};

/** FEN / SAN harfi (K,Q,R,B,N,P veya küçük harf) */
export function pieceValue(piece: string): number {
  const key = piece.toLowerCase() as MaterialPiece;
  return PIECE_VALUES[key] ?? 0;
}

export function pieceLabelTr(piece: string): string {
  const key = piece.toLowerCase() as MaterialPiece;
  return PIECE_LABELS_TR[key] ?? "taş";
}

/** Yakalanan taş değeri eksi kaybedilen saldıran taş (geri alınırsa). */
export function netMaterialGain(
  captured: string,
  attacker: string,
  recaptured = false
): number {
  const gain = pieceValue(captured);
  return recaptured ? gain - pieceValue(attacker) : gain;
}

export function formatMaterialGain(gain: number): string {
  if (gain > 0) return `+${gain}`;
  if (gain < 0) return `${gain}`;
  return "0";
}

/** FEN tahtasından bir rengin toplam materyali (şah hariç). */
export function sideMaterialFromFen(fen: string, color: "w" | "b"): number {
  const board = fen.split(" ")[0] ?? "";
  let sum = 0;
  for (const ch of board) {
    if (!/[pnbrqkPNBRQK]/.test(ch)) continue;
    const lower = ch.toLowerCase();
    const isWhite = ch !== lower;
    if ((color === "w" && isWhite) || (color === "b" && !isWhite)) {
      sum += pieceValue(lower);
    }
  }
  return sum;
}

/** Hamle sonrası oynayan tarafın kaybettiği materyal puanı (≥0). */
export function materialLostByMover(
  fenBefore: string,
  fenAfter: string,
  mover: "w" | "b"
): number {
  const before = sideMaterialFromFen(fenBefore, mover);
  const after = sideMaterialFromFen(fenAfter, mover);
  return Math.max(0, before - after);
}

/** Hamle sonrası oynayan tarafın kazandığı materyal puanı (≥0). */
export function materialGainedByMover(
  fenBefore: string,
  fenAfter: string,
  mover: "w" | "b"
): number {
  const before = sideMaterialFromFen(fenBefore, mover);
  const after = sideMaterialFromFen(fenAfter, mover);
  return Math.max(0, after - before);
}

/** 1 materyal puanı ≈ 100 centipawn (piyon değeri). */
export function materialPointsToCp(points: number): number {
  return Math.round(points * 100);
}

/** Motor kaybı ile materyal kaybını birleştirir. */
export function effectiveCentipawnLoss(engineLossCp: number, materialLostPoints: number): number {
  const materialCp = materialPointsToCp(materialLostPoints);
  return Math.max(engineLossCp, materialCp);
}
