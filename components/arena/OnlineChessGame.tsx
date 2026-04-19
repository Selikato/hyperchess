"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import type {
  PieceDropHandlerArgs,
  PieceHandlerArgs,
  SquareHandlerArgs,
} from "react-chessboard";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";
import {
  applyMove,
  fetchMatch,
  finishMatch,
  joinPrivateMatch,
  setCurrentMatch,
} from "@/lib/arena/api";
import type { MatchRow } from "@/lib/arena/types";

const SELECTED_STYLE: CSSProperties = {
  boxShadow: "inset 0 0 0 3px rgba(129, 182, 76, 0.95)",
  backgroundColor: "rgba(129, 182, 76, 0.12)",
};

const DOT_STYLE: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.38) 20%, transparent 28%)",
};

function legalToDots(game: Chess, from: Square): Record<string, CSSProperties> {
  const out: Record<string, CSSProperties> = {};
  let moves: Move[];
  try {
    moves = game.moves({ square: from, verbose: true });
  } catch {
    return out;
  }
  for (const m of moves) {
    if (m.to) out[m.to] = DOT_STYLE;
  }
  return out;
}

function legalDestinations(game: Chess, from: Square): Set<string> {
  const s = new Set<string>();
  let moves: Move[];
  try {
    moves = game.moves({ square: from, verbose: true });
  } catch {
    return s;
  }
  for (const m of moves) {
    if (m.to) s.add(m.to);
  }
  return s;
}

const STARTING_FEN = new Chess().fen();

