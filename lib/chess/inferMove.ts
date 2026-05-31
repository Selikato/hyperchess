import { Chess } from "chess.js";

/** İki FEN arasındaki tek hamleyi bulur (tahta parçası aynıysa). */
export function inferUciBetweenFens(fenBefore: string, fenAfter: string): string | null {
  try {
    const g = new Chess(fenBefore);
    const targetBoard = fenAfter.split(" ")[0] ?? "";
    for (const mv of g.moves({ verbose: true })) {
      const t = new Chess(fenBefore);
      t.move(mv);
      if ((t.fen().split(" ")[0] ?? "") === targetBoard) {
        return `${mv.from}${mv.to}${mv.promotion ?? ""}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
