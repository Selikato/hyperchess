/**
 * Üretimde e-posta onayı ve OAuth yönlendirmeleri için kanonik kök URL.
 *
 * `getSiteUrl()`: önce `NEXT_PUBLIC_SITE_URL`, sonra tarayıcı origin / Vercel / üretim fallback.
 * `getAuthCallbackUrl()`: e-posta doğrulama linki için **localhost kullanmaz** — env yoksa her zaman
 * `https://hyperchess.vercel.app/auth/callback` (yerelde kayıt olsan bile mail Vercel’e gider).
 * Yerel test için `.env.local` içinde `NEXT_PUBLIC_SITE_URL=http://localhost:3000` kullan.
 *
 * Supabase → Authentication → URL Configuration:
 * - Site URL: `https://hyperchess.vercel.app`
 * - Redirect URLs: `https://hyperchess.vercel.app/auth/callback` ve `http://localhost:3000/auth/callback`
 */

const PRODUCTION_SITE_FALLBACK = "https://hyperchess.vercel.app";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "")}`;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_FALLBACK;
  }

  return "http://localhost:3000";
}

export function getAuthCallbackUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/+$/, "")}/auth/callback`;
  return `${PRODUCTION_SITE_FALLBACK}/auth/callback`;
}
