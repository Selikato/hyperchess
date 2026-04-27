const STOCKFISH_JS = "/stockfish/stockfish-18-lite-single.js";

function workerUrl(): string {
  if (typeof window !== "undefined") {
    return new URL(STOCKFISH_JS, window.location.origin).href;
  }
  return STOCKFISH_JS;
}

/** Worker tek postMessage ile çok satır gönderebiliyor; aksi halde uciok hiç eşleşmez. */
function splitWorkerPayload(data: unknown): string[] {
  if (typeof data === "string") {
    return data.split(/\r?\n/);
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data).split(/\r?\n/);
  }
  return String(data ?? "").split(/\r?\n/);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = globalThis.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        globalThis.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        globalThis.clearTimeout(id);
        reject(e);
      }
    );
  });
}

type LineWaiter = {
  resolve: (s: string) => void;
  reject: (e: Error) => void;
};

type ScoreInfo = { cp: number | null; mate: number | null };

export class StockfishBrowserEngine {
  private worker: Worker | null = null;
  private readonly buffer: string[] = [];
  private readonly waiters: LineWaiter[] = [];
  private disposed = false;

  private rejectWaiters(message: string) {
    const err = new Error(message);
    for (const w of this.waiters.splice(0)) {
      w.reject(err);
    }
  }

