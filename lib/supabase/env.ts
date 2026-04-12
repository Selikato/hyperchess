/**
 * Tarayıcı ve sunucu için ortak Supabase public env okuma.
 * Önce anon JWT, yoksa publishable key (Dashboard API bölümünden).
 */
export function getPublicSupabaseConfig(): { url: string; key: string } {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const url = rawUrl.replace(/\/+$/, "");
  const key =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  return { url, key };
}
