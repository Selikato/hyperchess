"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";

const INVALID_SQUARE_MS = 420;

export function ChessBoard() {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(() => game.fen());
  const [squareStyles, setSquareStyles] = useState<
    Record<string, React.CSSProperties>
  >({});
  const flashTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  const flashInvalidSquare = useCallback((square: string) => {
    setSquareStyles((prev) => ({
      ...prev,
      [square]: {
        backgroundColor: "rgba(220, 38, 38, 0.5)",
        boxShadow: "inset 0 0 18px rgba(185, 28, 28, 0.85)",
      },
    }));

    const prevId = flashTimersRef.current.get(square);
    if (prevId !== undefined) window.clearTimeout(prevId);

    const timeoutId = window.setTimeout(() => {
      setSquareStyles((prev) => {
        if (!(square in prev)) return prev;
        const next = { ...prev };
        delete next[square];
        return next;
      });
      flashTimersRef.current.delete(square);
    }, INVALID_SQUARE_MS);

    flashTimersRef.current.set(square, timeoutId);
  }, []);

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => {
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
    [flashInvalidSquare, game]
  );

  return (
    <div className="w-full max-w-[min(90vw,560px)]">
      <Chessboard
        options={{
          position: fen,
          squareStyles,
          onPieceDrop: onDrop,
        }}
      />
    </div>
  );
}
