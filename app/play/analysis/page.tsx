"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import type { Move, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { BookOpen, CircleHelp, Info, Star, ThumbsUp, X } from "lucide-react";
import { AdUnit } from "@/components/ads/AdUnit";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { placementReady } from "@/lib/ads/config";
import { MAESTRO_PIECES } from "@/components/arena/customPieces";
import {
  StockfishBrowserEngine,
  parseUciBestmove,
} from "@/lib/stockfish/browserEngine";
import { loadAnalysisSession } from "@/lib/analysis/session";
import { requestLichessCloudEval, type PositionEval } from "@/lib/lichess/cloudEval";
import { enemyNetGainIfCapture, findWorstTacticalThreat } from "@/lib/chess/hanging";
import {
  effectiveCentipawnLoss,
  formatMaterialGain,
  materialGainedByMover,
  materialLostByMover,
  materialPointsToCp,
  pieceLabelTr,
  pieceValue,
  sideMaterialFromFen,
} from "@/lib/chess/material";

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
  /** Hamlede kaybedilen materyal (piyon=1 … vezir=9). */
  materialLost: number;
  comment: string | null;
};

const ANALYSIS_DEPTH_FAST = 13;
const ANALYSIS_MULTIPV = 3;
/** Lichess: tek seferde bir istek; tokensız hesapta ~15–20/dk limit olabilir */
const LICHESS_REQUEST_GAP_MS = 450;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type EvalSnapshot = {
  bestUci: string | null;
  evalCp: number | null;
  evalMate: number | null;
  topMoves: Array<{ uci: string; evalCp: number | null; evalMate: number | null }>;
};

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
  brilliant: "bg-[#29d3df] text-white",
  great: "bg-[#7fa8d1] text-white",
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

const TAG_BADGE_RING: Record<MoveTag, string> = {
  brilliant: "border-[#b8f0f4]",
  great: "border-[#bfd3e8]",
  best: "border-[#d2f7ab]",
  excellent: "border-[#d4f0a8]",
  good: "border-[#d0e9c8]",
  book: "border-[#e3c9a8]",
  interesting: "border-[#f1da8a]",
  dubious: "border-[#f1da8a]",
  mistake: "border-[#ffd29a]",
  blunder: "border-[#ffc2c2]",
  missed_win: "border-[#ffd0d0]",
};

function TagBadgeIcon({ tag }: { tag: MoveTag }) {
  if (tag === "excellent") return <ThumbsUp className="size-4" />;
  if (tag === "best") return <Star className="size-4" />;
  if (tag === "book") return <BookOpen className="size-4" />;
  if (tag === "dubious" || tag === "interesting") return <CircleHelp className="size-4" />;
  if (tag === "missed_win") return <X className="size-4" />;
  if (tag === "great") return <span className="text-[13px] font-black leading-none">!</span>;
  if (tag === "brilliant") return <span className="text-[12px] font-black leading-none">!!</span>;
  return <span className="text-[13px] font-black leading-none">{TAG_SYMBOL[tag]}</span>;
}

function winProbFromCp(cpForMover: number | null) {
  if (cpForMover == null) return 0.5;
  const x = Math.max(-1000, Math.min(1000, cpForMover));
  return 1 / (1 + Math.exp(-x / 220));
}

function fenTurnIsWhite(fen: string) {
  return (fen.split(" ")[1] ?? "w") === "w";
}

function upgradeTagForMaterial(
  tag: MoveTag,
  materialLost: number,
  fenAfter: string,
  mover: "w" | "b"
): MoveTag {
  const threat = findWorstTacticalThreat(fenAfter, mover, TACTICAL_COMMENT_MIN_GAIN);
  if (materialLost >= 9 || (threat?.enemyNetGain ?? 0) >= 9) return "blunder";
  if (materialLost >= 5 || (threat?.enemyNetGain ?? 0) >= 5) {
    if (
      tag === "best" ||
      tag === "great" ||
      tag === "excellent" ||
      tag === "good" ||
      tag === "book" ||
      tag === "interesting"
    ) {
      return "mistake";
    }
    if (tag === "dubious") return "blunder";
  }
  if (materialLost >= 3 || (threat?.enemyNetGain ?? 0) >= 3) {
    if (tag === "best" || tag === "great" || tag === "excellent" || tag === "good" || tag === "book") {
      return "dubious";
    }
  }
  return tag;
}