  private flushLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    const next = this.waiters.shift();
    if (next) next.resolve(trimmed);
    else this.buffer.push(trimmed);
  }

  private readLine(): Promise<string> {
    if (this.buffer.length > 0) {
      return Promise.resolve(this.buffer.shift()!);
    }
    if (this.disposed) {
      return Promise.reject(new Error("Motor kapatıldı."));
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  private send(cmd: string) {
    if (!this.worker || this.disposed) return;
    this.worker.postMessage(cmd);
  }

  async connect(): Promise<void> {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      throw new Error("Stockfish yalnızca tarayıcıda çalışır.");
    }
    this.disposed = false;
    this.worker = new Worker(workerUrl(), { type: "classic" });
    this.worker.onmessage = (ev: MessageEvent<unknown>) => {
      for (const line of splitWorkerPayload(ev.data)) {
        this.flushLine(line);
      }
    };
    this.worker.onmessageerror = () => {
      this.rejectWaiters("Motor mesajı işlenemedi.");
    };
    this.worker.onerror = () => {
      this.rejectWaiters(
        "Stockfish Worker yüklenemedi. Sayfayı yenileyip tekrar dene."
      );
    };
    /** Worker betiği + WASM eşzamanlı parse; hemen uci bazen kaybolabiliyor. */
    await new Promise((r) => globalThis.setTimeout(r, 150));
  }

  async initUci(options?: {
    skillLevel?: number;
    limitStrength?: boolean;
    uciElo?: number;
  }): Promise<void> {
    if (!this.worker) throw new Error("Worker yok.");

    const lineTimeoutMs = 60_000;

    this.send("uci");
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        lineTimeoutMs,
        "Motor uci yanıtı zaman aşımı. /stockfish/*.wasm dosyaları ve ağı kontrol et."
      );
      if (line === "uciok") break;
    }

    const skillLevel = options?.skillLevel ?? 20;
    const limitStrength = options?.limitStrength ?? false;
    const uciElo = options?.uciElo ?? 3000;
    this.send(`setoption name Skill Level value ${skillLevel}`);
    this.send(`setoption name UCI_LimitStrength value ${limitStrength ? "true" : "false"}`);
    if (limitStrength) {
      this.send(`setoption name UCI_Elo value ${uciElo}`);
    }
    this.send("isready");
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        lineTimeoutMs,
        "Motor isready zaman aşımı."
      );
      if (line === "readyok") break;
    }
  }

  /** Yeni oyun / FEN sıfırlama — arama tablosunu temizler. */
  ucinewGame() {
    if (this.worker && !this.disposed) this.send("ucinewgame");
  }

  async goBestMoveWithEval(
    fen: string,
    depth: number
  ): Promise<{ bestmove: string; evalCp: number | null; evalMate?: number | null }> {
    if (this.disposed) throw new Error("Motor kapatıldı.");
    this.send("ucinewgame");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    let last: ScoreInfo = { cp: null, mate: null };
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        60_000,
        "Motor hamle araması zaman aşımı."
      );
      const score = parseScore(line);
      if (score.cp !== null || score.mate !== null) {
        last = score;
      }
      if (line.startsWith("bestmove")) {
        const m = /^bestmove (\S+)/.exec(line);
        const move = m?.[1];
        if (!move || move === "(none)") {
          throw new Error("Motor geçerli hamle üretemedi.");
        }
        return { bestmove: move, evalCp: last.cp, evalMate: last.mate };
      }
    }
  }

  async goTopMovesWithEval(
    fen: string,
    depth: number,
    multiPv = 3
  ): Promise<Array<{ uci: string; evalCp: number | null }>> {
    if (this.disposed) throw new Error("Motor kapatıldı.");
    this.send(`setoption name MultiPV value ${Math.max(1, multiPv)}`);
    this.send("ucinewgame");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    const byPv = new Map<number, { uci: string; evalCp: number | null }>();
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        60_000,
        "Motor çoklu analiz zaman aşımı."
      );
      const pvMatch = /\bmultipv (\d+)\b/.exec(line);
      const score = parseScore(line);
      const pvMove = /\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
      if (pvMatch && pvMove) {
        const idx = Number(pvMatch[1]);
        const prev = byPv.get(idx);
        byPv.set(idx, {
          uci: pvMove[1],
          evalCp: score.cp ?? prev?.evalCp ?? null,
        });
      }
      if (line.startsWith("bestmove")) {
        this.send("setoption name MultiPV value 1");
        const rows = [...byPv.entries()]
          .sort((a, b) => a[0] - b[0])
          .map((x) => x[1]);
        return rows;
      }
    }
  }

  async evaluateFen(fen: string, depth: number): Promise<number | null> {
    if (this.disposed) throw new Error("Motor kapatıldı.");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    let last: ScoreInfo = { cp: null, mate: null };
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        60_000,
        "Motor analiz zaman aşımı."
      );
      const score = parseScore(line);
      if (score.cp !== null || score.mate !== null) {
        last = score;
      }
      if (line.startsWith("bestmove")) {
        return last.cp ?? (last.mate == null ? null : (last.mate > 0 ? 10_000 : -10_000));
      }
    }
  }

  async evaluateFenDetailed(
    fen: string,
    depth: number
  ): Promise<{ evalCp: number | null; evalMate: number | null }> {
    if (this.disposed) throw new Error("Motor kapatıldı.");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    let last: ScoreInfo = { cp: null, mate: null };
    for (;;) {
      const line = await withTimeout(
        this.readLine(),
        60_000,
        "Motor analiz zaman aşımı."
      );
      const score = parseScore(line);
      if (score.cp !== null || score.mate !== null) {
        last = score;
      }
      if (line.startsWith("bestmove")) {
        return { evalCp: last.cp, evalMate: last.mate };
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.rejectWaiters("Motor kapatıldı.");
    try {
      this.worker?.postMessage("quit");
    } catch {
      /* yoksay */
    }
    try {
      this.worker?.terminate();
    } catch {
      /* yoksay */
    }
    this.worker = null;
  }
}

function parseScore(line: string): ScoreInfo {
  const cp = /\bscore cp (-?\d+)/.exec(line);
  if (cp) return { cp: Number(cp[1]), mate: null };
  const mate = /\bscore mate (-?\d+)/.exec(line);
  if (!mate) return { cp: null, mate: null };
  const m = Number(mate[1]);
  if (!Number.isFinite(m) || m === 0) return { cp: null, mate: null };
  return { cp: m > 0 ? 10_000 : -10_000, mate: m };
}

export function parseUciBestmove(uci: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  const u = uci.trim();
  if (u.length < 4) throw new Error("Geçersiz UCI hamlesi.");
  return {
    from: u.slice(0, 2),
    to: u.slice(2, 4),
    promotion: u.length >= 5 ? u.slice(4, 5).toLowerCase() : undefined,
  };
}
