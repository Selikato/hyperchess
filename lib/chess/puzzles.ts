import { Chess } from "chess.js";
import type { Square } from "chess.js";
import {
  formatMaterialGain,
  netMaterialGain,
  pieceLabelTr,
  pieceValue,
} from "@/lib/chess/material";

export type PuzzleBucketId = "elo-0-600" | "elo-600-1200" | "elo-1200-plus";

export type PuzzleTrap = {
  uci: string;
  message: string;
};

export type PuzzleSpec = {
  id: string;
  bucket: PuzzleBucketId;
  title: string;
  theme: string;
  /** Oyuncuya gösterilen kısa görev */
  prompt: string;
  fen: string;
  /** İlk beyaz hamlesi (tek hamleli bulmacalarda çözümün tamamı) */
  solution: string;
  /** Beyaz + siyah yanıt dizisi; en fazla 5 yarım hamle, beyazla biter */
  solutionLine?: string[];
  /** Çözüm sonrası kazanılan net materyal (geri alma yoksa) */
  materialGain: number;
  /** Yanlış ama cazip hamleler */
  traps?: PuzzleTrap[];
};

export const PUZZLE_BUCKETS: Array<{
  id: PuzzleBucketId;
  label: string;
  description: string;
}> = [
  {
    id: "elo-0-600",
    label: "0-600 ELO",
    description: "Korumasız taşları al; bazı bulmacalar 2–3 hamlelik seridir.",
  },
  {
    id: "elo-600-1200",
    label: "600-1200 ELO",
    description: "Kazançlı alışveriş; siyah yanıtları otomatik oynanır.",
  },
  {
    id: "elo-1200-plus",
    label: "1200+ ELO",
    description: "Materyal hesabı ve 5 hamleye kadar kombinasyonlar.",
  },
];

type PiecePlacement = [square: string, piece: string];

type PuzzleDefinition = {
  theme: string;
  prompt: string;
  pieces: PiecePlacement[];
  solution: string;
  /** 2–5 yarım hamle; beyaz hamleleri 0, 2, 4… indekslerde */
  solutionLine?: string[];
  traps?: PuzzleTrap[];
};

const MAX_SOLUTION_PLIES = 5;

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

function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
  };
}

function trapMessage(
  attacker: string,
  captured: string,
  recaptured: boolean,
  extra?: string
): string {
  const gain = netMaterialGain(captured, attacker, recaptured);
  const base = recaptured
    ? `${pieceLabelTr(attacker)} ile ${pieceLabelTr(captured)} alırsın ama taş geri alınır: ${formatMaterialGain(gain)} materyal.`
    : `Bu alışveriş ${formatMaterialGain(gain)} materyal verir.`;
  return extra ? `${extra} ${base}` : base;
}

/** Siyah geri alır: hamle sonrası hedef kareye giden en ucuz geri alma */
function hasRecapture(fen: string, solutionUci: string): boolean {
  const moved = trySolutionMove(fen, solutionUci);
  if (!moved) return false;
  const game = new Chess(fen);
  try {
    game.move(uciToMove(solutionUci));
  } catch {
    return false;
  }
  const target = solutionUci.slice(2, 4) as Square;
  const replies = game.moves({ verbose: true }).filter((m) => m.to === target && m.captured);
  return replies.length > 0;
}

function materialGainForSolution(fen: string, solutionUci: string): number {
  const moved = trySolutionMove(fen, solutionUci);
  if (!moved?.captured) return 0;
  const recaptured = hasRecapture(fen, solutionUci);
  return netMaterialGain(moved.captured, moved.piece, recaptured);
}

function sideMaterial(fen: string, color: "w" | "b"): number {
  const game = new Chess(fen);
  let total = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.color === color && cell.type !== "k") {
        total += pieceValue(cell.type);
      }
    }
  }
  return total;
}

