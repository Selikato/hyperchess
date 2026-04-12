"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

/** E-posta onayı / hash ile gelen oturumu URL’den yakalar (detectSessionInUrl ile birlikte) */
export function SupabaseSessionListener() {
  useEffect(() => {
    void supabase.auth.getSession();
  }, []);
  return null;
}
