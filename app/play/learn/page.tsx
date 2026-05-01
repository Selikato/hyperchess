"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { MAESTRO_PIECES } from "@/components/arena/customPieces";

type LessonMove = { move: string; purpose: string };
type OpeningLesson = {
  id: string;
  name: string;
  side: "white" | "black" | "both";
  kind: "opening" | "gambit";
  level: "başlangıç" | "orta" | "ileri";
  summary: string;
  plan: string;
  moves: LessonMove[];
  watchMoves: string[];
};

const LESSONS: OpeningLesson[] = [
  {
    id: "ruy-lopez",
    name: "Ruy Lopez",
    side: "white",
    kind: "opening",
    level: "başlangıç",
    summary: "Merkez kontrolü ve uzun vadeli baskı planı.",
    plan: "Beyaz e4 ile merkezi alır, Fb5 ile atı baskılar, kısa rok sonrası d4 ile alan kazanır.",
    watchMoves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"],
    moves: [
      { move: "1. e4", purpose: "Merkeze piyon koyup fil ve vezire yol açar." },
      { move: "... e5", purpose: "Siyah merkeze karşılık verir." },
      { move: "2. Af3", purpose: "e5 piyonuna baskı ve hızlı gelişim." },
      { move: "... Ac6", purpose: "e5'i savunur, merkezde yer tutar." },
      { move: "3. Fb5", purpose: "c6 atını bağlayıp e5 savunmasını zorlar." },
    ],
  },
  {
    id: "queens-gambit",
    name: "Vezir Gambiti",
    side: "white",
    kind: "gambit",
    level: "başlangıç",
    summary: "Merkezde piyon çoğunluğu için geçici piyon fedası.",
    plan: "c4 ile siyahın d5 piyonunu sorgular; piyon geri alınsa bile gelişim ve alan hedeflenir.",
    watchMoves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3"],
    moves: [
      { move: "1. d4", purpose: "Sağlam merkez ve fil yollarını açar." },
      { move: "... d5", purpose: "Merkezi dengeler." },
      { move: "2. c4", purpose: "d5 piyonuna saldırıp merkezi parçalar." },
      { move: "... e6", purpose: "Merkezi koruyup fil için hazırlık." },
      { move: "3. Ac3", purpose: "Merkez baskısını artırır." },
    ],
  },
  {
    id: "sicilian",
    name: "Sicilya Savunması",
    side: "black",
    kind: "opening",
    level: "orta",
    summary: "Asimetrik yapı ile yüksek kazanma şansı.",
    plan: "Siyah c5 ile merkezde dengesizlik yaratır; vezir kanadından aktif oyun arar.",
    watchMoves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4"],
    moves: [
      { move: "1. e4", purpose: "Beyaz merkez kurar." },
      { move: "... c5", purpose: "d4 karesine baskı ve asimetri." },
      { move: "2. Af3", purpose: "Gelişim ve d4 hazırlığı." },
      { move: "... d6", purpose: "e5 karesini destekler." },
      { move: "3. d4 cxd4", purpose: "Merkez açılır, dinamik yapı başlar." },
    ],
  },
  {
    id: "kings-gambit",
    name: "Şah Gambiti",
    side: "white",
    kind: "gambit",
    level: "ileri",
    summary: "f piyon fedasıyla hızlı şah kanadı saldırısı.",
    plan: "Beyaz merkez ve hat açılımı için piyon verir; hedef siyah şahı baskılamaktır.",
    watchMoves: ["e2e4", "e7e5", "f2f4", "e5f4", "g1f3", "g7g5"],
    moves: [
      { move: "1. e4 e5", purpose: "Açık merkez." },
      { move: "2. f4", purpose: "e5 piyonuna meydan okur, hat açar." },
      { move: "... exf4", purpose: "Siyah piyonu kabul eder." },
      { move: "3. Af3", purpose: "Şah güvenliği ve gelişim." },
      { move: "... g5", purpose: "Siyah ekstra piyonu korumaya çalışır." },
    ],
  },
  {
    id: "kings-indian",
    name: "Şah Hint Savunması",
    side: "black",
    kind: "opening",
    level: "orta",
    summary: "Siyahın esnek yapıyla merkez karşı saldırısı.",
    plan: "Siyah merkezi uzaktan kontrol eder, sonra e5 veya c5 kırışıyla oyunu açar.",
    watchMoves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"],
    moves: [
      { move: "1. d4", purpose: "Beyaz merkez kurar." },
      { move: "... Af6", purpose: "e4 karesini kontrol edip gelişir." },
      { move: "2. c4", purpose: "Alan ve merkez desteği sağlar." },
      { move: "... g6", purpose: "Fişetto hazırlığıdır." },
      { move: "3. Ac3 Fg7", purpose: "Siyah fil uzun diyagonalde baskı kurar." },
    ],
  },
];