function classifyMove(args: {
  ply: number;
  loss: number;
  materialLost: number;
  materialGained: number;
  isMateMove: boolean;
  san: string;
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
    materialLost,
    materialGained,
    isMateMove,
    san,
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
  const effectiveLoss = effectiveCentipawnLoss(loss, materialLost);

  if (isMateMove) return "best";

  if (materialLost >= 9 && effectiveLoss >= 80) return "blunder";
  if (materialLost >= 5 && effectiveLoss >= 120) return "blunder";

  if (
    bestPerspective != null &&
    playedPerspective != null &&
    bestPerspective > 250 &&
    playedPerspective < 80
  ) {
    return "missed_win";
  }
  if (winDrop > 0.1 && effectiveLoss >= 80) return "blunder";
  if (effectiveLoss >= 200) return "blunder";

  const openingLikeSan = !/[x+#=]/.test(san);
  const playedInTop3 = playedUci != null && top3Uci.includes(playedUci);
  if (ply <= 10 && effectiveLoss <= 25 && openingLikeSan && playedInTop3 && materialLost === 0) {
    return "book";
  }

  const sameAsBest = bestUci != null && playedUci != null && bestUci === playedUci;
  const inTop3 = playedInTop3;
  const matBefore = sideMaterialFromFen(fenBefore, turn);
  const matAfter = sideMaterialFromFen(fenAfter, turn);
  const sacrifice = matBefore - matAfter >= 2 && materialGained < materialLost;

  if (!inTop3 && deepBestUci && playedUci === deepBestUci && effectiveLoss <= 25 && sacrifice) {
    return "brilliant";
  }
  if (sameAsBest && sacrifice && effectiveLoss <= 20 && (playedPerspective ?? 0) > 50) {
    return "brilliant";
  }

  let tag: MoveTag;
  if (effectiveLoss <= 15) tag = "best";
  else if (effectiveLoss <= 35) tag = "great";
  else if (effectiveLoss <= 65) tag = "excellent";
  else if (effectiveLoss <= 95) tag = "good";
  else if (effectiveLoss <= 120) tag = "dubious";
  else if (effectiveLoss <= 199) tag = "mistake";
  else tag = "blunder";

  return upgradeTagForMaterial(tag, materialLost, fenAfter, turn);
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
    const matCp = materialPointsToCp(m.materialLost ?? 0);
    const loss = Number.isFinite(rawLoss) ? Math.max(rawLoss, matCp) : Math.max(120, matCp);
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
    left: `${(file + 1) * 12.5}%`,
    top: `${(8 - rank) * 12.5}%`,
  };
}

const TACTICAL_COMMENT_MIN_GAIN = 2;

function getHangingPieceComment(fenAfter: string, mover: "w" | "b"): string | null {
  const threat = findWorstTacticalThreat(fenAfter, mover, TACTICAL_COMMENT_MIN_GAIN);
  if (!threat || threat.enemyNetGain < TACTICAL_COMMENT_MIN_GAIN) return null;
  const label = pieceLabelTr(threat.pieceType);
  if (!threat.defended) {
    return `Blunder: ${threat.square} karesindeki ${label} (${formatMaterialGain(threat.value)} puan) korumasız — rakip bedavadan alabilir.`;
  }
  return `Blunder: ${threat.square} karesindeki ${label} alınırsa rakip net ${formatMaterialGain(threat.enemyNetGain)} kazanır.`;
}

function getMissedWinComment(
  fenBefore: string,
  fenAfter: string,
  mover: "w" | "b",
  playedUci: string
): string | null {
  const enemy: "w" | "b" = mover === "w" ? "b" : "w";
  const captureTo = playedUci.slice(2, 4);
  const after = new Chess(fenAfter);
  const board = new Chess(fenBefore).board();
  let best: { square: string; pieceType: string; enemyNetGain: number } | null = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (!p || p.color !== enemy || p.type === "k") continue;
      const sq = `${"abcdefgh"[c]}${8 - r}`;
      const stillThere = after.get(sq as Square);
      if (!stillThere || captureTo === sq) continue;

      const gain = enemyNetGainIfCapture(fenBefore, sq, enemy);
      if (gain == null || gain < 1) continue;

      if (!best || gain > best.enemyNetGain || (gain === best.enemyNetGain && pieceValue(p.type) > pieceValue(best.pieceType))) {
        best = { square: sq, pieceType: p.type, enemyNetGain: gain };
      }
    }
  }
  if (!best) return null;
  const label = pieceLabelTr(best.pieceType);
  return `Missed Win: Rakibin ${best.square} karesindeki ${label} alınabilirdi (net ${formatMaterialGain(best.enemyNetGain)}).`;
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

