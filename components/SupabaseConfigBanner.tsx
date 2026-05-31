"use client";

import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Geliştirmede eksik .env.local için üst uyarı */
export function SupabaseConfigBanner() {
  if (process.env.NODE_ENV !== "development" || isSupabaseConfigured()) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-500/50 bg-amber-950 px-4 py-2 text-center text-sm text-amber-100"
      role="status"
    >
      Supabase yapılandırılmadı — giriş ve çevrimiçi oyun çalışmaz.{" "}
      <code className="rounded bg-black/30 px-1">cp .env.example .env.local</code>{" "}
      yapıp Supabase API anahtarlarını ekleyin, ardından dev sunucusunu yeniden
      başlatın.
    </div>
  );
}