function materialGainForLine(fen: string, line: string[]): number {
  const game = new Chess(fen);
  const whiteBefore = sideMaterial(fen, "w");
  const blackBefore = sideMaterial(fen, "b");
  for (const uci of line) {
    try {
      game.move(uciToMove(uci));
    } catch {
      return 0;
    }
  }
  const whiteAfter = sideMaterial(game.fen(), "w");
  const blackAfter = sideMaterial(game.fen(), "b");
  return whiteAfter - whiteBefore - (blackAfter - blackBefore);
}

function normalizeSolutionLine(def: PuzzleDefinition): string[] {
  const line = def.solutionLine ?? [def.solution];
  if (line[0] !== def.solution) {
    throw new Error(`solution (${def.solution}) solutionLine[0] (${line[0]}) ile eşleşmeli`);
  }
  return line;
}

function trySolutionMove(fen: string, uci: string) {
  const game = new Chess(fen);
  try {
    return game.move(uciToMove(uci));
  } catch {
    return null;
  }
}

function assertPuzzle(def: PuzzleDefinition, bucket: PuzzleBucketId, index: number) {
  const fen = fenFromPieces(def.pieces);
  const line = normalizeSolutionLine(def);

  if (line.length > MAX_SOLUTION_PLIES) {
    throw new Error(
      `[${bucket} #${index + 1}] Çözüm en fazla ${MAX_SOLUTION_PLIES} yarım hamle olabilir`
    );
  }

  if (line.length > 1) {
    if (line.length % 2 === 0) {
      throw new Error(`[${bucket} #${index + 1}] Çok hamleli çözüm beyazla bitmeli`);
    }
    const game = new Chess(fen);
    for (const uci of line) {
      const moved = trySolutionMove(game.fen(), uci);
      if (!moved) {
        throw new Error(`[${bucket} #${index + 1}] Geçersiz hamle: ${uci}`);
      }
      game.move(uciToMove(uci));
    }
    const gain = materialGainForLine(fen, line);
    if (gain <= 0) {
      throw new Error(
        `[${bucket} #${index + 1}] Seri materyal kazandırmalı (şu an ${gain}): ${line.join(" ")}`
      );
    }
    return;
  }

  const moved = trySolutionMove(fen, def.solution);
  if (!moved) {
    throw new Error(`[${bucket} #${index + 1}] Geçersiz çözüm: ${def.solution}`);
  }
  if (!moved.captured) {
    throw new Error(`[${bucket} #${index + 1}] Çözüm alma hamlesi olmalı: ${def.solution}`);
  }
  const gain = materialGainForSolution(fen, def.solution);
  if (gain <= 0) {
    throw new Error(
      `[${bucket} #${index + 1}] Çözüm materyal kazandırmalı (şu an ${gain}): ${def.solution}`
    );
  }
}

/** Geçersiz veya çözümden iyi tuzakları atar — modül yüklenirken çökme olmaz. */
function sanitizeTraps(
  fen: string,
  traps: PuzzleTrap[] | undefined,
  solutionGain: number
): PuzzleTrap[] | undefined {
  if (!traps?.length) return undefined;
  const kept = traps.filter((trap) => {
    const trapMove = trySolutionMove(fen, trap.uci);
    if (!trapMove?.captured) return false;
    const trapGain = materialGainForSolution(fen, trap.uci);
    return trapGain < solutionGain;
  });
  return kept.length > 0 ? kept : undefined;
}

function buildPuzzleSet(
  bucket: PuzzleBucketId,
  prefix: string,
  defs: PuzzleDefinition[]
): PuzzleSpec[] {
  return defs.map((def, index) => {
    const fen = fenFromPieces(def.pieces);
    const solutionLine = normalizeSolutionLine(def);
    assertPuzzle(def, bucket, index);
    const materialGain =
      solutionLine.length > 1
        ? materialGainForLine(fen, solutionLine)
        : materialGainForSolution(fen, def.solution);
    const traps = sanitizeTraps(fen, def.traps, materialGain);
    return {
      id: `${bucket}-${index + 1}`,
      bucket,
      title: `${prefix} ${index + 1}`,
      theme: def.theme,
      prompt: def.prompt,
      fen,
      solution: def.solution,
      solutionLine: solutionLine.length > 1 ? solutionLine : undefined,
      materialGain,
      traps,
    };
  });
}

