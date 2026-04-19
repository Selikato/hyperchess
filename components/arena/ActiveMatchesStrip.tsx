"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useProfile } from "@/components/ProfileProvider";
import {
  listActiveMatchesForUser,
  type ActiveMatchSummary,
} from "@/lib/arena/api";
import { arena } from "@/components/arena/ArenaShell";

export function ActiveMatchesStrip() {
  const { user } = useProfile();
  const [rows, setRows] = useState<ActiveMatchSummary[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listActiveMatchesForUser(user.id);
      setRows(list);
    } catch {
      setRows([]);
    }
  }, [user]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  if (!user || rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-white">Oyunlarınız</h2>
      <ul className="space-y-2">
        {rows.map((m) => {
          const waiting = m.status === "waiting";
          const opp =
            m.white_player_id === user.id ? m.black_player_id : m.white_player_id;
          const label =
            waiting && !opp
              ? "Rakip bekleniyor"
              : waiting
                ? "Davet / beklemede"
                : "Devam ediyor";
          return (
            <li key={m.id}>
              <Link
                href={`/play/online/${m.id}`}
                className={`flex items-center gap-3 rounded-lg border ${arena.border} ${arena.panel} p-3 transition hover:ring-1 hover:ring-white/10`}
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded border border-white/10 bg-[#262421] text-2xl">
                  ♟
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {label}
                  </p>
                  <p className="truncate text-xs text-[#9b9893]">
                    {waiting ? "Hızlı maç veya davet" : "Hamle sırası sende olabilir"}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-[#9b9893]" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
