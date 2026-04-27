"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useProfile } from "@/components/ProfileProvider";
import {
  fetchProfileDisplayName,
  listActiveMatchesForUser,
  type ActiveMatchSummary,
} from "@/lib/arena/api";
import { arena } from "@/components/arena/ArenaShell";

export function ActiveMatchesStrip() {
  const { user } = useProfile();
  const [rows, setRows] = useState<ActiveMatchSummary[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const ids = rows
      .flatMap((m) => [m.white_player_id, m.black_player_id])
      .filter((id): id is string => Boolean(id))
      .filter((id) => id !== user?.id);
    const missing = [...new Set(ids)].filter((id) => !names[id]);
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (id) => ({
        id,
        name: (await fetchProfileDisplayName(id)) ?? id.slice(0, 8),
      }))
    ).then((list) => {
      setNames((prev) => {
        const next = { ...prev };
        for (const x of list) next[x.id] = x.name;
        return next;
      });
    });
  }, [rows, user?.id, names]);

  if (!user || rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-white">Oyunlarınız</h2>
      <ul className="space-y-2">
        {rows.map((m) => {
          const waiting = m.status === "waiting";
          const finished = m.status === "finished" || m.winner_id !== null;
          const opp =
            m.white_player_id === user.id ? m.black_player_id : m.white_player_id;
          const myName =
            (user.user_metadata?.display_name as string | undefined)?.trim() ||
            (user.user_metadata?.full_name as string | undefined)?.trim() ||
            user.email?.split("@")[0] ||
            "Oyuncu";
          const oppName = opp ? (names[opp] ?? opp.slice(0, 8)) : "stockfish";
          const resultMark =
            !finished
              ? ""
              : m.winner_id == null
                ? "="
                : m.winner_id === user.id
                  ? "+"
                  : "-";
          const label =
            finished
              ? `${myName}-${oppName} ${resultMark}`
              : waiting && !opp
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
                    {finished
                      ? "Tamamlanan maç"
                      : waiting
                        ? "Hızlı maç veya davet"
                        : "Hamle sırası sende olabilir"}
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
