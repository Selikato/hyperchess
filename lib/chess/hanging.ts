import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import { pieceValue } from "@/lib/chess/material";

/** Tahtayı değiştirmeden sırayı ayarlar (saldırı sayımı için). */
export function fenWithTurn(fen: string, turn: "w" | "b"): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(" ");
}

function movesToSquare(fen: string, color: "w" | "b", square: string): Move[] {
  try {
    const g = new Chess(fenWithTurn(fen, color));
    return g.moves({ verbose: true }).filter((m) => m.to === square);
  } catch {
    return [];
  }
}

export type TacticalThreat = {
  square: string;
  pieceType: string;
  value: number;
  /** Rakibin en iyi yakalama dizisindeki net materyal kazancı (puan). */
  enemyNetGain: number;
  defended: boolean;
};

/**
 * Rakip bu kareyi alırsa en iyi geri alma sonrası net kazanç (puan).
 * ≤0 ise taş pratikte korumalı / alışveriş kazançsız.
 */
export function enemyNetGainIfCapture(
  fen: string,
  square: string,
  owner: "w" | "b"
): number | null {
  const enemy: "w" | "b" = owner === "w" ? "b" : "w";
  const g0 = new Chess(fen);
  const target = g0.get(square as Square);
  if (!target || target.color !== owner || target.type === "k") return null;

  const captures = movesToSquare(fen, enemy, square).filter((m) => m.captured);
  if (captures.length === 0) return 0;

  let bestGain = 0;
  for (const cap of captures) {
    const afterCap = new Chess(fenWithTurn(fen, enemy));
    const played = afterCap.move(cap);
    if (!played?.captured) continue;

    const capturedVal = pieceValue(played.captured);
    const attackerVal = pieceValue(played.piece);

    const recaps = movesToSquare(afterCap.fen(), owner, square);
    if (recaps.length === 0) {
      bestGain = Math.max(bestGain, capturedVal);
      continue;
    }

    let worstForEnemy = Infinity;
    for (const recap of recaps) {
      const recapVal = pieceValue(recap.piece);
      // Rakip: hedefi aldı, saldıran taş geri alındı.
      const enemyGain = capturedVal - attackerVal - recapVal;
      worstForEnemy = Math.min(worstForEnemy, enemyGain);
    }
    bestGain = Math.max(bestGain, worstForEnemy);
  }

  return bestGain;
}

export function findWorstTacticalThreat(
  fen: string,
  owner: "w" | "b",
  minEnemyGain = 1
): TacticalThreat | null {
  const g = new Chess(fen);
  let worst: TacticalThreat | null = null;
  const board = g.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (!piece || piece.color !== owner || piece.type === "k") continue;
      const sq = `${"abcdefgh"[c]}${8 - r}`;
      const gain = enemyNetGainIfCapture(fen, sq, owner);
      if (gain == null || gain < minEnemyGain) continue;

      const defenders = movesToSquare(fen, owner, sq).length;
      const threat: TacticalThreat = {
        square: sq,
        pieceType: piece.type,
        value: pieceValue(piece.type),
        enemyNetGain: gain,
        defended: defenders > 0,
      };
      if (!worst || gain > worst.enemyNetGain || (gain === worst.enemyNetGain && threat.value > worst.value)) {
        worst = threat;
      }
    }
  }
  return worst;
}

export function isTacticallyHanging(fen: string, owner: "w" | "b", minEnemyGain = 1): boolean {
  return findWorstTacticalThreat(fen, owner, minEnemyGain) != null;
}
