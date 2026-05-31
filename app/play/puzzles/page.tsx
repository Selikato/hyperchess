"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { ArrowLeft, CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { AdUnit } from "@/components/ads/AdUnit";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { placementReady } from "@/lib/ads/config";
import { MAESTRO_PIECES } from "@/components/arena/customPieces";
import { formatMaterialGain } from "@/lib/chess/material";
import {
  countWhiteMovesInLine,
  getPuzzlesForBucket,
  getSolutionLine,
  getTrapMessage,
  getWrongCaptureFeedback,
  isMultiMovePuzzle,
  PUZZLE_BUCKETS,
  type PuzzleBucketId,
  type PuzzleSpec,
} from "@/lib/chess/puzzles";
import { playMoveSoundForMove, primeChessAudio } from "@/lib/chess/sounds";

const SELECTED_STYLE = {
  boxShadow: "inset 0 0 0 3px rgba(129, 182, 76, 0.95)",
  backgroundColor: "rgba(129, 182, 76, 0.12)",
};

const DOT_STYLE = {
  backgroundImage:
    "radial-gradient(circle, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.38) 20%, transparent 28%)",
};

function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
  };
}

function legalDots(game: Chess, from: Square) {
  const out: Record<string, React.CSSProperties> = {};
  try {
    for (const move of game.moves({ square: from, verbose: true })) {
      out[move.to] = DOT_STYLE;
    }
  } catch {
    return out;
  }
  return out;
}

function whiteMoveNumber(lineIndex: number): number {
  return Math.floor(lineIndex / 2) + 1;
}

function formatLineSans(fen: string, line: string[]): string {
  const game = new Chess(fen);
  const parts: string[] = [];
  for (const uci of line) {
    try {
      const move = game.move(uciToMove(uci));
      if (move) parts.push(move.san);
    } catch {
      parts.push(uci);
    }
  }
  return parts.join(" ");
}

