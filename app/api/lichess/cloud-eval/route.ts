import { NextResponse } from "next/server";
import type { LichessCloudEvalResponse } from "@/lib/lichess/cloudEval";
import { checkRateLimit, clientIpFromRequest } from "@/lib/api/rateLimit";
import { isLikelyValidFen } from "@/lib/chess/fen";
import { createSupabaseServer } from "@/lib/supabase/server";

const LICHESS_CLOUD_EVAL = "https://lichess.org/api/cloud-eval";

/** Tarayıcıdan Lichess'e doğrudan istek yerine sunucu proxy (token + rate limit). */
export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit(`lichess-eval:${ip}`, 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çok fazla istek — lütfen biraz bekleyin" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      }
    );
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Analiz için giriş gerekli" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fen = searchParams.get("fen");
  if (!fen?.trim()) {
    return NextResponse.json({ error: "fen gerekli" }, { status: 400 });
  }
  if (!isLikelyValidFen(fen)) {
    return NextResponse.json({ error: "Geçersiz FEN" }, { status: 400 });
  }

  const multiPv = Math.min(5, Math.max(1, Number(searchParams.get("multiPv") ?? "3") || 3));
  const variant = searchParams.get("variant");

  const url = new URL(LICHESS_CLOUD_EVAL);
  url.searchParams.set("fen", fen.trim());
  url.searchParams.set("multiPv", String(multiPv));
  if (variant) url.searchParams.set("variant", variant);

  const headers: HeadersInit = { Accept: "application/json" };
  const token = process.env.LICHESS_API_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 0 },
    });
  } catch {
    return NextResponse.json({ error: "Lichess API'ye ulaşılamadı" }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json(
      { error: "No cloud evaluation available for that position" },
      { status: 404 }
    );
  }

  if (res.status === 429) {
    return NextResponse.json(
      { error: "Lichess rate limit — bir dakika sonra tekrar dene" },
      { status: 429 }
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: text || `Lichess HTTP ${res.status}` },
      { status: 502 }
    );
  }

  const data = (await res.json()) as LichessCloudEvalResponse;
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=86400",
    },
  });
}