function getBadExchangeComment(
  materialLost: number,
  materialGained: number,
  captured: string | null | undefined
): string | null {
  const net = materialGained - materialLost;
  if (materialLost <= 0) return null;
  if (net < 0) {
    return `Kötü alışveriş: net ${formatMaterialGain(net)} materyal (taş puanlarına göre).`;
  }
  if (captured && materialLost > pieceValue(captured)) {
    const label = pieceLabelTr(captured);
    return `Daha değerli taş verildi: ${label} alındı ama ${formatMaterialGain(-materialLost)} kayıp oluştu.`;
  }
  if (materialLost >= 3) {
    return `Bu hamlede yaklaşık ${formatMaterialGain(-materialLost)} materyal kaybı var.`;
  }
  return null;
}

function buildComment(args: {
  tag: MoveTag;
  fenBefore: string;
  fenAfter: string;
  mover: "w" | "b";
  playedUci: string;
  materialLost: number;
  materialGained: number;
  captured: string | null | undefined;
}): string | null {
  const { tag, fenBefore, fenAfter, mover, playedUci, materialLost, materialGained, captured } =
    args;
  const mateThreat = getMateInOneThreatComment(fenAfter);
  if (mateThreat) return mateThreat;

  const exchange = getBadExchangeComment(materialLost, materialGained, captured);

  if (tag === "missed_win") {
    return (
      getMissedWinComment(fenBefore, fenAfter, mover, playedUci) ??
      exchange ??
      "Missed Win: Kazanç devamını kaçırdın, avantajı geri verdin."
    );
  }
  if (tag === "blunder") {
    return (
      getHangingPieceComment(fenAfter, mover) ??
      getForkComment(fenAfter, mover) ??
      exchange ??
      "Blunder: Motor değerlendirmesine göre konum belirgin şekilde kötüleşti."
    );
  }
  if (tag === "mistake" || tag === "dubious") {
    return (
      getForkComment(fenAfter, mover) ??
      getHangingPieceComment(fenAfter, mover) ??
      exchange ??
      null
    );
  }
  if (exchange) return exchange;
  return null;
}

function AnalysisPageInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Maç Analizi");
  const [fens, setFens] = useState<string[]>([]);
  const [ucis, setUcis] = useState<string[]>([]);
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
    setUcis(payload.ucis ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (loading || err || fens.length < 2) return;
    let cancelled = false;
    const run = async () => {
      const engine = new StockfishBrowserEngine();
      let engineReady = false;
      const ensureStockfish = async () => {
        if (engineReady) return;
        await engine.connect();
        try {
          await engine.initUci({ skillLevel: 20, limitStrength: false });
        } catch {
          await engine.initUci();
          if (!cancelled) {
            setAnalysisNotice(
              "Yerel motor tam güç modunda açılamadı; uyumluluk modunda yedek analiz kullanılıyor."
            );
          }
        }
        engineReady = true;
      };

      try {
        const out: AnalyzedMove[] = [];
        const evals: EvalSnapshot[] = [];
        let degradedCount = 0;
        let lichessHits = 0;
        let lichessMiss = 0;
        let lichessRateLimited = 0;
        let stockfishHits = 0;
        let lichessStoppedByLimit = false;
        const cloudCache = new Map<string, PositionEval | null>();
        const g = new Chess();
        if (!cancelled) {
          setProgressText(`Pozisyonlar analiz ediliyor: 0/${fens.length}`);
        }
        for (let i = 0; i < fens.length; i++) {
          if (cancelled) return;
          if (!cancelled) {
            setProgressText(
              `Pozisyon ${i + 1}/${fens.length} · Lichess ${lichessHits} · yerel ${stockfishHits}...`
            );
          }

          let filled = false;
          const fenKey = fens[i];

          if (!lichessStoppedByLimit) {
            let cloudEval: PositionEval | null | undefined = cloudCache.get(fenKey);
            if (cloudEval === undefined) {
              const result = await requestLichessCloudEval(fenKey, ANALYSIS_MULTIPV, {
                retry429: i < 12,
              });
              if (result.status === "ok") {
                cloudEval = result.eval;
                lichessHits += 1;
              } else if (result.status === "miss") {
                cloudEval = null;
                lichessMiss += 1;
              } else if (result.status === "rate_limited") {
                lichessRateLimited += 1;
                lichessStoppedByLimit = true;
                cloudEval = null;
                if (!cancelled) {
                  setAnalysisNotice(
                    "Lichess istek limiti doldu; kalan pozisyonlar yerel Stockfish ile hesaplanıyor. " +
                      "Daha fazla bulut analizi için .env.local içine LICHESS_API_TOKEN ekleyin."
                  );
                }
              } else {
                cloudEval = null;
              }
              cloudCache.set(fenKey, cloudEval);
            }

            if (cloudEval) {
              evals[i] = {
                bestUci: cloudEval.bestUci,
                evalCp: cloudEval.evalCp,
                evalMate: cloudEval.evalMate,
                topMoves: cloudEval.topMoves,
              };
              filled = true;
            }
          }

          if (!filled) {
            try {
              await ensureStockfish();
              const topMoves = await engine.goTopMovesWithEval(
                fens[i],
                ANALYSIS_DEPTH_FAST,
                ANALYSIS_MULTIPV
              );
              const best = topMoves[0];
              evals[i] = {
                bestUci: best?.uci ?? null,
                evalCp: best?.evalCp ?? null,
                evalMate: best?.evalMate ?? null,
                topMoves,
              };
              stockfishHits += 1;
            } catch {
              degradedCount += 1;
              evals[i] = {
                bestUci: null,
                evalCp: 0,
                evalMate: null,
                topMoves: [],
              };
            }
          }

          if (i < fens.length - 1) await sleep(LICHESS_REQUEST_GAP_MS);
        }

        if (!cancelled) {
          const parts: string[] = [];
          if (lichessHits > 0) {
            parts.push(
              `Lichess bulutu: ${lichessHits}/${fens.length} pozisyon (derin önceden hesaplanmış)`
            );
          }
          if (lichessMiss > 0) {
            parts.push(
              `${lichessMiss} pozisyon Lichess veritabanında yoktu (özel orta oyun — normal)`
            );
          }
          if (stockfishHits > 0) {
            parts.push(`${stockfishHits} pozisyon yerel Stockfish ile`);
          }
          if (lichessRateLimited > 0) {
            parts.push("istek limiti nedeniyle bulut erken kesildi");
          }
          if (parts.length > 0) {
            setAnalysisNotice((prev) => {
              if (prev?.includes("istek limiti")) return prev;
              return parts.join(" · ") + ".";
            });
          }
        }
        for (let i = 0; i < fens.length - 1; i++) {
          if (cancelled) return;
          if (!cancelled) {
            setProgressText(`Hamle ${i + 1}/${fens.length - 1} sınıflandırılıyor...`);
          }
          const fenBefore = fens[i];
          const fenAfter = fens[i + 1];
          const boardBefore = new Chess(fenBefore);
          const turn = boardBefore.turn();
          const uci = ucis[i];
          let played: Move | null = null;
          if (uci && uci.length >= 4) {
            try {
              played = boardBefore.move({
                from: uci.slice(0, 2) as Square,
                to: uci.slice(2, 4) as Square,
                promotion: uci[4] as "q" | "r" | "b" | "n" | undefined,
              });
            } catch {
              played = null;
            }
          }
          if (!played) {
            const legal = boardBefore.moves({ verbose: true });
            played =
              legal.find((mv) => {
                const t = new Chess(fenBefore);
                t.move(mv);
                return (t.fen().split(" ")[0] ?? "") === (fenAfter.split(" ")[0] ?? "");
              }) ?? null;
          }
          if (!played) continue;
          g.load(fenBefore);
          g.move(played);
          const beforeEval = evals[i];
          const afterEval = evals[i + 1];
          // best.evalCp: fenBefore'da oynayan taraf perspektifi
          const bestPerspective = beforeEval?.evalCp ?? 0;
          const evalBeforeWhiteCp =
            beforeEval?.evalCp == null ? null : turn === "w" ? beforeEval.evalCp : -beforeEval.evalCp;
          // playedEval: fenAfter'da sıra rakipte olduğu için perspektif ters çevrilir
          const playedPerspective = afterEval?.evalCp == null ? null : -afterEval.evalCp;
          const playedEvalWhiteCp =
            afterEval?.evalCp == null ? null : fenTurnIsWhite(fenAfter) ? afterEval.evalCp : -afterEval.evalCp;
          const engineLoss =
            bestPerspective == null || playedPerspective == null
              ? 40
              : Math.max(0, bestPerspective - playedPerspective);
          const materialLost = materialLostByMover(fenBefore, fenAfter, turn);
          const materialGained = materialGainedByMover(fenBefore, fenAfter, turn);
          const effectiveLoss = effectiveCentipawnLoss(engineLoss, materialLost);
          const tag = classifyMove({
            ply: i + 1,
            loss: engineLoss,
            materialLost,
            materialGained,
            isMateMove: played.san.includes("#"),
            san: played.san,
            bestEvalForMover: bestPerspective,
            playedEvalForMover: playedPerspective,
            bestUci: beforeEval?.bestUci ?? null,
            playedUci: `${played.from}${played.to}${played.promotion ?? ""}`,
            top3Uci: beforeEval?.topMoves.map((x) => x.uci) ?? [],
            deepBestUci: beforeEval?.bestUci ?? null,
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
            evalAfter: playedEvalWhiteCp,
            evalAfterMate: afterEval?.evalMate ?? null,
            bestUci: beforeEval?.bestUci ?? null,
            tag,
            lossCp: effectiveLoss,
            materialLost,
            comment: buildComment({
              tag,
              fenBefore,
              fenAfter,
              mover: turn,
              playedUci: `${played.from}${played.to}${played.promotion ?? ""}`,
              materialLost,
              materialGained,
              captured: played.captured,
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
            setAnalysisNotice((prev) =>
              prev
                ? `${prev} ${degradedCount} pozisyonda yerel motor da başarısız oldu.`
                : `${degradedCount} pozisyonda motor gecikmesi yaşandı, analiz kısmen tamamlandı.`
            );
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
        if (engineReady) engine.dispose();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loading, err, fens, ucis]);

  const boardFen = useMemo(() => {
    if (fens.length === 0) return new Chess().fen();
    if (selectedPly <= 0) return fens[0];
    const idx = Math.min(selectedPly, fens.length - 1);
    return fens[idx];
  }, [fens, selectedPly]);

  const selectedMove = moves[Math.max(0, selectedPly - 1)];
  const bestArrow = useMemo(() => {
    if (!selectedMove?.bestUci) return [] as Array<{
      startSquare: string;
      endSquare: string;
      color: string;
    }>;
    try {
      const parsed = parseUciBestmove(selectedMove.bestUci);
      return [
        {
          startSquare: parsed.from,
          endSquare: parsed.to,
          color: "#77a047",
        },
      ];
    } catch {
      return [] as Array<{
        startSquare: string;
        endSquare: string;
        color: string;
      }>;
    }
  }, [selectedMove]);

  const evalCp = selectedMove?.evalAfter ?? 0;
  const evalPct = ((clampEval(evalCp) + 900) / 1800) * 100;
  const accuracy = accuracyFromTags(moves);
  const whiteAccuracy = accuracyForColor(moves, "w");
  const blackAccuracy = accuracyForColor(moves, "b");
  const moveBadgePos = useMemo(() => {
    if (!selectedMove) return null;
    const fenAtPly = fens[selectedPly];
    if (fenAtPly) {
      const threat = findWorstTacticalThreat(
        fenAtPly,
        selectedMove.mover,
        TACTICAL_COMMENT_MIN_GAIN
      );
      if (
        threat &&
        (selectedMove.tag === "blunder" || selectedMove.tag === "mistake") &&
        selectedMove.comment?.includes(threat.square)
      ) {
        return squareToPercent(threat.square);
      }
    }
    if (!selectedMove.playedUci || selectedMove.playedUci.length < 4) return null;
    return squareToPercent(selectedMove.playedUci.slice(2, 4));
  }, [selectedMove, fens, selectedPly]);

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
              <div className="flex items-stretch gap-2 sm:gap-3">
                <div className="relative w-4 shrink-0 overflow-hidden rounded bg-[#111] sm:w-5">
                  <div
                    className="absolute inset-x-0 bg-white transition-all"
                    style={{ top: 0, height: `${evalPct}%` }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#2b2b2b] transition-all"
                    style={{ height: `${100 - evalPct}%` }}
                  />
                </div>
                <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-md border border-[#3c3b36]">
                  <Chessboard
                    options={{
                      id: "analysis-board",
                      position: boardFen,
                      boardOrientation: "white",
                      boardStyle: { width: "100%", height: "100%", maxWidth: "100%" },
                      lightSquareStyle: { backgroundColor: "#d9dee2" },
                      darkSquareStyle: { backgroundColor: "#a4adb5" },
                      showNotation: true,
                      allowDragging: false,
                      pieces: MAESTRO_PIECES,
                      arrows: bestArrow,
                    }}
                  />
                  {selectedMove && moveBadgePos && (
                    <div
                      className="pointer-events-none absolute z-20"
                      style={{
                        left: moveBadgePos.left,
                        top: moveBadgePos.top,
                        transform: "translate(-58%, -42%)",
                      }}
                    >
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-[0_1px_4px_rgba(0,0,0,0.35)] ${TAG_BADGE_CLASS[selectedMove.tag]} ${TAG_BADGE_RING[selectedMove.tag]}`}
                      >
                        <TagBadgeIcon tag={selectedMove.tag} />
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
              {placementReady("analysis") && (
                <div className="mt-3">
                  <AdUnit placement="analysis" format="rectangle" minHeight={250} />
                </div>
              )}
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

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <ArenaShell>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <p className="text-sm text-[#9b9893]">Analiz yükleniyor...</p>
          </div>
        </ArenaShell>
      }
    >
      <AnalysisPageInner />
    </Suspense>
  );
}

