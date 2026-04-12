"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { Chessboard, defaultArrowOptions } from "react-chessboard";
import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import type {
  Arrow,
  PieceDropHandlerArgs,
  PieceHandlerArgs,
  SquareHandlerArgs,
} from "react-chessboard";

/** Strateji okları: [[from, to], ...] */
type ArrowPair = [string, string];

const INVALID_SQUARE_MS = 420;

const SELECTED_SQUARE_STYLE: CSSProperties = {
  boxShadow: "inset 0 0 0 3px rgba(212, 175, 55, 0.95)",
  backgroundColor: "rgba(212, 175, 55, 0.16)",
};

const MOVE_DOT_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.42) 22%, rgba(0,0,0,0.15) 28%, transparent 32%)",
};

function legalDestinationSet(game: Chess, from: Square): Set<string> {
  let moves: Move[];
  try {
    moves = game.moves({ square: from, verbose: true });
  } catch {
    return new Set();
  }
  const s = new Set<string>();
  for (const m of moves) {
    if (m.to) s.add(m.to);
  }
  return s;
}

function dotStylesForSquare(game: Chess, from: Square): Record<string, CSSProperties> {
  const out: Record<string, CSSProperties> = {};
  for (const to of legalDestinationSet(game, from)) {
    out[to] = MOVE_DOT_STYLE;
  }
  return out;
}

export function ChessBoard() {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(() => game.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<
    Record<string, CSSProperties>
  >({});
  const [arrows, setArrows] = useState<ArrowPair[]>([]);
  const [flashBySquare, setFlashBySquare] = useState<
    Record<string, CSSProperties>
  >({});

  const arrowDragStartRef = useRef<string | null>(null);
  const flashTimersRef = useRef<Map<string, number>>(new Map());

  const boardArrows = useMemo<Arrow[]>(
    () =>
      arrows.map(([startSquare, endSquare]) => ({
        startSquare,
        endSquare,
        color: defaultArrowOptions.color,
      })),
    [arrows]
  );

  const clearAllMarks = useCallback(() => {
    setSelectedSquare(null);
    setPossibleMoves({});
    setArrows([]);
    arrowDragStartRef.current = null;
  }, []);

  const customSquareStyles = useMemo(() => {
    const base: Record<string, CSSProperties> = { ...possibleMoves };
    if (selectedSquare) {
      base[selectedSquare] = {
        ...base[selectedSquare],
        ...SELECTED_SQUARE_STYLE,
      };
    }
    return { ...base, ...flashBySquare };
  }, [possibleMoves, selectedSquare, flashBySquare]);

  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const onUp = (e: MouseEvent) => {
      if (e.button === 2) arrowDragStartRef.current = null;
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearAllMarks();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearAllMarks]);

  const flashInvalidSquare = useCallback((square: string) => {
    setFlashBySquare((prev) => ({
      ...prev,
      [square]: {
        backgroundColor: "rgba(220, 38, 38, 0.5)",
        boxShadow: "inset 0 0 18px rgba(185, 28, 28, 0.85)",
      },
    }));

    const prevId = flashTimersRef.current.get(square);
    if (prevId !== undefined) window.clearTimeout(prevId);

    const timeoutId = window.setTimeout(() => {
      setFlashBySquare((prev) => {
        if (!(square in prev)) return prev;
        const next = { ...prev };
        delete next[square];
        return next;
      });
      flashTimersRef.current.delete(square);
    }, INVALID_SQUARE_MS);

    flashTimersRef.current.set(square, timeoutId);
  }, []);

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (from === to) return false;
      try {
        const m = game.move({
          from: from as Square,
          to: to as Square,
          promotion: "q",
        });
        return m !== null;
      } catch {
        return false;
      }
    },
    [game]
  );

  const handleLeftClickSquare = useCallback(
    (square: string, piece: SquareHandlerArgs["piece"]) => {
      setArrows([]);

      if (selectedSquare) {
        const legal = legalDestinationSet(game, selectedSquare as Square);
        if (legal.has(square)) {
          if (tryMove(selectedSquare, square)) {
            setFen(game.fen());
            clearAllMarks();
          } else {
            clearAllMarks();
          }
          return;
        }
      }

      if (!piece) {
        clearAllMarks();
        return;
      }

      const side = piece.pieceType[0];
      if (side !== "w" && side !== "b") {
        clearAllMarks();
        return;
      }

      if (game.turn() !== side) {
        clearAllMarks();
        return;
      }

      if (selectedSquare === square) {
        clearAllMarks();
        return;
      }

      setSelectedSquare(square);
      setPossibleMoves(dotStylesForSquare(game, square as Square));
    },
    [clearAllMarks, game, selectedSquare, tryMove]
  );

  const onSquareClick = useCallback(
    (args: SquareHandlerArgs) => {
      handleLeftClickSquare(args.square, args.piece);
    },
    [handleLeftClickSquare]
  );

  const onPieceClick = useCallback(
    ({ square, piece, isSparePiece }: PieceHandlerArgs) => {
      if (!square || isSparePiece || !piece) return;
      handleLeftClickSquare(square, piece);
    },
    [handleLeftClickSquare]
  );

  const onSquareMouseDown = useCallback(
    ({ square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      arrowDragStartRef.current = square;
    },
    []
  );

  const onSquareMouseUp = useCallback(
    ({ square }: SquareHandlerArgs, e: React.MouseEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const from = arrowDragStartRef.current;
      arrowDragStartRef.current = null;
      if (!from || from === square) return;
      const nextPair: ArrowPair = [from, square];
      setArrows((prev) => {
        const idx = prev.findIndex(([f, t]) => f === from && t === square);
        if (idx !== -1) {
          return prev.filter((_, i) => i !== idx);
        }
        return [...prev, nextPair];
      });
    },
    []
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => {
      clearAllMarks();

      if (!targetSquare) {
        flashInvalidSquare(sourceSquare);
        return false;
      }

      const side = piece.pieceType[0];
      if (side !== "w" && side !== "b") {
        flashInvalidSquare(sourceSquare);
        return false;
      }

      if (game.turn() !== side) {
        flashInvalidSquare(sourceSquare);
        return false;
      }

      if (sourceSquare === targetSquare) {
        return false;
      }

      let move: Move | null = null;
      try {
        move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch {
        flashInvalidSquare(sourceSquare);
        return false;
      }

      if (!move) {
        flashInvalidSquare(sourceSquare);
        return false;
      }

      setFen(game.fen());
      return true;
    },
    [clearAllMarks, flashInvalidSquare, game]
  );

  return (
    <div className="w-full max-w-[min(90vw,560px)]">
      <Chessboard
        options={{
          position: fen,
          squareStyles: customSquareStyles,
          arrows: boardArrows,
          allowDrawingArrows: false,
          onSquareClick,
          onPieceClick,
          onSquareMouseDown,
          onSquareMouseUp,
          onPieceDrop: onDrop,
        }}
      />
    </div>
  );
}
