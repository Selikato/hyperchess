"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export function SessionBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-md bg-[#81b64c] px-4 py-2 text-sm font-semibold text-[#262421] transition hover:brightness-110"
      >
        Giriş / Kayıt
      </Link>
    );
  }

  return (
    <div className="flex max-w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <span className="truncate text-right text-sm text-zinc-600 dark:text-zinc-400">
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => {
          void supabase.auth.signOut().then(() => router.refresh());
        }}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        Çıkış
      </button>
    </div>
  );
}
