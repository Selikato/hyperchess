"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Info } from "lucide-react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { MAESTRO_PIECES } from "@/components/arena/customPieces";
import {
  StockfishBrowserEngine,
  parseUciBestmove,
} from "@/lib/stockfish/browserEngine";
import { loadAnalysisSession } from "@/lib/analysis/session";

type MoveTag =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "interesting"
  | "dubious"
  | "mistake"
  | "blunder"
  | "missed_win";

type AnalyzedMove = {
  ply: number;
  san: string;
  mover: "w" | "b";
  playedUci: string;
  fenAfter: string;
  evalBeforeWhiteCp: number | null;
  evalAfter: number | null;
  evalAfterMate: number | null;
  bestUci: string | null;
  tag: MoveTag;
  lossCp: number;
  comment: string | null;
};

const ANALYSIS_DEPTH_PRIMARY = 20;
const ANALYSIS_DEPTH_FALLBACK = 18;
const MIN_THINK_MS = 1000;

const TAG_COLOR: Record<MoveTag, string> = {
  brilliant: "bg-sky-400",
  great: "bg-sky-500",
  best: "bg-lime-500",
  excellent: "bg-lime-400",
  good: "bg-green-300",
  book: "bg-amber-700",
  interesting: "bg-green-800",
  dubious: "bg-zinc-300",
  mistake: "bg-yellow-500",
  blunder: "bg-orange-500",
  missed_win: "bg-red-500",
};

const TAG_SYMBOL: Record<MoveTag, string> = {
  brilliant: "!!",
  great: "!",
  best: "★",
  excellent: "+",
  good: "✓",
  book: "Bk",
  interesting: "!?",
  dubious: "?!",
  mistake: "?",
  blunder: "??",
  missed_win: "X",
};

const TAG_BADGE_CLASS: Record<MoveTag, string> = {
  brilliant: "bg-cyan-500 text-white",
  great: "bg-sky-500 text-white",
  best: "bg-lime-500 text-white",
  excellent: "bg-lime-400 text-[#1b2a12]",
  good: "bg-green-300 text-[#1a2418]",
  book: "bg-amber-700 text-white",
  interesting: "bg-yellow-400 text-[#2a2615]",
  dubious: "bg-yellow-500 text-[#2a2615]",
  mistake: "bg-orange-500 text-white",
  blunder: "bg-red-500 text-white",
  missed_win: "bg-rose-500 text-white",
};

function materialNoKing(fen: string, color: "w" | "b") {
  const board = fen.split(" ")[0] ?? "";
  const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let sum = 0;
  for (const c of board) {
    const lower = c.toLowerCase();
    if (!(lower in value)) continue;
    const isWhite = c !== lower;
    if ((color === "w" && isWhite) || (color === "b" && !isWhite)) sum += value[lower];
  }
  return sum;
}

function waitMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function winProbFromCp(cpForMover: number | null) {
  if (cpForMover == null) return 0.5;
  const x = Math.max(-1000, Math.min(1000, cpForMover));
  return 1 / (1 + Math.exp(-x / 220));
}

function classifyMove(args: {
  ply: number;
  loss: number;
  isMateMove: boolean;
  bestEvalForMover: number | null;
  playedEvalForMover: number | null;
  bestUci: string | null;
  playedUci: string | null;
  top3Uci: string[];
  deepBestUci: string | null;
  fenBefore: string;
  fenAfter: string;
}): MoveTag {
  const {
    ply,
    loss,
    isMateMove,
    bestEvalForMover,
    playedEvalForMover,
    bestUci,
    playedUci,
    top3Uci,
    deepBestUci,
    fenBefore,
    fenAfter,
  } = args;
  const bestPerspective = bestEvalForMover;
  const playedPerspective = playedEvalForMover;
  const winDrop = winProbFromCp(bestPerspective) - winProbFromCp(playedPerspective);
  const turn: "w" | "b" = (fenBefore.split(" ")[1] ?? "w") === "b" ? "b" : "w";
  if (isMateMove) return "best";
  if (
    bestPerspective != null &&
    playedPerspective != null &&
    bestPerspective > 250 &&
    playedPerspective < 80
  ) {
    return "missed_win";
  }
  if (winDrop > 0.1) return "blunder";
  if (loss >= 200) return "blunder";
  if (ply <= 10 && loss <= 30) return "book";
  const sameAsBest = bestUci != null && playedUci != null && bestUci === playedUci;
  const inTop3 = playedUci != null && top3Uci.includes(playedUci);
  const matBefore = materialNoKing(fenBefore, turn);
  const matAfter = materialNoKing(fenAfter, turn);
  const sacrifice = matBefore - matAfter >= 2;
  if (!inTop3 && deepBestUci && playedUci === deepBestUci && loss <= 25) return "brilliant";
  if (sameAsBest && sacrifice && loss <= 20 && (playedPerspective ?? 0) > 50) return "brilliant";
  if (loss <= 15) return "best";
  if (loss <= 35) return "great";
  if (loss <= 65) return "excellent";
  if (loss <= 95) return "good";
  if (loss <= 79) return "dubious";
  if (loss <= 199) return "mistake";
  return "blunder";
}