export function OnlineChessGame({ matchId }: { matchId: string }) {
  const { user } = useProfile();
  const gameRef = useRef(new Chess());
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [fen, setFen] = useState(STARTING_FEN);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dots, setDots] = useState<Record<string, CSSProperties>>({});
  const [modal, setModal] = useState<{ open: boolean; title: string; body: string }>({
    open: false,
    title: "",
    body: "",
  });

  const myColor: "w" | "b" | null = useMemo(() => {
    if (!user || !match) return null;
    if (match.white_player_id === user.id) return "w";
    if (match.black_player_id === user.id) return "b";
    return null;
  }, [user, match]);

  const boardOrientation = myColor === "b" ? "black" : "white";

  const loadRow = useCallback(async () => {
    try {
      const row = await fetchMatch(matchId);
      setMatch(row);
      setLoadError(row ? null : "Maç bulunamadı.");
      if (row?.fen) {
        try {
          gameRef.current.load(row.fen);
          setFen(gameRef.current.fen());
        } catch {
          setLoadError("Geçersiz FEN.");
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Yüklenemedi.");
    }
  }, [matchId]);

  useEffect(() => {
    startTransition(() => {
      void loadRow();
    });
  }, [loadRow]);

  const attemptedPrivateJoin = useRef(false);
  useEffect(() => {
    if (!match || !user || attemptedPrivateJoin.current) return;
    if (
      match.match_type === "private" &&
      match.private_invitee_id === user.id &&
      match.black_player_id == null &&
      match.status === "waiting"
    ) {
      attemptedPrivateJoin.current = true;
      void joinPrivateMatch(matchId)
        .then(() => loadRow())
        .catch((e) => {
          attemptedPrivateJoin.current = false;
          setBanner(e instanceof Error ? e.message : "Maça katılınamadı.");
        });
    }
  }, [match, user, matchId, loadRow]);

  useEffect(() => {
    void setCurrentMatch(matchId);
    return () => {
      void setCurrentMatch(null);
    };
  }, [matchId]);

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as MatchRow;
          setMatch(row);
          if (row.fen) {
            try {
              gameRef.current.load(row.fen);
              setFen(gameRef.current.fen());
            } catch {
              /* ignore */
            }
          }
          if (row.status === "finished") {
            setModal({
              open: true,
              title: "Maç bitti",
              body:
                row.winner_id === user?.id
                  ? "Kazandın."
                  : row.winner_id
                    ? "Kaybettin."
                    : "Beraberlik veya oyun sonu.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, user?.id]);

  const waitingOpponent =
    match?.status === "waiting" &&
    myColor === "w" &&
    match.black_player_id == null;

  const canInteract =
    Boolean(user) &&
    match?.status === "playing" &&
    myColor !== null &&
    match.turn === myColor &&
    !modal.open;

  const clearSel = useCallback(() => {
    setSelected(null);
    setDots({});
  }, []);

  const squareStyles = useMemo(() => {
    const base = { ...dots };
    if (selected) {
      base[selected] = { ...base[selected], ...SELECTED_STYLE };
    }
    return base;
  }, [dots, selected]);

  const submitMoveAfterLocal = useCallback(
    async (g: Chess) => {
      if (!user || !match || myColor === null) return;
      const gameOver = g.isGameOver();
      gameRef.current.load(g.fen());
      setFen(g.fen());
      clearSel();
      try {
        await applyMove(match.id, g.fen(), g.turn());
        if (gameOver) {
          let winnerId: string | null = null;
          if (g.isCheckmate()) {
            const loser = g.turn();
            winnerId =
              loser === "w" ? match.black_player_id : match.white_player_id;
          }
          try {
            await finishMatch(match.id, winnerId);
          } catch {
            /* rakip de bitirmiş olabilir */
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Hamle reddedildi.";
        setBanner(msg);
        void loadRow();
      }
    },
    [user, match, myColor, clearSel, loadRow]
  );

  const tryLocalMove = useCallback(
    (from: string, to: string): boolean => {
      if (!user || !match || myColor === null) return false;
      const g = new Chess(gameRef.current.fen());
      if (g.turn() !== myColor) return false;
      const m = g.move({
        from: from as Square,
        to: to as Square,
        promotion: "q",
      });
      if (!m) return false;
      void submitMoveAfterLocal(g);
      return true;
    },
    [user, match, myColor, submitMoveAfterLocal]
  );

  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (!canInteract) return;
      const game = gameRef.current;

      if (selected) {
        const legal = legalDestinations(game, selected as Square);
        if (legal.has(square)) {
          tryLocalMove(selected, square);
          return;
        }
      }

      const need = myColor === "w" ? "w" : "b";
      if (!piece || piece.pieceType[0] !== need) {
        clearSel();
        return;
      }

      if (selected === square) {
        clearSel();
        return;
      }

      setSelected(square);
      setDots(legalToDots(game, square as Square));
    },
    [canInteract, clearSel, myColor, selected, tryLocalMove]
  );

  const onPieceClick = useCallback(
    ({ square, piece, isSparePiece }: PieceHandlerArgs) => {
      if (!square || isSparePiece || !piece) return;
      onSquareClick({ square, piece } as SquareHandlerArgs);
    },
    [onSquareClick]
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs) => {
      clearSel();
      if (!canInteract || !targetSquare) return false;
      const need = myColor === "w" ? "w" : "b";
      if (piece.pieceType[0] !== need) return false;
      return tryLocalMove(sourceSquare, targetSquare);
    },
    [canInteract, clearSel, myColor, tryLocalMove]
  );

  const canDragPieceCb = useCallback(
    ({
      piece,
      isSparePiece,
    }: {
      piece: { pieceType: string };
      isSparePiece: boolean;
    }) => {
      const need = myColor === "w" ? "w" : "b";
      return Boolean(
        !isSparePiece && piece?.pieceType?.[0] === need && canInteract
      );
    },
    [canInteract, myColor]
  );

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-800/80 bg-red-950/40 px-4 py-3 text-sm text-red-100">
        {loadError}{" "}
        <Link href="/play/online" className="font-semibold text-[#81b64c] underline">
          Lobiye dön
        </Link>
      </div>
    );
  }

  if (!match || !user) {
    return (
      <p className="text-sm text-[#9b9893]">Maç yükleniyor…</p>
    );
  }

  if (myColor === null) {
    return (
      <div className="rounded-lg border border-[#3c3b36] bg-[#312e2b] px-4 py-3 text-sm text-[#e8e6e3]">
        Bu maçta yer almıyorsun.{" "}
        <Link href="/play/online" className="font-semibold text-[#81b64c] underline">
          Lobiye dön
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex w-full max-w-[min(100vw-0.5rem,560px)] flex-col gap-2 text-[#e8e6e3]">
      <div className="flex items-center justify-between gap-2 text-xs text-[#9b9893]">
        <span>
          {match.match_type === "public" ? "Hızlı maç" : "Özel maç"} ·{" "}
          {match.status === "playing"
            ? `Sıra: ${match.turn === "w" ? "Beyaz" : "Siyah"}`
            : match.status}
        </span>
        <Link
          href="/play/online"
          className="rounded border border-[#3c3b36] bg-[#312e2b] px-2 py-1 text-[11px] text-[#e8e6e3] hover:bg-[#3a3734]"
        >
          Lobiye dön
        </Link>
      </div>

      {waitingOpponent && (
        <p className="rounded-md border border-[#3c3b36] bg-[#312e2b] px-3 py-2 text-center text-sm text-[#e8e6e3]">
          Rakip bekleniyor… Bu sayfayı açık tut.
        </p>
      )}

      {banner && (
        <p className="rounded-md border border-red-800/60 bg-red-950/35 px-3 py-2 text-sm text-red-100">
          {banner}
        </p>
      )}

      <div className="relative w-full overflow-hidden rounded-sm shadow-md">
        <Chessboard
          options={{
            id: `online-${matchId}`,
            position: fen,
            boardOrientation,
            boardStyle: { width: "100%", maxWidth: "100%" },
            squareStyles,
            lightSquareStyle: { backgroundColor: "#ebecd0" },
            darkSquareStyle: { backgroundColor: "#739552" },
            showNotation: true,
            allowDragging: true,
            allowDrawingArrows: false,
            clearArrowsOnPositionChange: true,
            canDragPiece: canDragPieceCb,
            onSquareClick,
            onPieceClick,
            onPieceDrop: onDrop,
          }}
        />
      </div>

      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {modal.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {modal.body}
            </p>
            <Link
              href="/play/online"
              className="mt-6 flex w-full items-center justify-center rounded-md border border-[#5a7a45] bg-[#739552] py-2.5 text-sm font-semibold text-white"
            >
              Tamam
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
