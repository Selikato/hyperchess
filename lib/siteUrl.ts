/**
 * Üretimde e-posta onayı ve OAuth yönlendirmeleri için kanonik kök URL.
 *
 * `getSiteUrl()`: önce `NEXT_PUBLIC_SITE_URL`, sonra tarayıcı origin / Vercel / fallback.
 * `getAuthCallbackUrl()`: `emailRedirectTo` için prod/dev dinamiği:
 * - Production: `https://hyperchess.vercel.app/auth/callback`
 * - Development: `http://localhost:3000/auth/callback`
 * Dilersen `NEXT_PUBLIC_SITE_URL` ile bu davranışı override edebilirsin.
 *
 * Supabase → Authentication → URL Configuration:
 * - Site URL: `https://hyperchess.vercel.app`
 * - Redirect URLs: `https://hyperchess.vercel.app/auth/callback` ve `http://localhost:3000/auth/callback`
 */

const PRODUCTION_SITE_FALLBACK = "https://hyperchess.vercel.app";
const DEVELOPMENT_SITE_FALLBACK = "http://localhost:3000";

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
  const base =
    process.env.NODE_ENV === "production"
      ? PRODUCTION_SITE_FALLBACK
      : DEVELOPMENT_SITE_FALLBACK;
  return `${base}/auth/callback`;
}
