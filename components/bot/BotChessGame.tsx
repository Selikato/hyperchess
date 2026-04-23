"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
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
import {
  StockfishBrowserEngine,
  parseUciBestmove,
} from "@/lib/stockfish/browserEngine";
import { useProfile } from "@/components/ProfileProvider";
import { MAESTRO_PIECES } from "@/components/arena/customPieces";
import {
  animateEloNumber,
  computeEloAfterBotMatch,
  DEFAULT_ELO,
} from "@/lib/elo";

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

type GameOutcome = "win" | "loss" | "draw";
type ModalOutcome = GameOutcome | "resign" | null;

function outcomeAfterMove(game: Chess): GameOutcome | null {
  if (game.isCheckmate()) {
    return game.turn() === "b" ? "win" : "loss";
  }
  if (
    game.isStalemate() ||
    game.isDraw() ||
    game.isThreefoldRepetition() ||
    game.isInsufficientMaterial()
  ) {
    return "draw";
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
        >
          <Crown className="size-3.5" />
        </span>
      )}
    </div>
  );
}

export function BotChessGame() {
  const game = useMemo(() => new Chess(), []);
  const { user, elo, refreshProfile } = useProfile();

  /** Maç başında profilden alınan Elo (hesaplama bu değere göre) */
  const matchStartEloRef = useRef<number | null>(null);
  /** Tahta üzerinde gösterilen Elo (animasyonlu) */
  const [liveElo, setLiveElo] = useState<number | null>(null);
  const eloAnimatingRef = useRef(false);

  const [fen, setFen] = useState(() => game.fen());
  const [history, setHistory] = useState<string[]>([game.fen()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dots, setDots] = useState<Record<string, CSSProperties>>({});
  const [thinking, setThinking] = useState(false);
  const [engineReady, setEngineReady] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [analysisBadge, setAnalysisBadge] = useState<{
    mark: "!" | "?";
    delta: number;
  } | null>(null);

  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    body: string;
    outcome: ModalOutcome;
  }>({ open: false, title: "", body: "", outcome: null });

  const [whiteClockMs, setWhiteClockMs] = useState(MATCH_MS);
  const [blackClockMs, setBlackClockMs] = useState(MATCH_MS);

  const engineRef = useRef<StockfishBrowserEngine | null>(null);
  const botBusyRef = useRef(false);
  const runBotMoveRef = useRef<() => Promise<void>>(async () => {});
  const historyIndexRef = useRef(0);

  const previousEvalRef = useRef<number | null>(null);

  const depth = 15;

  useEffect(() => {
    if (eloAnimatingRef.current) return;
    if (elo === null || elo === undefined) {
      setLiveElo(null);
      return;
    }
    setLiveElo(elo);
    if (matchStartEloRef.current === null) {
      matchStartEloRef.current = elo;
    }
  }, [elo]);

  const displayEloForBar = user
    ? String(Math.round(liveElo ?? elo ?? DEFAULT_ELO))
    : "?";

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Oyuncu";

  /** Profilden bağımsız: tahta hemen oynanabilir; motor arka planda yüklenir. */
  useEffect(() => {
    let cancelled = false;
    const engine = new StockfishBrowserEngine();

    (async () => {
      try {
        setEngineReady("loading");
        setEngineError(null);
        await engine.connect();
        if (cancelled) return;
        await engine.initUci();
        if (cancelled) return;
        engineRef.current = engine;
        setEngineReady("ready");
      } catch (e) {
        if (!cancelled) {
          setEngineReady("error");
          setEngineError(
            e instanceof Error ? e.message : "Motor başlatılamadı."
          );
        }
        engine.dispose();
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  const squareStyles = useMemo(() => {
    const base = { ...dots };
    if (selected) {
      base[selected] = { ...base[selected], ...SELECTED_STYLE };
    }
    return base;
  }, [dots, selected]);

  const clearSel = useCallback(() => {
    setSelected(null);
    setDots({});
  }, []);

  const normalizeEvalForWhite = useCallback(
    (scoreCp: number | null, turn: "w" | "b"): number | null => {
      if (scoreCp === null) return null;
      return turn === "w" ? scoreCp : -scoreCp;
    },
    []
  );

  const pushAnalysisDelta = useCallback(
    (currentEvalWhite: number | null) => {
      const prev = previousEvalRef.current;
      if (prev !== null && currentEvalWhite !== null) {
        const delta = currentEvalWhite - prev;
        if (delta >= 200) {
          setAnalysisBadge({ mark: "!", delta });
        } else if (delta <= -200) {
          setAnalysisBadge({ mark: "?", delta });
        } else {
          setAnalysisBadge(null);
        }
      }
      previousEvalRef.current = currentEvalWhite;
    },
    []
  );

  const canInteract =
    engineReady === "ready" &&
    !thinking &&
    !modal.open &&
    game.turn() === "w" &&
    historyIndex === history.length - 1;

  const pushFenSnapshot = useCallback((nextFen: string) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndexRef.current + 1);
      if (trimmed[trimmed.length - 1] === nextFen) {
        setHistoryIndex(trimmed.length - 1);
        historyIndexRef.current = trimmed.length - 1;
        return trimmed;
      }
      const next = [...trimmed, nextFen];
      setHistoryIndex(next.length - 1);
      historyIndexRef.current = next.length - 1;
      return next;
    });
    setFen(nextFen);
  }, []);

  const canDragPieceCb = useCallback(
    ({
      piece,
      isSparePiece,
    }: {
      piece: { pieceType: string };
      isSparePiece: boolean;
    }) =>
      Boolean(
        !isSparePiece && piece?.pieceType?.[0] === "w" && canInteract
      ),
    [canInteract]
  );

  const applyUserMove = useCallback(
    (from: string, to: string): boolean => {
      if (!canInteract) return false;
      if (game.turn() !== "w") return false;
      try {
        const m = game.move({
          from: from as Square,
          to: to as Square,
          promotion: "q",
        });
        if (!m) return false;
        pushFenSnapshot(game.fen());
        clearSel();
        const end = outcomeAfterMove(game);
        if (end) {
          setModal({
            open: true,
            title: "Oyun bitti",
            body: end === "draw" ? "Beraberlik." : "Oyun bitti.",
            outcome: end,
          });
          return true;
        }
        void runBotMoveRef.current();
        return true;
      } catch {
        return false;
      }
    },
    [canInteract, clearSel, game, pushFenSnapshot]
  );

  const runBotMove = useCallback(async () => {
    if (botBusyRef.current || game.turn() !== "b") return;
    const eng = engineRef.current;
    if (!eng || engineReady !== "ready") return;
    botBusyRef.current = true;
    setThinking(true);
    try {
      await sleep(1000);
      const fenBefore = game.fen();
      const turnBefore = game.turn();
      const { bestmove, evalCp } = await eng.goBestMoveWithEval(fenBefore, depth);
      pushAnalysisDelta(normalizeEvalForWhite(evalCp, turnBefore));

      const parsed = parseUciBestmove(bestmove);
      const move = game.move({
        from: parsed.from as Square,
        to: parsed.to as Square,
        promotion: (parsed.promotion ?? "q") as "q" | "r" | "b" | "n",
      });
      if (!move) {
        setBanner("Hata oluştu, tekrar dene.");
        return;
      }
      pushFenSnapshot(game.fen());
      setBanner(null);

      const postEval = await eng.evaluateFen(game.fen(), depth);
      pushAnalysisDelta(normalizeEvalForWhite(postEval, game.turn()));

      const end = outcomeAfterMove(game);
      if (end) {
        setModal({
          open: true,
          title: "Oyun bitti",
          body: end === "draw" ? "Beraberlik." : "Oyun bitti.",
          outcome: end,
        });
      }
    } catch {
      setBanner("Hata oluştu, tekrar dene.");
    } finally {
      setThinking(false);
      botBusyRef.current = false;
    }
  }, [depth, engineReady, game, normalizeEvalForWhite, pushAnalysisDelta, pushFenSnapshot]);

  useEffect(() => {
    runBotMoveRef.current = runBotMove;
  }, [runBotMove]);

  useEffect(() => {
    if (modal.open || game.isGameOver()) return;
    const id = setInterval(() => {
      if (game.turn() === "w") {
        setWhiteClockMs((w) => Math.max(0, w - 1000));
      } else {
        setBlackClockMs((b) => Math.max(0, b - 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [fen, modal.open, game]);

  useEffect(() => {
    if (engineReady !== "ready") return;
    const eng = engineRef.current;
    if (!eng) return;
    let cancelled = false;
    void (async () => {
      const baseEval = await eng.evaluateFen(game.fen(), depth).catch(() => null);
      if (cancelled) return;
      previousEvalRef.current = normalizeEvalForWhite(baseEval, game.turn());
      setAnalysisBadge(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [depth, engineReady, game, normalizeEvalForWhite]);

  const onSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (!canInteract) return;

      if (selected) {
        const legal = legalDestinations(game, selected as Square);
        if (legal.has(square)) {
          applyUserMove(selected, square);
          return;
        }
      }

      if (!piece || piece.pieceType[0] !== "w") {
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
    [applyUserMove, canInteract, clearSel, game, selected]
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
      if (!canInteract) return false;
      if (!targetSquare) return false;
      if (piece.pieceType[0] !== "w") return false;
      return applyUserMove(sourceSquare, targetSquare);
    },
    [applyUserMove, canInteract, clearSel]
  );

  const resign = useCallback(() => {
    if (modal.open) return;
    setModal({
      open: true,
      title: "Oyun bitti",
      body: "Terk ettin.",
      outcome: "resign",
    });
  }, [modal.open]);

  const resetBoard = useCallback(() => {
    engineRef.current?.ucinewGame();
    game.reset();
    setFen(game.fen());
    setHistory([game.fen()]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
    clearSel();
    setAnalysisBadge(null);
    previousEvalRef.current = null;
    setModal({ open: false, title: "", body: "", outcome: null });
    setBanner(null);
    botBusyRef.current = false;
    setThinking(false);
    setWhiteClockMs(MATCH_MS);
    setBlackClockMs(MATCH_MS);
    const base = elo ?? DEFAULT_ELO;
    matchStartEloRef.current = base;
    setLiveElo(base);
  }, [clearSel, game, elo]);

  const topCrown: "win" | "loss" | null =
    (modal.outcome === "loss" || modal.outcome === "resign")
      ? "win"
      : modal.outcome === "win"
        ? "loss"
        : null;
  const bottomCrown: "win" | "loss" | null =
    modal.outcome === "win"
      ? "win"
      : (modal.outcome === "loss" || modal.outcome === "resign")
        ? "loss"
        : null;

  const persistEloAndClose = async (outcome: ModalOutcome) => {
    setModal((m) => ({ ...m, open: false }));
    const effective: GameOutcome | null =
      outcome === "resign" ? "loss" : outcome;

    if (!user || !effective || effective === "draw") {
      await refreshProfile();
      return;
    }

    const start =
      matchStartEloRef.current ?? elo ?? DEFAULT_ELO;
    const botOutcome: "win" | "loss" =
      effective === "win" ? "win" : "loss";
    const nextElo = computeEloAfterBotMatch(start, botOutcome);

    const { error } = await supabase
      .from("profiles")
      .update({ elo: nextElo, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      setBanner(
        "Elo güncellenemedi. profiles tablosu güncelleme izni veya RLS kurallarını kontrol et."
      );
      await refreshProfile();
      return;
    }

    eloAnimatingRef.current = true;
    const fromDisplay = liveElo ?? start;
    await animateEloNumber(fromDisplay, nextElo, 520, (v) => setLiveElo(v));
    eloAnimatingRef.current = false;
    setLiveElo(nextElo);
    matchStartEloRef.current = nextElo;
    await refreshProfile();
  };

  return (
    <div className="relative flex w-full max-w-[min(100vw-0.5rem,560px)] flex-col gap-1.5 text-zinc-100 sm:max-w-[min(96vw,640px)]">
      {engineReady === "loading" && (
        <p className="text-center text-xs text-white/55">Motor yükleniyor…</p>
      )}
      {engineReady === "error" && (
        <p className="rounded-md border border-red-800/80 bg-red-950/50 px-3 py-2 text-sm text-red-100">
          {engineError ?? "Motor yüklenemedi. Sayfayı yenileyip tekrar dene."}
        </p>
      )}
      {banner && engineReady === "ready" && (
        <p className="rounded-md border border-sky-800/60 bg-sky-950/35 px-3 py-2 text-sm text-sky-100">
          {banner}
        </p>
      )}

      <div className="relative flex w-full flex-col gap-1.5 sm:gap-2">
        <MatchPlayerBar
          avatarSrc="/stockfish-avatar.png"
          fallbackLetter="S"
          name="Stockfish"
          eloText="600"
          clockMs={blackClockMs}
          timerVariant="dark"
          crown={topCrown}
        />
        <div className="relative w-full overflow-hidden rounded-sm shadow-md">
          {analysisBadge && (
            <div className="absolute -right-8 top-3 z-20 hidden w-7 items-center justify-center rounded-full border border-zinc-400 bg-zinc-100 text-base font-bold text-zinc-900 shadow sm:flex">
              {analysisBadge.mark}
            </div>
          )}
          <Chessboard
            options={{
              id: "bot-board",
              position: fen,
              boardOrientation: "white",
              boardStyle: { width: "100%", maxWidth: "100%" },
              squareStyles,
              lightSquareStyle: { backgroundColor: "#ebecd0" },
              darkSquareStyle: { backgroundColor: "#739552" },
              showNotation: true,
              /** false iken bazı tarayıcılarda tıklama/sürükleme birlikte kilitlenebiliyor */
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
          fallbackLetter={displayName || "?"}
          name={displayName}
          eloText={displayEloForBar}
          clockMs={whiteClockMs}
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
            setHistoryIndex(idx);
            historyIndexRef.current = idx;
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
            setHistoryIndex(idx);
            historyIndexRef.current = idx;
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
          onClick={resign}
          disabled={modal.open || engineReady !== "ready" || game.isGameOver()}
          className="rounded-md border border-[#5a7a45] bg-[#739552] px-4 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50"
        >
          Terk et
        </button>
        <button
          type="button"
          onClick={resetBoard}
          disabled={thinking}
          className="rounded-md border border-[#5a7a45] bg-[#739552] px-4 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50"
        >
          Yeni oyun
        </button>
      </div>

      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2
              id="game-over-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {modal.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {modal.body}
            </p>
            {!user && modal.outcome && modal.outcome !== "draw" && (
              <p className="mt-2 text-xs text-zinc-500">
                Elo kaydı için giriş yapman gerekir.
              </p>
            )}
            <button
              type="button"
              className="mt-6 w-full rounded-md border border-[#5a7a45] bg-[#739552] py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              onClick={() => void persistEloAndClose(modal.outcome)}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
