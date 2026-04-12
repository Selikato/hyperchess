"use client";

/**
 * Tarayıcı istemcisi — `@supabase/ssr` ile oturum çerezleri uyumlu.
 *
 * Vercel / üretim: Dashboard → Project Settings → Environment Variables
 * (`NEXT_PUBLIC_*`). `.env.local` yalnızca geliştirme içindir.
 */
import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

const { url, key } = getPublicSupabaseConfig();

if (!url || !key) {
  throw new Error(
    "Supabase anahtarları bulunamadı! NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY (veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) gerekli."
  );
}

export const supabase = createBrowserClient(url, key, { isSingleton: true });
