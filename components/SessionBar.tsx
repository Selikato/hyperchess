"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";

export function SessionBar() {
  const router = useRouter();
  const { user, elo, profileLoading } = useProfile();
  const shownElo = elo === 1200 ? "?" : (elo ?? "—");

  const boardGreen =
    "border border-[#5a7a45] bg-[#739552] text-white transition hover:brightness-110 active:brightness-95";

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
