/** Lichess GET /api/cloud-eval — https://lichess.org/api#tag/Analysis */

export type LichessCloudEvalPv = {
  cp?: number;
  mate?: number;
  moves: string;
};

export type LichessCloudEvalResponse = {
  fen: string;
  depth: number;
  knodes: number;
  pvs: LichessCloudEvalPv[];
};

export type PositionEval = {
  bestUci: string | null;
  /** Oynayan taraf perspektifinde centipawn */
  evalCp: number | null;
  evalMate: number | null;
  depth: number;
  topMoves: Array<{ uci: string; evalCp: number | null; evalMate: number | null }>;
  source: "lichess" | "stockfish";
};

export type CloudEvalResult =
  | { status: "ok"; eval: PositionEval }
  | { status: "miss" }
  | { status: "rate_limited" }
  | { status: "error"; message: string };

function sideToMove(fen: string): "w" | "b" {
  return (fen.trim().split(/\s+/)[1] ?? "w") === "b" ? "b" : "w";
}

/** Lichess skorları beyaz perspektifindedir; FEN sırasına göre çevirir. */
export function lichessEvalToPositionEval(
  data: LichessCloudEvalResponse,
  fen: string
): PositionEval {
  const stm = sideToMove(fen);
  const flip = stm === "b";

  const topMoves = data.pvs.map((pv) => {
    const firstUci = pv.moves.trim().split(/\s+/)[0] ?? "";
    const cpWhite = pv.cp ?? null;
    const mateWhite = pv.mate ?? null;
    return {
      uci: firstUci,
      evalCp: cpWhite == null ? null : flip ? -cpWhite : cpWhite,
      evalMate: mateWhite == null ? null : flip ? -mateWhite : mateWhite,
    };
  });

  const best = topMoves[0];
  return {
    bestUci: best?.uci ?? null,
    evalCp: best?.evalCp ?? null,
    evalMate: best?.evalMate ?? null,
    depth: data.depth,
    topMoves,
    source: "lichess",
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tek istek; 429 için kısa bekleme ile bir kez daha dener. */
export async function requestLichessCloudEval(
  fen: string,
  multiPv = 3,
  options?: { retry429?: boolean }
): Promise<CloudEvalResult> {
  const url = new URL("/api/lichess/cloud-eval", window.location.origin);
  url.searchParams.set("fen", fen);
  url.searchParams.set("multiPv", String(Math.min(5, Math.max(1, multiPv))));

  const attempt = async (): Promise<CloudEvalResult> => {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (res.status === 404) return { status: "miss" };
    if (res.status === 429) return { status: "rate_limited" };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "error", message: body || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as LichessCloudEvalResponse;
    return { status: "ok", eval: lichessEvalToPositionEval(data, fen) };
  };

  const first = await attempt();
  if (first.status !== "rate_limited" || !options?.retry429) return first;

  await sleep(65_000);
  return attempt();
}

/** @deprecated requestLichessCloudEval kullan */
export async function fetchLichessCloudEval(
  fen: string,
  multiPv = 3
): Promise<PositionEval | null> {
  const result = await requestLichessCloudEval(fen, multiPv, { retry429: true });
  return result.status === "ok" ? result.eval : null;
}