function clampEval(cp: number | null) {
  if (cp == null) return 0;
  if (cp > 900) return 900;
  if (cp < -900) return -900;
  return cp;
}

function accuracyFromTags(moves: AnalyzedMove[]) {
  if (moves.length === 0) return 100;

  const tagBase: Record<MoveTag, number> = {
    brilliant: 100,
    great: 100,
    best: 100,
    excellent: 95,
    good: 80,
    book: 100,
    interesting: 50,
    dubious: 50,
    mistake: 20,
    blunder: 0,
    missed_win: 0,
  };

  // Caps benzeri: hamle kaybı arttıkça puan üstel düşer.
  // 80cp ~ %50, 200cp ~ %20 civarı.
  const cpScore = (lossCp: number) => {
    const loss = Math.max(0, Math.min(1200, lossCp));
    return 100 * Math.exp(-loss / 124);
  };

  const criticalWeight = (evalBeforeWhiteCp: number | null) => {
    const absEval = Math.abs(evalBeforeWhiteCp ?? 0);
    // Dengedeki pozisyonlarda hata daha kritik, tamamen kazançta daha az etkili.
    if (absEval <= 60) return 1.9;
    if (absEval <= 140) return 1.7;
    if (absEval <= 260) return 1.5;
    if (absEval <= 420) return 1.3;
    if (absEval <= 700) return 1.15;
    return 1.0;
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of moves) {
    const rawLoss = Number(m.lossCp);
    const loss = Number.isFinite(rawLoss) ? rawLoss : 120;
    const byCp = cpScore(loss);
    const byTag = tagBase[m.tag] ?? 50;
    // Etiket tavanı + CP kaybı birlikte değerlendirilir.
    const moveScore = Math.max(0, Math.min(100, Math.min(byTag, byCp)));
    const weight = criticalWeight(m.evalBeforeWhiteCp);
    weightedSum += moveScore * weight;
    totalWeight += weight;
  }

  if (!Number.isFinite(weightedSum) || !Number.isFinite(totalWeight) || totalWeight <= 0) {
    return 60;
  }
  return Math.round(weightedSum / totalWeight);
}

function accuracyForColor(moves: AnalyzedMove[], color: "w" | "b") {
  return accuracyFromTags(moves.filter((m) => m.mover === color));
}