export function getSolutionLine(puzzle: PuzzleSpec): string[] {
  return puzzle.solutionLine ?? [puzzle.solution];
}

export function isMultiMovePuzzle(puzzle: PuzzleSpec): boolean {
  return getSolutionLine(puzzle).length > 1;
}

export function countWhiteMovesInLine(line: string[]): number {
  return line.filter((_, index) => index % 2 === 0).length;
}

const beginnerDefs: PuzzleDefinition[] = [
  {
    theme: "Korumasız taş",
    prompt: "Siyahın korumasız vezirini al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d1", "R"],
      ["d8", "q"],
    ],
    solution: "d1d8",
  },
  {
    theme: "Korumasız taş",
    prompt: "Siyahın korumasız kalenin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["a1", "Q"],
      ["a8", "r"],
    ],
    solution: "a1a8",
  },
  {
    theme: "Korumasız taş",
    prompt: "Fil ile korumasız kalenin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c2", "B"],
      ["h7", "r"],
    ],
    solution: "c2h7",
  },
  {
    theme: "Korumasız taş",
    prompt: "At ile korumasız vezirin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["f3", "N"],
      ["g5", "q"],
    ],
    solution: "f3g5",
  },
  {
    theme: "Değerli hedef",
    prompt: "Piyonla korumasız kalenin al (+4).",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e4", "P"],
      ["d5", "r"],
    ],
    solution: "e4d5",
  },
  {
    theme: "Korumasız taş",
    prompt: "Kale ile korumasız filin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["a1", "R"],
      ["a7", "b"],
    ],
    solution: "a1a7",
  },
  {
    theme: "Korumasız taş",
    prompt: "Vezir ile korumasız atın al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d1", "Q"],
      ["d6", "n"],
    ],
    solution: "d1d6",
  },
  {
    theme: "Değerli hedef",
    prompt: "Fil ile korumasız vezirin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["g5", "B"],
      ["c1", "q"],
    ],
    solution: "g5c1",
  },
  {
    theme: "Korumasız taş",
    prompt: "Kale ile korumasız piyonu al (küçük kazanç).",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["h1", "R"],
      ["h7", "p"],
    ],
    solution: "h1h7",
  },
  {
    theme: "Korumasız taş",
    prompt: "At ile korumasız filin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c4", "N"],
      ["e5", "b"],
    ],
    solution: "c4e5",
  },
  {
    theme: "Değerli hedef",
    prompt: "Kale ile korumasız vezirin al (+4).",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e3", "R"],
      ["e7", "q"],
    ],
    solution: "e3e7",
  },
  {
    theme: "Korumasız taş",
    prompt: "Vezir ile korumasız kalenin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["b3", "Q"],
      ["b8", "r"],
    ],
    solution: "b3b8",
  },
  {
    theme: "Korumasız taş",
    prompt: "Fil ile korumasız atın al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["f1", "B"],
      ["c4", "n"],
    ],
    solution: "f1c4",
  },
  {
    theme: "Değerli hedef",
    prompt: "Piyonla korumasız filin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d4", "P"],
      ["c5", "b"],
    ],
    solution: "d4c5",
  },
  {
    theme: "Korumasız taş",
    prompt: "At ile korumasız kalenin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e2", "N"],
      ["c3", "r"],
    ],
    solution: "e2c3",
  },
  {
    theme: "Değerli hedef",
    prompt: "Kale ile korumasız filin al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["g1", "R"],
      ["g7", "b"],
    ],
    solution: "g1g7",
  },
  {
    theme: "Korumasız taş",
    prompt: "Vezir ile korumasız piyonu al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["h3", "Q"],
      ["h6", "p"],
    ],
    solution: "h3h6",
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): vezir al, şah kaçınca kaleyi al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d1", "Q"],
      ["d8", "q"],
      ["a1", "R"],
      ["f8", "r"],
    ],
    solution: "d1d8",
    solutionLine: ["d1d8", "e8f7", "d8f8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): arka sıra zayıflığından vezir kazan.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["d1", "Q"],
      ["d8", "r"],
      ["h1", "R"],
      ["h8", "q"],
    ],
    solution: "d1d8",
    solutionLine: ["d1d8", "g8g7", "d8h8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): kale değişimi, sonra vezir al.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["e4", "Q"],
      ["a8", "q"],
      ["a4", "R"],
      ["f8", "r"],
    ],
    solution: "a4a8",
    solutionLine: ["a4a8", "f8a8", "e4a8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): vezir al, şah çekilince kaleyi al.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["f8", "r"],
      ["a1", "R"],
    ],
    solution: "h3h8",
    solutionLine: ["h3h8", "c8d8", "h8f8"],
  },
];

