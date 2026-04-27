"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";

export function SessionBar() {
  const router = useRouter();
  const { user, elo, title, profileLoading } = useProfile();
  const shownElo = elo != null ? String(elo) : "—";
  const titleColor =
    title === "GM"
      ? "border-yellow-300/60 bg-yellow-500/20 text-yellow-200"
      : title === "IM"
        ? "border-zinc-300/60 bg-zinc-200/20 text-zinc-100"
        : title === "FM"
          ? "border-amber-500/60 bg-amber-600/20 text-amber-200"
          : title === "CM"
            ? "border-[#77a047]/60 bg-[#77a047]/20 text-[#c9efac]"
            : "border-slate-400/60 bg-slate-500/20 text-slate-200";

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
          {title ? (
            <span className="inline-flex items-center gap-1">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${titleColor}`}>
                {title}
              </span>
              {user.email}
            </span>
          ) : (
            user.email
          )}
        </span>
        <span className="text-xs font-semibold tabular-nums text-zinc-400">
          {profileLoading ? "Elo …" : `Elo ${shownElo}`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          void supabase.auth.signOut().then(() => {
            router.push("/login");
            router.refresh();
          });
        }}
        className={`self-end rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm ${boardGreen}`}
      >
        Çıkış
      </button>
    </div>
  );
}
