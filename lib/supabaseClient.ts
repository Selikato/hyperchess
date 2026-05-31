"use client";

/**
 * Tarayıcı istemcisi — `@supabase/ssr` ile oturum çerezleri uyumlu.
 *
 * Vercel / üretim: Dashboard → Project Settings → Environment Variables
 * (`NEXT_PUBLIC_*`). `.env.local` yalnızca geliştirme içindir.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPublicSupabaseConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export const SUPABASE_CONFIG_ERROR =
  "Supabase anahtarları bulunamadı! NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY (veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) gerekli. Proje kökünde .env.local oluşturun; örnek için .env.example dosyasına bakın.";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
  if (!client) {
    const { url, key } = getPublicSupabaseConfig();
    client = createBrowserClient(url, key, { isSingleton: true });
  }
  return client;
}

/** İlk erişimde oluşturulur; import sırasında anahtar zorunlu değildir. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getSupabaseClient();
    const value = c[prop as keyof SupabaseClient];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(c)
      : value;
  },
});