const intermediateDefs: PuzzleDefinition[] = [
  {
    theme: "Tuzağa dikkat",
    prompt: "Kazançlı hamleyi bul: korumasız vezir var.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["d1", "R"],
      ["d8", "q"],
      ["a4", "Q"],
      ["a8", "r"],
      ["h8", "r"],
    ],
    solution: "d1d8",
    traps: [
      {
        uci: "a4a8",
        message: trapMessage("q", "r", true, "Vezir önce ucuza kale alırsa siyah h8 kale geri alır."),
      },
    ],
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "En değerli güvenli almayı seç.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e2", "R"],
      ["e7", "q"],
      ["f3", "B"],
      ["b7", "r"],
      ["b8", "r"],
    ],
    solution: "e2e7",
    traps: [
      {
        uci: "f3b7",
        message: trapMessage("b", "r", true, "Fil kale alır ama b8 kale geri alır."),
      },
    ],
  },
  {
    theme: "Kazançlı değişim",
    prompt: "Kale vezire saldırıyor; geri alma olsa bile kazançlı.",
    pieces: [
      ["h1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["f8", "r"],
    ],
    solution: "h3h8",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "At hamlesi materyal kazandırır — vezir serbest.",
    pieces: [
      ["g1", "K"],
      ["e8", "k"],
      ["c3", "N"],
      ["d5", "q"],
    ],
    solution: "c3d5",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "İki alma var; geri alınmayanı seç.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["b5", "N"],
      ["c7", "q"],
      ["b2", "Q"],
      ["b7", "p"],
      ["a8", "r"],
    ],
    solution: "b5c7",
  },
  {
    theme: "Kazançlı değişim",
    prompt: "Kale vezir alır; geri alma sonrası bile +4.",
    pieces: [
      ["h1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
    ],
    solution: "h3h8",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "Fil hamlesi en yüksek net kazancı verir.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c4", "B"],
      ["f7", "q"],
      ["e5", "B"],
      ["g7", "r"],
      ["g8", "r"],
    ],
    solution: "c4f7",
    traps: [
      {
        uci: "e5g7",
        message: trapMessage("b", "r", true, "Fil kale alır; g8 kale geri alır."),
      },
    ],
  },
  {
    theme: "Değer sırası",
    prompt: "Korumasız vezir, korumasız kaleye tercih edilir.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["h5", "Q"],
      ["h8", "q"],
      ["a5", "r"],
    ],
    solution: "h5h8",
    traps: [
      {
        uci: "h5a5",
        message: "Kale de serbest ama vezir 9 puan, kale 5 puan.",
      },
    ],
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "Piyon hamlesi güvenli kazanç sağlar.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d4", "P"],
      ["e5", "r"],
      ["d1", "Q"],
      ["d8", "b"],
      ["c8", "r"],
    ],
    solution: "d4e5",
  },
  {
    theme: "Kazançlı değişim",
    prompt: "At vezir alır; geri alınsa bile kârlı.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["g5", "N"],
      ["f7", "q"],
      ["f6", "p"],
    ],
    solution: "g5f7",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "Kale hamlesi doğru; vezir cazip ama kaybettirir.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["e4", "R"],
      ["e8", "q"],
    ],
    solution: "e4e8",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "En yüksek güvenli kazancı bul.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["a4", "R"],
      ["a8", "q"],
      ["h4", "Q"],
      ["h7", "r"],
      ["h8", "r"],
    ],
    solution: "a4a8",
    traps: [
      {
        uci: "h4h7",
        message: trapMessage("q", "r", true, "Vezir kale alır; h8 kale geri alır."),
      },
    ],
  },
  {
    theme: "Kazançlı değişim",
    prompt: "Fil vezir alır (+6 net, geri alma olsa bile).",
    pieces: [
      ["e1", "K"],
      ["g8", "k"],
      ["c5", "B"],
      ["f8", "q"],
      ["f7", "p"],
    ],
    solution: "c5f8",
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "At hamlesi kazandırır; piyon tuzağı değil.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["f3", "N"],
      ["g5", "q"],
      ["e4", "P"],
      ["f5", "p"],
      ["g6", "r"],
    ],
    solution: "f3g5",
    traps: [
      {
        uci: "e4f5",
        message: trapMessage("p", "p", true, "Piyon alır; g6 kale vezir geri alır."),
      },
    ],
  },
  {
    theme: "Değer sırası",
    prompt: "İki serbest taş — önce daha değerli olanı al.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c1", "R"],
      ["c8", "q"],
      ["h1", "R"],
      ["h8", "r"],
    ],
    solution: "c1c8",
    traps: [
      {
        uci: "h1h8",
        message: "Kale de serbest; vezir daha değerli.",
      },
    ],
  },
  {
    theme: "Tuzağa dikkat",
    prompt: "Güvenli kazançlı hamleyi seç.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d3", "B"],
      ["h7", "q"],
      ["e5", "B"],
      ["g7", "r"],
      ["h8", "r"],
    ],
    solution: "d3h7",
    traps: [
      {
        uci: "e5g7",
        message: trapMessage("b", "r", true),
      },
    ],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): vezir değişimi, sonra şah çek.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["f8", "r"],
      ["a1", "R"],
    ],
    solution: "h3h8",
    solutionLine: ["h3h8", "f8h8", "a1a8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): koruyucu kaleyi çıkar, vezir al.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["d1", "Q"],
      ["d8", "r"],
      ["h5", "q"],
      ["h8", "R"],
    ],
    solution: "h8h5",
    solutionLine: ["h8h5", "g8f8", "d1d8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): vezir al, şah kaçınca kale mat tehdidi.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["d1", "Q"],
      ["d8", "r"],
      ["h1", "R"],
      ["h8", "q"],
    ],
    solution: "d1d8",
    solutionLine: ["d1d8", "g8g7", "d8h8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): kale değişimi sonrası vezir kazan.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["f8", "r"],
      ["a1", "R"],
    ],
    solution: "h3h8",
    solutionLine: ["h3h8", "c8d8", "h8f8"],
  },
];

