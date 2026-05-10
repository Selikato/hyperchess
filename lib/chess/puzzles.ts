export type PuzzleBucketId = "elo-0-600" | "elo-600-1200" | "elo-1200-plus";

export type PuzzleSpec = {
  id: string;
  bucket: PuzzleBucketId;
  title: string;
  theme: string;
  fen: string;
  solution: string;
};

export const PUZZLE_BUCKETS: Array<{
  id: PuzzleBucketId;
  label: string;
  description: string;
}> = [
  {
    id: "elo-0-600",
    label: "0-600 ELO",
    description: "Tek hamlede taş kazanma ve açık taktikler.",
  },
  {
    id: "elo-600-1200",
    label: "600-1200 ELO",
    description: "Şah çekerek kazanma, çatallar ve uzun hatlar.",
  },
  {
    id: "elo-1200-plus",
    label: "1200+ ELO",
    description: "Daha az belirgin hedefler ve hesap isteyen hamleler.",
  },
];

type PiecePlacement = [square: string, piece: string];
type PuzzleMoveSpec = [
  from: string,
  whitePiece: string,
  target: string,
  blackPiece: string,
  solution: string,
];

function fenFromPieces(pieces: PiecePlacement[], turn: "w" | "b" = "w") {
  const board = Array.from({ length: 8 }, () => Array<string>(8).fill(""));
  for (const [square, piece] of pieces) {
    const file = square.charCodeAt(0) - "a".charCodeAt(0);
    const rank = 8 - Number(square[1]);
    board[rank][file] = piece;
  }

  const rows = board.map((row) => {
    let out = "";
    let empty = 0;
    for (const cell of row) {
      if (!cell) {
        empty += 1;
      } else {
        if (empty > 0) out += empty;
        empty = 0;
        out += cell;
      }
    }
    if (empty > 0) out += empty;
    return out;
  });

  return `${rows.join("/")} ${turn} - - 0 1`;
}

function buildPuzzleSet(
  bucket: PuzzleBucketId,
  prefix: string,
  theme: string,
  specs: PuzzleMoveSpec[]
): PuzzleSpec[] {
  return specs.map(([from, whitePiece, target, blackPiece, solution], index) => ({
    id: `${bucket}-${index + 1}`,
    bucket,
    title: `${prefix} ${index + 1}`,
    theme,
    fen: fenFromPieces([
      ["e1", "K"],
      ["e8", "k"],
      [from, whitePiece],
      [target, blackPiece],
    ]),
    solution,
  }));
}

const beginnerSpecs: PuzzleMoveSpec[] = [
  ["a1", "Q", "a8", "r", "a1a8"],
  ["h1", "Q", "h7", "r", "h1h7"],
  ["a4", "Q", "d7", "r", "a4d7"],
  ["h4", "Q", "e7", "n", "h4e7"],
  ["a1", "R", "a7", "q", "a1a7"],
  ["h1", "R", "h7", "q", "h1h7"],
  ["d1", "R", "d7", "q", "d1d7"],
  ["a4", "R", "d4", "q", "a4d4"],
  ["c1", "B", "h6", "r", "c1h6"],
  ["f1", "B", "a6", "r", "f1a6"],
  ["b2", "B", "g7", "n", "b2g7"],
  ["g2", "B", "b7", "n", "g2b7"],
  ["g1", "N", "f3", "q", "g1f3"],
  ["b1", "N", "c3", "q", "b1c3"],
  ["c4", "N", "d6", "q", "c4d6"],
  ["f4", "N", "h5", "q", "f4h5"],
  ["e2", "Q", "e7", "r", "e2e7"],
  ["b4", "Q", "b7", "r", "b4b7"],
  ["g4", "Q", "g7", "r", "g4g7"],
  ["c2", "R", "c7", "q", "c2c7"],
];

const intermediateSpecs: PuzzleMoveSpec[] = [
  ["c2", "Q", "c7", "r", "c2c7"],
  ["f2", "Q", "f7", "r", "f2f7"],
  ["b3", "Q", "b7", "r", "b3b7"],
  ["g3", "Q", "g7", "r", "g3g7"],
  ["a2", "Q", "e6", "n", "a2e6"],
  ["h2", "Q", "e5", "n", "h2e5"],
  ["b1", "R", "b7", "q", "b1b7"],
  ["g1", "R", "g7", "q", "g1g7"],
  ["e2", "R", "e7", "q", "e2e7"],
  ["d4", "R", "d7", "q", "d4d7"],
  ["e2", "B", "a6", "r", "e2a6"],
  ["d3", "B", "h7", "r", "d3h7"],
  ["h3", "B", "d7", "r", "h3d7"],
  ["a2", "B", "g8", "n", "a2g8"],
  ["e2", "N", "d4", "q", "e2d4"],
  ["d2", "N", "f3", "q", "d2f3"],
  ["c3", "N", "b5", "q", "c3b5"],
  ["f3", "N", "g5", "q", "f3g5"],
  ["b5", "N", "d6", "q", "b5d6"],
  ["g5", "N", "e6", "q", "g5e6"],
];

const advancedSpecs: PuzzleMoveSpec[] = [
  ["d1", "Q", "h5", "r", "d1h5"],
  ["e2", "Q", "h5", "r", "e2h5"],
  ["b1", "Q", "b8", "r", "b1b8"],
  ["g1", "Q", "g8", "r", "g1g8"],
  ["a3", "Q", "e7", "r", "a3e7"],
  ["h3", "Q", "d7", "r", "h3d7"],
  ["a2", "R", "a7", "q", "a2a7"],
  ["h2", "R", "h7", "q", "h2h7"],
  ["b4", "R", "e4", "q", "b4e4"],
  ["g4", "R", "e4", "q", "g4e4"],
  ["c4", "B", "f7", "q", "c4f7"],
  ["f4", "B", "c7", "q", "f4c7"],
  ["a3", "B", "e7", "q", "a3e7"],
  ["h3", "B", "d7", "q", "h3d7"],
  ["c2", "N", "d4", "r", "c2d4"],
  ["f2", "N", "e4", "r", "f2e4"],
  ["a4", "N", "b6", "q", "a4b6"],
  ["h4", "N", "g6", "q", "h4g6"],
  ["d5", "N", "f6", "q", "d5f6"],
  ["e5", "N", "c6", "q", "e5c6"],
];

export const PUZZLES: PuzzleSpec[] = [
  ...buildPuzzleSet("elo-0-600", "Başlangıç bulmacası", "Taşı kazan", beginnerSpecs),
  ...buildPuzzleSet("elo-600-1200", "Orta seviye bulmaca", "Taktik vuruş", intermediateSpecs),
  ...buildPuzzleSet("elo-1200-plus", "İleri seviye bulmaca", "Hesapla ve kazan", advancedSpecs),
];

export function getPuzzlesForBucket(bucket: PuzzleBucketId) {
  return PUZZLES.filter((puzzle) => puzzle.bucket === bucket);
}
