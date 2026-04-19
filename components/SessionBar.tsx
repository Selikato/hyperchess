"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";

export function SessionBar() {
  const router = useRouter();
  const { user, elo, profileLoading } = useProfile();
  const shownElo = elo != null ? String(elo) : "—";

  const boardGreen =
    "border border-[#6ea349] bg-[#81b64c] font-semibold text-[#262421] transition hover:bg-[#8fc057] active:bg-[#74a843]";

  if (!user) {
    return (
      <Link
        href="/login"
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${boardGreen}`}
      >
        Giriş / Kayıt
      </Link>
    );
  }

  return (
    <div className="flex max-w-full flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <div className="flex flex-col items-end gap-0.5 text-right sm:items-end">
        <span className="max-w-[220px] truncate text-sm text-zinc-300">
          {user.email}
        </span>
        <span className="text-xs font-semibold tabular-nums text-zinc-400">
          {profileLoading ? "Elo …" : `Elo ${shownElo}`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          void supabase.auth.signOut().then(() => router.refresh());
        }}
        className={`self-end rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm ${boardGreen}`}
      >
        Çıkış
      </button>
    </div>
  );
}