export default function PuzzlesPage() {
  const [bucketId, setBucketId] = useState<PuzzleBucketId | null>(null);
  const [index, setIndex] = useState(0);
  const [fen, setFen] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dots, setDots] = useState<Record<string, React.CSSProperties>>({});
  const [solved, setSolved] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const puzzles = useMemo(
    () => (bucketId ? getPuzzlesForBucket(bucketId) : []),
    [bucketId]
  );
  const puzzle = puzzles[index];
  const solutionLine = useMemo(
    () => (puzzle ? getSolutionLine(puzzle) : []),
    [puzzle]
  );
  const multiMove = puzzle ? isMultiMovePuzzle(puzzle) : false;
  const totalWhiteMoves = useMemo(
    () => countWhiteMovesInLine(solutionLine),
    [solutionLine]
  );
  const currentFen = fen ?? puzzle?.fen ?? new Chess().fen();
  const game = useMemo(() => new Chess(currentFen), [currentFen]);
  const solutionSan = useMemo(() => {
    if (!puzzle) return null;
    if (multiMove) return formatLineSans(puzzle.fen, solutionLine);
    try {
      const preview = new Chess(puzzle.fen);
      const move = preview.move(uciToMove(puzzle.solution));
      return move?.san ?? puzzle.solution;
    } catch {
      return puzzle.solution;
    }
  }, [puzzle, multiMove, solutionLine]);
  const squareStyles = useMemo(() => {
    const next = { ...dots };
    if (selected) next[selected] = { ...(next[selected] ?? {}), ...SELECTED_STYLE };
    return next;
  }, [dots, selected]);

  const resetPuzzleState = (nextPuzzle: PuzzleSpec | undefined) => {
    setFen(nextPuzzle?.fen ?? new Chess().fen());
    setLineIndex(0);
    setSelected(null);
    setDots({});
    setSolved(false);
    setSolutionShown(false);
    setMessage(null);
  };

  const chooseBucket = (id: PuzzleBucketId) => {
    const nextPuzzles = getPuzzlesForBucket(id);
    setBucketId(id);
    setIndex(0);
    resetPuzzleState(nextPuzzles[0]);
  };

  const loadPuzzle = (nextIndex: number) => {
    const nextPuzzle = puzzles[nextIndex];
    if (!nextPuzzle) return;
    setIndex(nextIndex);
    resetPuzzleState(nextPuzzle);
  };

  const resetCurrent = () => {
    if (!puzzle) return;
    resetPuzzleState(puzzle);
  };

  const finishSolved = (lastSan: string, showSolution: boolean) => {
    if (!puzzle) return;
    const gainLabel = formatMaterialGain(puzzle.materialGain);
    setSolved(true);
    setSolutionShown(showSolution);
    setSelected(null);
    setDots({});
    setMessage(
      showSolution
        ? `Çözüm: ${solutionSan ?? lastSan} (${gainLabel} materyal)`
        : multiMove
          ? `Doğru! Seri tamam — net kazanç ${gainLabel}`
          : `Doğru! ${lastSan} — net kazanç ${gainLabel}`
    );
  };

  const autoPlayBlackReplies = (game: Chess, fromIndex: number, line: string[]) => {
    let idx = fromIndex;
    let lastSan = "";
    if (idx < line.length) {
      const move = game.move(uciToMove(line[idx]));
      if (move) {
        playMoveSoundForMove(move);
        lastSan = move.san;
        idx += 1;
      }
    }
    return { game, nextIndex: idx, lastSan };
  };

  const playSolutionMove = (showSolution: boolean) => {
    if (!puzzle) return false;
    const next = new Chess(puzzle.fen);
    const { game: played, lastSan } = autoPlayBlackReplies(next, 0, solutionLine);
    if (!lastSan && solutionLine.length === 0) return false;
    setFen(played.fen());
    setLineIndex(solutionLine.length);
    finishSolved(lastSan, showSolution);
    return true;
  };

  const tryMove = (from: string, to: string) => {
    if (!puzzle || solved) return false;
    const uci = `${from}${to}`;
    const expected = solutionLine[lineIndex];
    if (uci !== expected) {
      const trapMsg = getTrapMessage(puzzle, from, to);
      const captureMsg = trapMsg ?? getWrongCaptureFeedback(puzzle.fen, from, to);
      setMessage(
        captureMsg ??
          (multiMove
            ? "Bu hamle değil. Serideki doğru beyaz hamleyi oyna."
            : "Bu hamle değil. Materyal kazandıran en iyi almayı ara.")
      );
      setSelected(null);
      setDots({});
      return false;
    }

    const next = new Chess(currentFen);
    const moved = next.move(uciToMove(uci));
    if (!moved) return false;
    playMoveSoundForMove(moved);

    const afterBlack = autoPlayBlackReplies(next, lineIndex + 1, solutionLine);
    setFen(afterBlack.game.fen());

    if (afterBlack.nextIndex >= solutionLine.length) {
      finishSolved(moved.san, false);
      return true;
    }

    setLineIndex(afterBlack.nextIndex);
    setSelected(null);
    setDots({});
    const moveNo = whiteMoveNumber(afterBlack.nextIndex);
    const blackMsg = afterBlack.lastSan ? ` Siyah ${afterBlack.lastSan} oynadı.` : "";
    setMessage(
      multiMove
        ? `Doğru (${moveNo}/${totalWhiteMoves}).${blackMsg} Sıradaki beyaz hamle.`
        : `Doğru! ${moved.san}`
    );
    return true;
  };

  const onSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    primeChessAudio();
    if (solved) return;
    if (selected && square in dots) {
      tryMove(selected, square);
      return;
    }
    if (!piece || piece.pieceType[0] !== "w") {
      setSelected(null);
      setDots({});
      return;
    }
    setSelected(square);
    setDots(legalDots(game, square as Square));
  };

  const onPieceClick = ({ square, piece, isSparePiece }: PieceHandlerArgs) => {
    if (!square || isSparePiece || !piece) return;
    onSquareClick({ square, piece } as SquareHandlerArgs);
  };

  const onDrop = ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => {
    if (!targetSquare || !piece || piece.pieceType[0] !== "w") return false;
    return tryMove(sourceSquare, targetSquare);
  };

  if (!bucketId) {
    return (
      <ArenaShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-white">Bulmacalar</h1>
          <p className="mt-1 text-sm text-[#9b9893]">
            Seviyeni seç, her pakette 20 taktik bulmacası çöz.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {PUZZLE_BUCKETS.map((bucket) => (
              <button
                key={bucket.id}
                type="button"
                onClick={() => chooseBucket(bucket.id)}
                className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4 text-left transition hover:border-[#81b64c] hover:bg-[#25241f]"
              >
                <span className="text-lg font-bold text-white">{bucket.label}</span>
                <span className="mt-1 block text-sm text-[#9b9893]">
                  {bucket.description}
                </span>
                <span className="mt-4 inline-flex rounded-md bg-[#81b64c] px-3 py-1.5 text-xs font-bold text-[#1f2a18]">
                  20 bulmaca
                </span>
              </button>
            ))}
          </div>
          {placementReady("puzzles") && (
            <div className="mt-6 max-w-xl">
              <AdUnit placement="puzzles" format="horizontal" minHeight={100} />
            </div>
          )}
        </div>
      </ArenaShell>
    );
  }

  const bucket = PUZZLE_BUCKETS.find((item) => item.id === bucketId);
  const isLast = index >= puzzles.length - 1;

  return (
    <ArenaShell>
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setBucketId(null)}
            className="inline-flex items-center gap-1 rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-xs font-semibold text-[#e8e6e3]"
          >
            <ArrowLeft className="size-4" />
            Seviyeler
          </button>
          <span className="rounded-full border border-[#3c3b36] bg-[#201f1b] px-3 py-1 text-xs font-semibold text-[#c8c6c2]">
            {index + 1}/{puzzles.length}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-3">
            <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-150px))] overflow-hidden rounded-md border border-[#3c3b36]">
              <Chessboard
                options={{
                  id: "puzzles-board",
                  position: currentFen,
                  boardOrientation: "white",
                  boardStyle: { width: "100%", maxWidth: "100%" },
                  squareStyles,
                  lightSquareStyle: { backgroundColor: "#d9dee2" },
                  darkSquareStyle: { backgroundColor: "#a4adb5" },
                  showNotation: true,
                  allowDragging: !solved,
                  pieces: MAESTRO_PIECES,
                  onSquareClick,
                  onPieceClick,
                  onPieceDrop: onDrop,
                }}
              />
            </div>
          </div>

          <aside className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#81b64c]">
              {bucket?.label}
            </p>
            <h1 className="mt-1 text-xl font-bold text-white">{puzzle?.title}</h1>
            <p className="mt-2 text-sm text-[#c8c6c2]">{puzzle?.prompt}</p>
            <p className="mt-1 text-xs text-[#9b9893]">Tema: {puzzle?.theme}</p>
            {multiMove && !solved && (
              <p className="mt-2 text-xs text-sky-200/90">
                Beyaz hamlesi {whiteMoveNumber(lineIndex)}/{totalWhiteMoves} — siyah yanıtları
                otomatik oynanır (en fazla 5 yarım hamle).
              </p>
            )}
            {puzzle && puzzle.traps && puzzle.traps.length > 0 && !solved && (
              <p className="mt-2 text-xs text-amber-200/90">
                İpucu: Birden fazla alma görünüyorsa geri almayı ve taş değerlerini
                say.
              </p>
            )}
            {message && (
              <p
                className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                  solved
                    ? "border-[#81b64c]/50 bg-[#81b64c]/10 text-[#c9efac]"
                    : "border-amber-500/40 bg-amber-950/20 text-amber-200"
                }`}
              >
                {message}
              </p>
            )}
            {solutionShown && solutionSan && (
              <p className="mt-3 rounded-md border border-sky-500/30 bg-sky-950/20 px-3 py-2 text-sm text-sky-100">
                Tahtada çözüm oynandı: <span className="font-bold">{solutionSan}</span>
              </p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={resetCurrent}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[#3c3b36] bg-[#2a2926] px-3 py-2 text-sm font-semibold text-[#e8e6e3]"
              >
                <RotateCcw className="size-4" />
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => playSolutionMove(true)}
                disabled={solved}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-sky-500/40 bg-sky-950/30 px-3 py-2 text-sm font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eye className="size-4" />
                Çözümü göster
              </button>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    setBucketId(null);
                    return;
                  }
                  loadPuzzle(index + 1);
                }}
                disabled={!solved}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[#6f9f43] bg-[#81b64c] px-3 py-2 text-sm font-bold text-[#1f2a18] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                {isLast ? "Bitir" : "Sonraki"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </ArenaShell>
  );
}
