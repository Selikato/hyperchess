"use client";

import { useEffect } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSupabaseClient } from "@/lib/supabaseClient";

/** E-posta onayı / hash ile gelen oturumu URL’den yakalar (detectSessionInUrl ile birlikte) */
export function SupabaseSessionListener() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();
    void supabase.auth.getSession().catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes("invalid refresh token") || msg.includes("refresh token not found")) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
    });
  }, []);
  return null;
}
