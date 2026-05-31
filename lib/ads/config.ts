/** Google AdSense yayıncı kimliği (ör. ca-pub-1234567890123456) */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() ?? "";

export function adsEnabled(): boolean {
  return ADSENSE_CLIENT_ID.length > 0 && ADSENSE_CLIENT_ID.startsWith("ca-pub-");
}

/** ads.txt için sayısal pub kimliği (ca-pub- öneki olmadan) */
export function adsensePublisherId(): string | null {
  if (!adsEnabled()) return null;
  return ADSENSE_CLIENT_ID.replace(/^ca-pub-/i, "");
}

export type AdPlacementId =
  | "sidebar"
  | "lobby_banner"
  | "analysis"
  | "puzzles";

const SLOT_ENV: Record<AdPlacementId, string> = {
  sidebar: "NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR",
  lobby_banner: "NEXT_PUBLIC_ADSENSE_SLOT_LOBBY",
  analysis: "NEXT_PUBLIC_ADSENSE_SLOT_ANALYSIS",
  puzzles: "NEXT_PUBLIC_ADSENSE_SLOT_PUZZLES",
};

export function getAdSlot(placement: AdPlacementId): string | null {
  const key = SLOT_ENV[placement];
  const raw = process.env[key]?.trim();
  return raw && /^\d+$/.test(raw) ? raw : null;
}

export function placementReady(placement: AdPlacementId): boolean {
  return adsEnabled() && getAdSlot(placement) != null;
}

/** Aktif çevrimiçi maç sayfasında reklam gösterme */
export function isActiveOnlineMatchPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const m = pathname.match(/^\/play\/online\/([^/]+)$/);
  if (!m) return false;
  const slug = m[1];
  return slug !== "leagues" && slug !== "tournaments";
}
