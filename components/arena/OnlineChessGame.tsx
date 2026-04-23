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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Crown } from "lucide-react";
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
import { MAESTRO_PIECES } from "@/components/arena/customPieces";
import {
  applyMove,
  fetchProfileDisplayName,
  fetchProfileElo,
  fetchMatch,
  finishMatch,
  joinPrivateMatch,
  setOwnProfileElo,
  setCurrentMatch,
} from "@/lib/arena/api";
import type { MatchRow } from "@/lib/arena/types";
import { computeEloAfterOnlineMatch, DEFAULT_ELO } from "@/lib/elo";

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
const MATCH_MS = 10 * 60 * 1000;

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MatchPlayerBar({
  avatarSrc,
  fallbackLetter,
  name,
  eloText,
  clockMs,
  timerVariant,
  crown,
}: {
  avatarSrc?: string;
  fallbackLetter: string;
  name: string;
  eloText: string;
  clockMs: number;
  timerVariant: "dark" | "light";
  crown?: "win" | "loss" | null;
}) {
  const timerClass =
    timerVariant === "dark"
      ? "bg-black/80 text-white"
      : "bg-white text-zinc-900 shadow-sm";

  return (
    <div className="relative flex min-h-[44px] items-center justify-between gap-2 px-0.5 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
        <div className="relative size-9 shrink-0 overflow-hidden rounded border border-white/30 bg-white sm:size-10">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-zinc-500 text-sm font-bold uppercase text-white">
              {fallbackLetter.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 truncate text-[14px] font-semibold text-white sm:text-[15px]">
          {name}{" "}
          <span className="font-normal text-zinc-300">({eloText})</span>
        </div>
      </div>
      <div
        className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold tabular-nums sm:gap-1.5 sm:px-2.5 sm:text-sm ${timerClass}`}
      >
        <Clock
          className={`size-3.5 sm:size-4 ${timerVariant === "light" ? "text-zinc-700" : "opacity-90"}`}
          aria-hidden
        />
        {formatClock(clockMs)}
      </div>
      {crown && (
        <span
          className={`absolute -right-2 -top-2 z-20 flex size-6 items-center justify-center rounded-full border ${
            crown === "win"
              ? "border-green-300 bg-[#8bcf5f] text-white"
              : "border-red-300 bg-red-500 text-white"
          }`}
          aria-label={crown === "win" ? "Kazanan" : "Kaybeden"}
        >
          <Crown className="size-3.5" />
        </span>
      )}
    </div>
  );
}

export function OnlineChessGame({ matchId }: { matchId: string }) {
  const router = useRouter();
  const { user, elo, refreshProfile } = useProfile();
  const gameRef = useRef(new Chess());
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [fen, setFen] = useState(STARTING_FEN);
  const [history, setHistory] = useState<string[]>([STARTING_FEN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dots, setDots] = useState<Record<string, CSSProperties>>({});
  const [modal, setModal] = useState<{ open: boolean; title: string; body: string }>({
    open: false,
    title: "",
    body: "",
  });
  const [eloDelta, setEloDelta] = useState<number | null>(null);
  const [whiteClockMs, setWhiteClockMs] = useState(MATCH_MS);
  const [blackClockMs, setBlackClockMs] = useState(MATCH_MS);

  const myColor: "w" | "b" | null = useMemo(() => {
    if (!user || !match) return null;
    if (match.white_player_id === user.id) return "w";
    if (match.black_player_id === user.id) return "b";
    return null;
  }, [user, match]);

  const boardOrientation = myColor === "b" ? "black" : "white";
  const myName =
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Oyuncu";
  const whiteName =
    (match?.white_player_id && nameById[match.white_player_id]) ||
    (match?.white_player_id === user?.id ? myName : "Beyaz");
  const blackName =
    (match?.black_player_id && nameById[match.black_player_id]) ||
    (match?.black_player_id === user?.id ? myName : "Siyah");
  const topName = boardOrientation === "white" ? blackName : whiteName;
  const bottomName = boardOrientation === "white" ? whiteName : blackName;

  const knownMatchOnceRef = useRef(false);
  const eloAppliedRef = useRef(false);
  const historyIndexRef = useRef(0);
  const fenRef = useRef(STARTING_FEN);
  const lastServerUpdateRef = useRef<string | null>(null);

  const applyFenSnapshot = useCallback((nextFen: string) => {
    setHistory((prev) => {
      const base = prev.slice(0, historyIndexRef.current + 1);
      if (base[base.length - 1] === nextFen) {
        setHistoryIndex(base.length - 1);
        historyIndexRef.current = base.length - 1;
        return base;
      }
      const next = [...base, nextFen];
      setHistoryIndex(next.length - 1);
      historyIndexRef.current = next.length - 1;
      return next;
    });
    setFen(nextFen);
    fenRef.current = nextFen;
  }, []);

  const loadRow = useCallback(async () => {
    try {
      const row = await fetchMatch(matchId);
      if (!row) {
        if (knownMatchOnceRef.current) {
          router.replace("/play/online?inviteClosed=1");
          return;
        }
        setMatch(null);
        setLoadError("Maç bulunamadı.");
        return;
      }
      knownMatchOnceRef.current = true;
      setMatch(row);
      lastServerUpdateRef.current = row.updated_at;
      setLoadError(null);
      if (row.fen) {
        try {
          gameRef.current.load(row.fen);
          applyFenSnapshot(gameRef.current.fen());
        } catch {
          setLoadError("Geçersiz FEN.");
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Yüklenemedi.");
    }
  }, [matchId, router, applyFenSnapshot]);

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    startTransition(() => {
      void loadRow();
    });
  }, [loadRow]);

  useEffect(() => {
    eloAppliedRef.current = false;
    setEloDelta(null);
    setHistory([STARTING_FEN]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
  }, [matchId]);

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
    if (!match) return;
    const ids = [match.white_player_id, match.black_player_id].filter(
      (id): id is string => Boolean(id)
    );
    if (!ids.length) return;
    const missing = ids.filter((id) => !nameById[id]);
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (id) => ({
        id,
        name: (await fetchProfileDisplayName(id)) ?? "Oyuncu",
      }))
    ).then((rows) => {
      setNameById((prev) => {
        const next = { ...prev };
        for (const row of rows) next[row.id] = row.name;
        return next;
      });
    });
  }, [match, nameById]);

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
          lastServerUpdateRef.current = row.updated_at;
          if (row.fen) {
            try {
              const before = fenRef.current;
              gameRef.current.load(row.fen);
              const serverFen = gameRef.current.fen();
              if (serverFen !== before) {
                applyFenSnapshot(serverFen);
              }
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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        () => {
          router.replace("/play/online?inviteClosed=1");
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, user?.id, router, applyFenSnapshot]);

  useEffect(() => {
    if (!match || match.status !== "playing" || modal.open) return;
    const id = setInterval(() => {
      if (match.turn === "w") {
        setWhiteClockMs((w) => Math.max(0, w - 1000));
      } else {
        setBlackClockMs((b) => Math.max(0, b - 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [match?.id, match?.status, match?.turn, modal.open]);

  useEffect(() => {
    if (!match || !user || myColor === null) return;
    if (match.status !== "finished" || eloAppliedRef.current) return;
    const opponentId =
      myColor === "w" ? match.black_player_id : match.white_player_id;
    if (!opponentId) return;

    eloAppliedRef.current = true;
    const outcome: "win" | "loss" | "draw" =
      match.winner_id == null ? "draw" : match.winner_id === user.id ? "win" : "loss";

    void (async () => {
      const myElo = elo ?? DEFAULT_ELO;
      const oppElo = (await fetchProfileElo(opponentId)) ?? DEFAULT_ELO;
      const nextElo = computeEloAfterOnlineMatch(myElo, oppElo, outcome);
      if (nextElo !== myElo) {
        await setOwnProfileElo(nextElo);
      }
      setEloDelta(nextElo - myElo);
      await refreshProfile();
    })().catch(() => {
      eloAppliedRef.current = false;
      setBanner("Puan güncellenemedi. Lütfen tekrar dene.");
    });
  }, [match, user, myColor, elo, refreshProfile]);

  useEffect(() => {
    if (!match) return;
    if (match.status !== "waiting") return;
    const id = setInterval(() => {
      void loadRow();
    }, 2500);
    return () => clearInterval(id);
  }, [match?.id, match?.status, loadRow]);

  useEffect(() => {
    if (!match || match.status !== "playing") return;
    const id = setInterval(() => {
      void fetchMatch(matchId)
        .then((row) => {
          if (!row || row.status !== "playing") return;
          if (
            lastServerUpdateRef.current &&
            row.updated_at <= lastServerUpdateRef.current
          ) {
            return;
          }
          lastServerUpdateRef.current = row.updated_at;
          setMatch(row);
          if (!row.fen) return;
          try {
            const before = fenRef.current;
            gameRef.current.load(row.fen);
            const serverFen = gameRef.current.fen();
            if (serverFen !== before) {
              applyFenSnapshot(serverFen);
            }
          } catch {
            /* ignore */
          }
        })
        .catch(() => undefined);
    }, 1200);
    return () => clearInterval(id);
  }, [matchId, match?.status, applyFenSnapshot]);

  const waitingOpponent =
    match?.status === "waiting" &&
    myColor === "w" &&
    match.black_player_id == null;

  const winnerColor: "w" | "b" | null = useMemo(() => {
    if (!match?.winner_id) return null;
    if (match.winner_id === match.white_player_id) return "w";
    if (match.winner_id === match.black_player_id) return "b";
    return null;
  }, [match]);

  const topColor: "w" | "b" = boardOrientation === "white" ? "b" : "w";
  const bottomColor: "w" | "b" = boardOrientation === "white" ? "w" : "b";
  const topCrown: "win" | "loss" | null =
    match?.status === "finished" && winnerColor
      ? winnerColor === topColor
        ? "win"
        : "loss"
      : null;
  const bottomCrown: "win" | "loss" | null =
    match?.status === "finished" && winnerColor
      ? winnerColor === bottomColor
        ? "win"
        : "loss"
      : null;

  useEffect(() => {
    if (!match?.id) return;
    setWhiteClockMs(MATCH_MS);
    setBlackClockMs(MATCH_MS);
  }, [match?.id]);

  const canInteract =
    Boolean(user) &&
    match?.status === "playing" &&
    myColor !== null &&
    match.turn === myColor &&
    !modal.open &&
    historyIndex === history.length - 1;

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
      applyFenSnapshot(g.fen());
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
    [user, match, myColor, clearSel, loadRow, applyFenSnapshot]
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

  const resign = useCallback(async () => {
    if (!match || myColor === null || modal.open || match.status !== "playing") return;
    const winnerId =
      myColor === "w" ? match.black_player_id ?? null : match.white_player_id ?? null;
    try {
      await finishMatch(match.id, winnerId);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Maç sonlandırılamadı.");
    }
  }, [match, myColor, modal.open]);

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
    <div className="relative flex w-full max-w-[min(100vw-0.5rem,560px)] flex-col gap-1.5 text-zinc-100 sm:max-w-[min(96vw,640px)]">
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

      <div className="relative flex w-full flex-col gap-1.5 sm:gap-2">
        <MatchPlayerBar
          fallbackLetter={topName || "R"}
          name={topName}
          eloText="?"
          clockMs={boardOrientation === "white" ? blackClockMs : whiteClockMs}
          timerVariant="dark"
          crown={topCrown}
        />
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
              allowDrawingArrows: true,
              clearArrowsOnPositionChange: true,
              pieces: MAESTRO_PIECES,
              canDragPiece: canDragPieceCb,
              onSquareClick,
              onPieceClick,
              onPieceDrop: onDrop,
            }}
          />
        </div>
        <MatchPlayerBar
          fallbackLetter={bottomName || "S"}
          name={bottomName}
          eloText="?"
          clockMs={boardOrientation === "white" ? whiteClockMs : blackClockMs}
          timerVariant="light"
          crown={bottomCrown}
        />
      </div>

      <div className="relative mt-1 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (historyIndex <= 0) return;
            const idx = historyIndex - 1;
            historyIndexRef.current = idx;
            setHistoryIndex(idx);
            setFen(history[idx]);
            clearSel();
          }}
          disabled={historyIndex <= 0}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-500 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <ChevronLeft className="size-4" />
          Geri
        </button>
        <button
          type="button"
          onClick={() => {
            if (historyIndex >= history.length - 1) return;
            const idx = historyIndex + 1;
            historyIndexRef.current = idx;
            setHistoryIndex(idx);
            setFen(history[idx]);
            clearSel();
          }}
          disabled={historyIndex >= history.length - 1}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-500 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          İleri
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void resign()}
          disabled={modal.open || match.status !== "playing"}
          className="rounded-md border border-[#5a7a45] bg-[#739552] px-4 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50"
        >
          Terk et
        </button>
        <Link
          href="/play/online"
          className="rounded-md border border-zinc-500 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
        >
          Lobi
        </Link>
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
            {eloDelta !== null && (
              <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-300">
                Elo değişimi: {eloDelta > 0 ? `+${eloDelta}` : eloDelta}
              </p>
            )}
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