function applyUciMove(game: Chess, uci: string) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  try {
    return Boolean(game.move({ from, to, promotion }));
  } catch {
    return false;
  }
}

const SELECTED_STYLE = {
  boxShadow: "inset 0 0 0 3px rgba(129, 182, 76, 0.95)",
  backgroundColor: "rgba(129, 182, 76, 0.12)",
};

const DOT_STYLE = {
  backgroundImage:
    "radial-gradient(circle, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.38) 20%, transparent 28%)",
};

function legalToDots(game: Chess, from: string) {
  const out: Record<string, React.CSSProperties> = {};
  try {
    const moves = game.moves({ square: from as never, verbose: true });
    for (const m of moves) {
      if (m.to) out[m.to] = DOT_STYLE;
    }
  } catch {
    return out;
  }
  return out;
}

function legalDestinations(game: Chess, from: string) {
  const s = new Set<string>();
  try {
    const moves = game.moves({ square: from as never, verbose: true });
    for (const m of moves) {
      if (m.to) s.add(m.to);
    }
  } catch {
    return s;
  }
  return s;
}

export default function LearnPage() {
  const [selectedId, setSelectedId] = useState(LESSONS[0].id);
  const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | "opening" | "gambit">("all");
  const [watching, setWatching] = useState(false);
  const [watchIndex, setWatchIndex] = useState(0);
  const [watchDone, setWatchDone] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dots, setDots] = useState<Record<string, React.CSSProperties>>({});
  const gameRef = useRef(new Chess());
  const opponentMoveTimeoutRef = useRef<number | null>(null);
  const [fen, setFen] = useState(gameRef.current.fen());

  const filtered = useMemo(
    () => LESSONS.filter((l) => (kindFilter === "all" ? true : l.kind === kindFilter)),
    [kindFilter],
  );
  const activeId = isMobile ? mobileSelectedId : selectedId;
  const active = filtered.find((l) => l.id === activeId) ?? filtered[0] ?? LESSONS[0];
  const boardOrientation = active.side === "black" ? "black" : "white";
  const userColor = active.side === "black" ? "b" : "w";
  const firstUserMoveIndex = userColor === "w" ? 0 : 1;
  const colorByIndex = (idx: number) => (idx % 2 === 0 ? "w" : "b");
  const clearOpponentTimeout = () => {
    if (opponentMoveTimeoutRef.current != null) {
      window.clearTimeout(opponentMoveTimeoutRef.current);
      opponentMoveTimeoutRef.current = null;
    }
  };
  const queueOpponentMove = (index: number) => {
    if (!practiceMode) return;
    if (index >= active.watchMoves.length) {
      setPracticeMode(false);
      return;
    }
    if (colorByIndex(index) === userColor) {
      setWatchIndex(index);
      return;
    }
    clearOpponentTimeout();
    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      const ok = applyUciMove(gameRef.current, active.watchMoves[index]);
      opponentMoveTimeoutRef.current = null;
      if (!ok) {
        setSelected(null);
        setDots({});
        setPracticeMode(false);
        return;
      }
      setFen(gameRef.current.fen());
      const next = index + 1;
      if (next >= active.watchMoves.length) {
        setWatchIndex(next);
        setPracticeMode(false);
        return;
      }
      if (colorByIndex(next) === userColor) {
        setWatchIndex(next);
      } else {
        queueOpponentMove(next);
      }
    }, 550);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setWatching(false);
    setWatchDone(false);
    setWatchIndex(firstUserMoveIndex);
    setPracticeMode(false);
    setSelected(null);
    setDots({});
    clearOpponentTimeout();
  }, [active.id, firstUserMoveIndex]);

  useEffect(() => {
    if (!watching) return;
    const tick = () => {
      setWatchIndex((prev) => {
        if (prev >= active.watchMoves.length) {
          setWatching(false);
          setWatchDone(true);
          return prev;
        }
        if (applyUciMove(gameRef.current, active.watchMoves[prev])) setFen(gameRef.current.fen());
        const next = prev + 1;
        if (next >= active.watchMoves.length) {
          setWatching(false);
          setWatchDone(true);
          setPracticeMode(true);
          gameRef.current = new Chess();
          if (userColor === "b") {
            applyUciMove(gameRef.current, active.watchMoves[0]);
            setFen(gameRef.current.fen());
            return 1;
          } else {
            setFen(gameRef.current.fen());
            return 0;
          }
        }
        return next;
      });
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => window.clearInterval(id);
  }, [watching, active]);

  const onDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (watching || !sourceSquare || !targetSquare) return false;
    if (sourceSquare === targetSquare) return false;
    try {
      if (practiceMode) {
        if (gameRef.current.turn() !== userColor) return false;
        const expected = active.watchMoves[watchIndex];
        const played = `${sourceSquare}${targetSquare}`;
        if (played !== expected) return false;
      }
      const moved = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!moved) return false;
      setSelected(null);
      setDots({});
      setFen(gameRef.current.fen());
      if (practiceMode) {
        const next = watchIndex + 1;
        if (next >= active.watchMoves.length) {
          setWatchIndex(next);
          setPracticeMode(false);
        } else {
          queueOpponentMove(next);
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const squareStyles = useMemo(() => {
    const base = { ...dots };
    if (selected) base[selected] = { ...(base[selected] ?? {}), ...SELECTED_STYLE };
    return base;
  }, [dots, selected]);

  const onSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    if (watching) return;
    if (practiceMode && gameRef.current.turn() !== userColor) return;

    if (selected) {
      const legal = legalDestinations(gameRef.current, selected);
      if (legal.has(square)) {
        onDrop({ sourceSquare: selected, targetSquare: square, piece: piece ?? { pieceType: "" } } as PieceDropHandlerArgs);
        return;
      }
    }

    if (!piece) {
      setSelected(null);
      setDots({});
      return;
    }
    if (practiceMode && piece.pieceType[0] !== userColor) return;
    if (selected === square) {
      setSelected(null);
      setDots({});
      return;
    }
    setSelected(square);
    setDots(legalToDots(gameRef.current, square));
  };

  const onPieceClick = ({ square, piece, isSparePiece }: PieceHandlerArgs) => {
    if (!square || isSparePiece || !piece) return;
    onSquareClick({ square, piece } as SquareHandlerArgs);
  };

  const startWatch = () => {
    clearOpponentTimeout();
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setWatchDone(false);
    setWatchIndex(0);
    setPracticeMode(false);
    setWatching(true);
  };

  const stopWatch = () => {
    clearOpponentTimeout();
    setWatching(false);
  };

  const resetLesson = () => {
    clearOpponentTimeout();
    setWatching(false);
    setWatchDone(false);
    setWatchIndex(firstUserMoveIndex);
    setPracticeMode(false);
    gameRef.current = new Chess();
    if (userColor === "b") {
      applyUciMove(gameRef.current, active.watchMoves[0]);
      setWatchIndex(1);
    }
    setFen(gameRef.current.fen());
  };

  return (
    <ArenaShell>
      {isMobile && !mobileSelectedId ? (
        <div className="min-h-[calc(100dvh-5.5rem)] px-4 py-4">
          <div className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-3">
            <h1 className="text-xl font-bold text-white">Öğren: Açılışlar ve Gambitler</h1>
            <p className="mt-1 text-xs text-[#9b9893]">
              Bir açılış seç, sonra izleme ve deneme tahtasına geç.
            </p>
            <div className="mt-3 flex gap-2">
              {[{ id: "all", label: "Hepsi" }, { id: "opening", label: "Açılış" }, { id: "gambit", label: "Gambit" }].map((f) => (
                <button key={f.id} type="button" onClick={() => setKindFilter(f.id as "all" | "opening" | "gambit")} className={`rounded-md border px-2 py-1 text-xs font-semibold ${kindFilter === f.id ? "border-[#81b64c] bg-[#81b64c]/20 text-[#c9efac]" : "border-[#3c3b36] bg-[#2a2926] text-[#9b9893]"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {filtered.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(lesson.id);
                    setMobileSelectedId(lesson.id);
                  }}
                  className="w-full rounded-lg border border-[#3c3b36] bg-[#2a2926] p-3 text-left active:bg-[#32312d]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-semibold text-white">{lesson.name}</span>
                    <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] uppercase text-[#d8d6d2]">{lesson.level}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#9b9893]">{lesson.summary}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div className="mx-auto w-full max-w-[1250px] px-0 py-3 sm:px-4 lg:px-6">
        <section className={`rounded-xl border border-[#3c3b36] bg-[#1b1a17] p-3 ${isMobile ? "px-0 pb-4 pt-3" : "p-4"}`}>
          {isMobile && (
            <div className="mb-2 px-4">
              <button
                type="button"
                onClick={() => setMobileSelectedId(null)}
                className="rounded-md border border-[#3c3b36] bg-[#2a2926] px-3 py-1.5 text-xs font-semibold text-[#e8e6e3]"
              >
                Açılış listesine dön
              </button>
            </div>
          )}
          <div className="mb-3 hidden items-center justify-between gap-2 px-1 lg:flex">
            <div className="flex gap-2">
              {[{ id: "all", label: "Hepsi" }, { id: "opening", label: "Açılış" }, { id: "gambit", label: "Gambit" }].map((f) => (
                <button key={f.id} type="button" onClick={() => setKindFilter(f.id as "all" | "opening" | "gambit")} className={`rounded-md border px-2 py-1 text-xs font-semibold ${kindFilter === f.id ? "border-[#81b64c] bg-[#81b64c]/20 text-[#c9efac]" : "border-[#3c3b36] bg-[#2a2926] text-[#9b9893]"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={active.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-[#3c3b36] bg-[#2a2926] px-2 py-1 text-xs text-[#e8e6e3]"
            >
              {filtered.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div
              className={`${isMobile ? "learn-mobile-board mx-auto w-full max-w-full overflow-hidden rounded-md border border-[#3c3b36] box-border" : "overflow-hidden rounded-md border border-[#3c3b36]"}`}
              style={
                isMobile
                  ? {
                      width: "min(calc(100vw - 12px), calc(100dvh - 240px))",
                      maxWidth: "calc(100vw - 12px)",
                    }
                  : {
                      width: "min(100%, calc(100dvh - 140px))",
                      maxWidth: "100%",
                    }
              }
            >
              <div>
                <Chessboard options={{ id: "learn-board", position: fen, boardOrientation, boardStyle: { width: "100%", maxWidth: "100%" }, squareStyles, lightSquareStyle: { backgroundColor: "#d9dee2" }, darkSquareStyle: { backgroundColor: "#a4adb5" }, showNotation: true, allowDragging: !watching, pieces: MAESTRO_PIECES, onSquareClick, onPieceClick, onPieceDrop: onDrop }} />
              </div>
            </div>
            <aside className={`rounded-lg border border-[#2f2e2a] bg-gradient-to-b from-[#22211d] to-[#1a1916] p-3 ${isMobile ? "mx-4" : ""}`}>
              <h2 className="text-lg font-bold text-white">Learn The {active.name}</h2>
              <div className="mt-3 rounded-md border border-white/10 bg-[#f2f2f1] px-3 py-2 text-sm text-[#1a1a1a]">
                {active.plan}
              </div>
              <button
                type="button"
                onClick={startWatch}
                className="mt-3 w-full rounded-md border border-[#6f9f43] bg-[#81b64c] px-3 py-2 text-sm font-bold text-[#1a2312] hover:brightness-105"
              >
                Başla
              </button>
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-[#3c3b36] bg-[#22211d] px-3 py-2 text-sm font-semibold text-[#c7c4be]"
              >
                Açıklayıcı Video
              </button>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={stopWatch} className="flex-1 rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-1.5 text-xs font-semibold text-[#e8e6e3]">Durdur</button>
                <button type="button" onClick={resetLesson} className="flex-1 rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-1.5 text-xs font-semibold text-[#e8e6e3]">Sıfırla</button>
              </div>
              <p className="mt-2 text-xs text-[#9b9893]">İzlenen hamle: {watchIndex}/{active.watchMoves.length}</p>
              {watchDone && <p className="mt-2 rounded border border-[#81b64c]/50 bg-[#81b64c]/10 px-2 py-1 text-xs text-[#c9efac]">İzleme tamamlandı. Şimdi aynı hamleleri tahtada sen uygula.</p>}
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-[#77a047]">Hamleler ve amacı</h3>
              <ol className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                {active.moves.map((item, idx) => (
                  <li key={`${active.id}-${idx}`} className="rounded-md border border-[#3c3b36] bg-[#2a2926] px-2 py-1.5">
                    <p className="text-xs font-semibold text-white">{item.move}</p>
                    <p className="mt-0.5 text-[11px] text-[#c7c4be]">{item.purpose}</p>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>
      </div>
      )}
      <style jsx global>{`
        .learn-mobile-board .react-chessboard text,
        .learn-mobile-board .react-chessboard .coordinate,
        .learn-mobile-board .react-chessboard [class*="notation"],
        .learn-mobile-board .react-chessboard [class*="coordinate"] {
          font-size: 4.5px !important;
          font-weight: 600 !important;
          opacity: 0.8 !important;
        }
      `}</style>
    </ArenaShell>
  );
}
