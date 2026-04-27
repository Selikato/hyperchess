import type { CSSProperties, JSX } from "react";

type PieceRenderer = (props?: {
  fill?: string;
  square?: string;
  svgStyle?: CSSProperties;
}) => JSX.Element;

function renderPiece(piece: string): PieceRenderer {
  const isWhite = piece.startsWith("w");
  return (props) => (
    <img
      src={`/pieces/chesscom-neo/${piece}.png`}
      alt={piece}
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        userSelect: "none",
        filter: isWhite
          ? "sepia(0.38) saturate(0.78) brightness(1.1) hue-rotate(350deg)"
          : undefined,
        ...props?.svgStyle,
      }}
    />
  );
}

export const MAESTRO_PIECES: Record<string, PieceRenderer> = {
  wK: renderPiece("wK"),
  wQ: renderPiece("wQ"),
  wR: renderPiece("wR"),
  wB: renderPiece("wB"),
  wN: renderPiece("wN"),
  wP: renderPiece("wP"),
  bK: renderPiece("bK"),
  bQ: renderPiece("bQ"),
  bR: renderPiece("bR"),
  bB: renderPiece("bB"),
  bN: renderPiece("bN"),
  bP: renderPiece("bP"),
};