const advancedDefs: PuzzleDefinition[] = [
  {
    theme: "Materyal hesabı",
    prompt: "İki cazip alma — geri almadan sonra en yüksek net kazanç.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d1", "R"],
      ["d8", "q"],
      ["c3", "Q"],
      ["c7", "r"],
      ["c8", "r"],
      ["h7", "r"],
    ],
    solution: "d1d8",
    traps: [
      { uci: "c3c7", message: trapMessage("q", "r", true, "Vezir kale alır; c8 geri alır.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Vezir mi, fil mi? Geri almayı say.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d2", "Q"],
      ["d7", "r"],
      ["g5", "B"],
      ["f6", "q"],
      ["f7", "r"],
      ["f8", "r"],
    ],
    solution: "g5f6",
    traps: [
      { uci: "d2d7", message: trapMessage("q", "r", true, "Vezir kale alır; f8 geri alır.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Üç hedef görünüyor; en yüksek net kazançlı olanı seç.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["a4", "R"],
      ["a8", "q"],
      ["h4", "Q"],
      ["h7", "r"],
      ["h8", "r"],
    ],
    solution: "a4a8",
    traps: [
      { uci: "h4h7", message: trapMessage("q", "r", true, "Önce kale cazip; vezir daha değerli.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "At hamlesi +6 net; fil tuzağı.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e4", "N"],
      ["f6", "q"],
      ["c4", "B"],
      ["d5", "r"],
      ["d6", "r"],
    ],
    solution: "e4f6",
    traps: [
      { uci: "c4d5", message: trapMessage("b", "r", true) },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Kale hamlesi kazançlı değişim; vezir kaybettirir.",
    pieces: [
      ["h1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["a4", "Q"],
      ["a8", "r"],
      ["f8", "r"],
    ],
    solution: "h3h8",
    traps: [
      { uci: "a4a8", message: trapMessage("q", "r", true, "Vezir önce kale alır; f8 kale geri alır.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Piyon güvenli +4; vezir ve at tuzak.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d4", "P"],
      ["e5", "r"],
      ["d1", "Q"],
      ["d8", "b"],
      ["c8", "r"],
      ["f3", "N"],
      ["f5", "p"],
    ],
    solution: "d4e5",
  },
  {
    theme: "Materyal hesabı",
    prompt: "İki vezir hedefi yok; kale vezir alır.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["b1", "R"],
      ["b8", "q"],
      ["g2", "Q"],
      ["g7", "r"],
      ["g8", "r"],
    ],
    solution: "b1b8",
    traps: [
      { uci: "g2g7", message: trapMessage("q", "r", true) },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Fil +6 net; kale alışverişi daha düşük.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c5", "B"],
      ["f8", "q"],
      ["a1", "R"],
      ["a8", "r"],
      ["a7", "r"],
    ],
    solution: "c5f8",
    traps: [
      { uci: "a1a7", message: trapMessage("r", "r", true, "Kale kale alır; a7 geri alır — vezire göre daha zayıf.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "At vezir alır; fil tuzağı.",
    pieces: [
      ["g1", "K"],
      ["e8", "k"],
      ["g5", "N"],
      ["f7", "q"],
      ["c4", "B"],
      ["d5", "r"],
    ],
    solution: "g5f7",
    traps: [
      { uci: "c4d5", message: trapMessage("b", "r", true) },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Kale c7 vezire gider; a7 kale tuzağı.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["c1", "R"],
      ["c7", "q"],
      ["d1", "Q"],
      ["a7", "r"],
      ["a8", "r"],
    ],
    solution: "c1c7",
  },
  {
    theme: "Materyal hesabı",
    prompt: "En yüksek net: vezir (+9), geri alma yok.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["e4", "R"],
      ["e7", "q"],
      ["h4", "Q"],
      ["h7", "r"],
    ],
    solution: "e4e7",
    traps: [
      { uci: "h4h7", message: trapMessage("q", "r", true, "Kale serbest ama vezir daha değerli ve güvenli.") },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Büyük kazanç: fil vezir; at piyon tuzağı.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["b3", "B"],
      ["e6", "q"],
      ["f3", "N"],
      ["g5", "p"],
      ["g6", "r"],
    ],
    solution: "b3e6",
  },
  {
    theme: "Materyal hesabı",
    prompt: "Kale d8 vezir; c8 geri alır — yine +4 net.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["d1", "R"],
      ["d8", "q"],
      ["c8", "r"],
      ["h5", "Q"],
      ["h8", "r"],
      ["h7", "r"],
    ],
    solution: "d1d8",
    traps: [
      { uci: "h5h7", message: trapMessage("q", "r", true) },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "Vezir b7 piyon tuzağı; a8 kale vezir güvenli değil.",
    pieces: [
      ["e1", "K"],
      ["e8", "k"],
      ["a4", "R"],
      ["a8", "q"],
      ["d2", "Q"],
      ["b7", "p"],
      ["b8", "r"],
    ],
    solution: "a4a8",
  },
  {
    theme: "Materyal hesabı",
    prompt: "At f6 vezir (+6); fil e5 kale tuzak.",
    pieces: [
      ["g1", "K"],
      ["e8", "k"],
      ["g5", "N"],
      ["f7", "q"],
      ["c4", "B"],
      ["d5", "r"],
    ],
    solution: "g5f7",
    traps: [
      { uci: "c4d5", message: trapMessage("b", "r", true) },
    ],
  },
  {
    theme: "Materyal hesabı",
    prompt: "İki kale hedefi: geri almayı say.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["a4", "R"],
      ["a8", "q"],
      ["h4", "R"],
      ["h7", "r"],
      ["h8", "r"],
    ],
    solution: "a4a8",
    traps: [
      { uci: "h4h7", message: trapMessage("r", "r", true) },
    ],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): koruyucu kaleyi çıkar, vezir al.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["d1", "Q"],
      ["d8", "r"],
      ["h5", "q"],
      ["h8", "R"],
    ],
    solution: "h8h5",
    solutionLine: ["h8h5", "g8f8", "d1d8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): kale değişimi, sonra vezir al.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["e4", "Q"],
      ["a8", "q"],
      ["a4", "R"],
      ["f8", "r"],
    ],
    solution: "a4a8",
    solutionLine: ["a4a8", "f8a8", "e4a8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (3 hamle): arka sıra kombinasyonu — 5 yarım hamle.",
    pieces: [
      ["g1", "K"],
      ["g8", "k"],
      ["d1", "Q"],
      ["d8", "r"],
      ["h1", "R"],
      ["h8", "q"],
      ["f8", "r"],
    ],
    solution: "d1d8",
    solutionLine: ["d1d8", "f8e8", "d8e8", "g8g7", "e8h8"],
  },
  {
    theme: "Kombinasyon",
    prompt: "Beyaz oynar (2 hamle): vezir değişimi, şah çek.",
    pieces: [
      ["g1", "K"],
      ["c8", "k"],
      ["h3", "R"],
      ["h8", "q"],
      ["f8", "r"],
      ["a1", "R"],
    ],
    solution: "h3h8",
    solutionLine: ["h3h8", "f8h8", "a1a8"],
  },
];

export const PUZZLES: PuzzleSpec[] = [
  ...buildPuzzleSet("elo-0-600", "Başlangıç", beginnerDefs),
  ...buildPuzzleSet("elo-600-1200", "Orta seviye", intermediateDefs),
  ...buildPuzzleSet("elo-1200-plus", "İleri seviye", advancedDefs),
];

export function getPuzzlesForBucket(bucket: PuzzleBucketId) {
  return PUZZLES.filter((puzzle) => puzzle.bucket === bucket);
}

export function getTrapMessage(puzzle: PuzzleSpec, from: string, to: string): string | null {
  const uci = `${from}${to}`;
  const trap = puzzle.traps?.find((item) => item.uci === uci);
  return trap?.message ?? null;
}

/** Bilinen tuzak değilse, hamle alma ise materyal geri bildirimi üret. */
export function getWrongCaptureFeedback(
  fen: string,
  from: string,
  to: string
): string | null {
  const game = new Chess(fen);
  let moved;
  try {
    moved = game.move({ from: from as Square, to: to as Square });
  } catch {
    return null;
  }
  if (!moved?.captured) return null;

  const gain = materialGainForSolution(fen, `${from}${to}`);
  if (gain > 0) {
    return `Bu alma +${gain} gibi görünse de en iyi hamle değil. Daha yüksek veya güvenli kazanç ara.`;
  }
  if (gain < 0) {
    return trapMessage(moved.piece, moved.captured, true);
  }
  return "Bu değişim materyal getirmiyor. Daha kazançlı bir alma bul.";
}