function formatEval(evalCp: number | null, evalMate: number | null) {
  if (evalMate != null && Number.isFinite(evalMate)) {
    const abs = Math.abs(evalMate);
    return `#M${abs}`;
  }
  const cp = evalCp ?? 0;
  const val = cp / 100;
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}`;
}

function squareToPercent(square: string) {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]);
  if (!Number.isFinite(file) || !Number.isFinite(rank)) return null;
  return {
    left: `${(file + 0.5) * 12.5}%`,
    top: `${(8 - rank + 0.5) * 12.5}%`,
  };
}

const PIECE_TR: Record<string, string> = {
  p: "Piyon",
  n: "At",
  b: "Fil",
  r: "Kale",
  q: "Vezir",
  k: "Şah",
};

function attackedBy(game: Chess, color: "w" | "b", square: string) {
  return game
    .moves({ verbose: true })
    .filter((m) => m.color === color && m.to === square).length;
}

function getHangingPieceComment(fenAfter: string, mover: "w" | "b"): string | null {
  const g = new Chess(fenAfter);
  const enemy: "w" | "b" = mover === "w" ? "b" : "w";
  const board = g.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (!piece || piece.color !== mover || piece.type === "k") continue;
      const sq = `${"abcdefgh"[c]}${8 - r}`;
      const defenders = attackedBy(g, mover, sq);
      const attackers = attackedBy(g, enemy, sq);
      if (attackers > 0 && defenders === 0) {
        const tr = PIECE_TR[piece.type] ?? "Taş";
        return `Blunder: ${sq} karesindeki ${tr} boşta kaldı, rakip bedavadan alabilir.`;
      }
    }
  }
  return null;
}

function getMissedWinComment(
  fenBefore: string,
  fenAfter: string,
  mover: "w" | "b",
  playedUci: string
): string | null {
  const before = new Chess(fenBefore);
  const after = new Chess(fenAfter);
  const enemy: "w" | "b" = mover === "w" ? "b" : "w";
  const captureTo = playedUci.slice(2, 4);
  const board = before.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (!p || p.color !== enemy || p.type === "k") continue;
      const sq = `${"abcdefgh"[c]}${8 - r}`;
      const myAttackers = attackedBy(before, mover, sq);
      const enemyDefenders = attackedBy(before, enemy, sq);
      if (myAttackers > 0 && enemyDefenders === 0) {
        const stillThere = after.get(sq as Square);
        if (!stillThere || captureTo === sq) continue;
        const tr = PIECE_TR[p.type] ?? "Taş";
        return `Missed Win: Rakibin ${sq} karesindeki ${tr} boştaydı, büyük bir fırsat kaçtı.`;
      }
    }
  }
  return null;
}

function getMateInOneThreatComment(fenAfter: string): string | null {
  const g = new Chess(fenAfter);
  const moves = g.moves({ verbose: true });
  for (const mv of moves) {
    const t = new Chess(fenAfter);
    t.move(mv);
    if (t.isCheckmate()) {
      return "Blunder: Bu hamle rakibe tek hamlede mat (M1) imkanı veriyor!";
    }
  }
  return null;
}

function getForkComment(fenAfter: string, mover: "w" | "b"): string | null {
  const g = new Chess(fenAfter);
  const enemy: "w" | "b" = mover === "w" ? "b" : "w";
  const valuable = new Set(["q", "r", "b", "n"]);
  for (const mv of g.moves({ verbose: true })) {
    if (mv.color !== enemy) continue;
    const t = new Chess(fenAfter);
    const played = t.move(mv);
    if (!played) continue;
    const attacks = t
      .moves({ square: played.to as Square, verbose: true })
      .filter((m) => {
        const target = t.get(m.to as Square);
        return target && target.color === mover && valuable.has(target.type);
      });
    const uniq = new Set(attacks.map((a) => a.to));
    if (uniq.size >= 2) {
      return "Mistake: Rakibe çatal atma imkanı verdin.";
    }
  }
  return null;
}

function buildComment(args: {
  tag: MoveTag;
  fenBefore: string;
  fenAfter: string;
  mover: "w" | "b";
  playedUci: string;
}): string | null {
  const { tag, fenBefore, fenAfter, mover, playedUci } = args;
  const mateThreat = getMateInOneThreatComment(fenAfter);
  if (mateThreat) return mateThreat;
  if (tag === "missed_win") {
    return (
      getMissedWinComment(fenBefore, fenAfter, mover, playedUci) ??
      "Missed Win: Kazanç devamını kaçırdın, avantajı geri verdin."
    );
  }
  if (tag === "blunder") {
    return (
      getHangingPieceComment(fenAfter, mover) ??
      "Blunder: Bu hamle konumu ciddi şekilde kötüleştiriyor."
    );
  }
  if (tag === "mistake" || tag === "dubious") {
    return (
      getForkComment(fenAfter, mover) ??
      "Mistake: Rakibin taşlarına karşı savunma düzenin zayıfladı."
    );
  }
  return null;
}

export default function AnalysisPage() {
  const params = useSearchParams();
  const id = params.get("id");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Maç Analizi");
  const [fens, setFens] = useState<string[]>([]);
  const [moves, setMoves] = useState<AnalyzedMove[]>([]);
  const [selectedPly, setSelectedPly] = useState(0);
  const [blunderAlert, setBlunderAlert] = useState<string | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setErr("Analiz verisi bulunamadı.");
      setLoading(false);
      return;
    }
    const payload = loadAnalysisSession(id);
    if (!payload || !payload.fens?.length) {
      setErr("Analiz verisi bulunamadı.");
      setLoading(false);
      return;
    }
    setTitle(payload.title);
    setFens(payload.fens);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (loading || err || fens.length < 2) return;
    let cancelled = false;
    const run = async () => {
      const engine = new StockfishBrowserEngine();
      try {
        await engine.connect();
        try {
          await engine.initUci({ skillLevel: 20, limitStrength: false });
        } catch {
          // Bazı Stockfish derlemeleri bu opsiyonları desteklemeyebilir.
          // Yedek başlatma ile analizi yine çalıştır.
          await engine.initUci();
          if (!cancelled) {
            setAnalysisNotice(
              "Motor tam güç modunda açılamadı; uyumluluk modunda analiz yapılıyor."
            );
          }
        }
        const out: AnalyzedMove[] = [];
        let degradedCount = 0;
        const g = new Chess();
        if (!cancelled) {
          setProgressText(`Analiz başladı: 0/${fens.length - 1} hamle`);
        }
        for (let i = 0; i < fens.length - 1; i++) {
          if (cancelled) return;
          if (!cancelled) {
            setProgressText(`Hamle ${i + 1}/${fens.length - 1} analiz ediliyor...`);
          }
          const fenBefore = fens[i];
          const fenAfter = fens[i + 1];
          g.load(fenBefore);
          const turn = g.turn();
          const legal = g.moves({ verbose: true });
          let played = legal.find((mv) => {
            const t = new Chess(fenBefore);
            t.move(mv);
            return (t.fen().split(" ")[0] ?? "") === (fenAfter.split(" ")[0] ?? "");
          });
          if (!played) continue;
          const started = performance.now();
          let quickTop: Array<{ uci: string; evalCp: number | null }> = [];
          let deepBest: { bestmove: string; evalCp: number | null } | null = null;
          let playedEval: number | null = null;
          let playedEvalMate: number | null = null;
          try {
            quickTop = await engine.goTopMovesWithEval(
              fenBefore,
              ANALYSIS_DEPTH_FALLBACK,
              3
            );
          } catch {
            quickTop = [];
          }
          try {
            deepBest = await engine.goBestMoveWithEval(fenBefore, ANALYSIS_DEPTH_PRIMARY);
            const detailed = await engine.evaluateFenDetailed(
              fenAfter,
              ANALYSIS_DEPTH_PRIMARY
            );
            playedEval = detailed.evalCp;
            playedEvalMate = detailed.evalMate;
          } catch {
            try {
              deepBest = await engine.goBestMoveWithEval(
                fenBefore,
                ANALYSIS_DEPTH_FALLBACK
              );
              const detailed = await engine.evaluateFenDetailed(
                fenAfter,
                ANALYSIS_DEPTH_FALLBACK
              );
              playedEval = detailed.evalCp;
              playedEvalMate = detailed.evalMate;
            } catch {
              degradedCount += 1;
              deepBest = {
                bestmove: `${played.from}${played.to}${played.promotion ?? ""}`,
                evalCp: 0,
              };
              playedEval = 0;
              playedEvalMate = null;
            }
          }
          const elapsed = performance.now() - started;
          if (elapsed < MIN_THINK_MS) {
            await waitMs(MIN_THINK_MS - elapsed);
          }
          // best.evalCp: fenBefore'da oynayan taraf perspektifi
          const bestPerspective = deepBest?.evalCp ?? 0;
          const evalBeforeWhiteCp =
            deepBest?.evalCp == null ? null : turn === "w" ? deepBest.evalCp : -deepBest.evalCp;
          // playedEval: fenAfter'da sıra rakipte olduğu için perspektif ters çevrilir
          const playedPerspective = playedEval == null ? null : -playedEval;
          const loss =
            bestPerspective == null || playedPerspective == null
              ? 40
              : Math.max(0, bestPerspective - playedPerspective);
          const tag = classifyMove({
            ply: i + 1,
            loss,
            isMateMove: played.san.includes("#"),
            bestEvalForMover: bestPerspective,
            playedEvalForMover: playedPerspective,
            bestUci: deepBest?.bestmove ?? null,
            playedUci: `${played.from}${played.to}${played.promotion ?? ""}`,
            top3Uci: quickTop.map((x) => x.uci),
            deepBestUci: deepBest?.bestmove ?? null,
            fenBefore,
            fenAfter,
          });
          out.push({
            ply: i + 1,
            san: played.san,
            mover: turn,
            playedUci: `${played.from}${played.to}${played.promotion ?? ""}`,
            fenAfter,
            evalBeforeWhiteCp,
            evalAfter: playedEval,
            evalAfterMate: playedEvalMate,
            bestUci: deepBest?.bestmove ?? null,
            tag,
            lossCp: loss,
            comment: buildComment({
              tag,
              fenBefore,
              fenAfter,
              mover: turn,
              playedUci: `${played.from}${played.to}${played.promotion ?? ""}`,
            }),
          });
          if (!cancelled && (i + 1) % 4 === 0) {
            setMoves([...out]);
            setSelectedPly(out.length);
          }
        }
        if (!cancelled) {
          setMoves(out);
          setSelectedPly(out.length);
          setProgressText("Analiz tamamlandı.");
          if (degradedCount > 0) {
            setAnalysisNotice(
              `${degradedCount} hamlede motor gecikmesi yaşandı, analiz güvenli modla tamamlandı.`
            );
          } else {
            setAnalysisNotice(null);
          }
          if (out.length === 0) {
            setErr("Analiz için işlenebilir hamle bulunamadı.");
          }
        }
      } catch {
        if (!cancelled) {
          setErr("Motor yüklenemedi. Analiz için stockfish dosyalarını kontrol et.");
          setProgressText(null);
        }
      } finally {
        engine.dispose();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loading, err, fens]);

  const boardFen = useMemo(() => {
    if (fens.length === 0) return new Chess().fen();
    if (selectedPly <= 0) return fens[0];
    const idx = Math.min(selectedPly, fens.length - 1);
    return fens[idx];
  }, [fens, selectedPly]);

  const selectedMove = moves[Math.max(0, selectedPly - 1)];
  const bestArrow = useMemo(() => {
    if (!selectedMove?.bestUci) return [] as [string, string, string][];
    try {
      const parsed = parseUciBestmove(selectedMove.bestUci);
      return [[parsed.from, parsed.to, "#77a047"]] as [string, string, string][];
    } catch {
      return [] as [string, string, string][];
    }
  }, [selectedMove]);

  const evalCp = selectedMove?.evalAfter ?? 0;
  const evalPct = ((clampEval(evalCp) + 900) / 1800) * 100;
  const accuracy = accuracyFromTags(moves);
  const whiteAccuracy = accuracyForColor(moves, "w");
  const blackAccuracy = accuracyForColor(moves, "b");
  const moveBadgePos = useMemo(() => {
    if (!selectedMove?.playedUci || selectedMove.playedUci.length < 4) return null;
    return squareToPercent(selectedMove.playedUci.slice(2, 4));
  }, [selectedMove]);

  useEffect(() => {
    if (selectedMove?.tag === "blunder") {
      setBlunderAlert(`Büyük Hata: ${selectedMove.san}`);
      const id = window.setTimeout(() => setBlunderAlert(null), 1800);
      return () => window.clearTimeout(id);
    }
    return;
  }, [selectedMove]);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{title} · Analiz Odası</h1>
          <Link
            href="/play/online"
            className="rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-sm text-[#e8e6e3]"
          >
            Kapat
          </Link>
        </div>
        {loading && <p className="text-sm text-[#9b9893]">Analiz yükleniyor...</p>}
        {progressText && <p className="text-sm text-[#9b9893]">{progressText}</p>}
        {err && <p className="text-sm text-red-300">{err}</p>}
        {analysisNotice && <p className="text-sm text-amber-300">{analysisNotice}</p>}
        {!loading && !err && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-3">
              <div className="flex gap-3">
                <div className="relative h-[520px] w-5 overflow-hidden rounded bg-[#111]">
                  <div
                    className="absolute inset-x-0 bg-white transition-all"
                    style={{ top: 0, height: `${evalPct}%` }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#2b2b2b] transition-all"
                    style={{ height: `${100 - evalPct}%` }}
                  />
                </div>
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-[#3c3b36]">
                  <Chessboard
                    options={{
                      id: "analysis-board",
                      position: boardFen,
                      boardOrientation: "white",
                      boardStyle: { width: "100%", maxWidth: "100%" },
                      lightSquareStyle: { backgroundColor: "#d9dee2" },
                      darkSquareStyle: { backgroundColor: "#a4adb5" },
                      showNotation: true,
                      allowDragging: false,
                      pieces: MAESTRO_PIECES,
                      customArrows: bestArrow,
                    }}
                  />
                  {selectedMove && moveBadgePos && (
                    <div
                      className="pointer-events-none absolute z-20"
                      style={{
                        left: moveBadgePos.left,
                        top: moveBadgePos.top,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <span
                        className={`inline-flex size-7 items-center justify-center rounded-full border-2 border-white/85 text-[12px] font-extrabold shadow-lg ${TAG_BADGE_CLASS[selectedMove.tag]}`}
                      >
                        {TAG_SYMBOL[selectedMove.tag]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <aside className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-3">
              <p className="mb-2 text-sm font-semibold text-white">Hamle Kalitesi</p>
              <div className="mb-3 grid grid-cols-2 gap-1 text-[11px] text-[#c8c6c2]">
                {(
                  [
                    ["brilliant", "Brilliant"],
                    ["great", "Great Move"],
                    ["best", "Best Move"],
                    ["excellent", "Excellent"],
                    ["good", "Good"],
                    ["book", "Book"],
                    ["interesting", "Interesting"],
                    ["dubious", "Inaccuracy"],
                    ["mistake", "Mistake"],
                    ["blunder", "Blunder"],
                    ["missed_win", "Miss"],
                  ] as const
                ).map(([tag, label]) => (
                  <div key={tag} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${TAG_COLOR[tag]}`} />
                    <span className="rounded bg-[#1a1a1a] px-1 py-0.5 font-bold text-white">
                      {TAG_SYMBOL[tag]}
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="max-h-[460px] space-y-1 overflow-y-auto pr-1">
                {moves.map((m) => (
                  <div key={m.ply}>
                    <button
                      type="button"
                      onClick={() => setSelectedPly(m.ply)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${
                        selectedPly === m.ply
                          ? "bg-[#2a3421]"
                          : "bg-[#2a2926]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${TAG_COLOR[m.tag]}`} />
                        <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-white/15 bg-[#1a1a1a] px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {TAG_SYMBOL[m.tag]}
                        </span>
                        <span className={`inline-flex min-w-8 items-center justify-center rounded-full border border-white/10 bg-[#111] px-1.5 py-0.5 text-[12px] font-extrabold ${m.tag === "blunder" ? "text-orange-400" : m.tag === "mistake" ? "text-yellow-400" : m.tag === "missed_win" ? "text-red-400" : "text-zinc-100"}`}>
                          {TAG_SYMBOL[m.tag]}
                        </span>
                        <span className="text-sm text-[#e8e6e3]">
                          {m.ply}. {m.san}
                        </span>
                      </span>
                      <span className="text-xs text-[#9b9893]">
                        {formatEval(m.evalAfter, m.evalAfterMate)}
                      </span>
                    </button>
                    {m.comment && (
                      <p className="mt-0.5 rounded-md border border-white/10 bg-[#181714] px-2 py-1 text-[11px] leading-relaxed text-[#d0cec9]">
                        {m.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md border border-[#3c3b36] bg-[#2a2926] px-3 py-2">
                <p className="flex items-center gap-1 text-xs text-[#9b9893]">
                  Genel Doğruluk
                  <span
                    className="inline-flex size-4 items-center justify-center rounded-full border border-white/20 text-[#d0cec9]"
                    title="Chess.com standartlarında hesaplanmıştır"
                  >
                    <Info size={11} />
                  </span>
                </p>
                <p className="text-lg font-bold text-[#77a047]">%{accuracy}</p>
                <p className="mt-1 text-xs text-[#c9c7c2]">Beyaz: %{whiteAccuracy}</p>
                <p className="text-xs text-[#c9c7c2]">Siyah: %{blackAccuracy}</p>
              </div>
            </aside>
          </div>
        )}
        {blunderAlert && (
          <div className="fixed right-4 top-20 z-[60] rounded-md border border-orange-400/40 bg-[#2b1e12] px-3 py-2 text-sm font-semibold text-orange-200 shadow-lg">
            {blunderAlert}
          </div>
        )}
      </div>
    </ArenaShell>
  );
}

