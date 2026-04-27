"use client";

import { useEffect, useMemo, useState } from "react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import {
  listLeagueSettings,
  listTopPlayersForLeague,
  refreshLeagues,
} from "@/lib/arena/api";
import type { LeagueCode, LeagueSettingRow, LeagueTopPlayerRow } from "@/lib/arena/types";

const leagueOrder: LeagueCode[] = ["GM", "IM", "FM", "CM", "ACEMI"];

const leagueColors: Record<LeagueCode, string> = {
  GM: "border-yellow-300/60 bg-yellow-500/20 text-yellow-200",
  IM: "border-zinc-300/60 bg-zinc-200/20 text-zinc-100",
  FM: "border-amber-500/60 bg-amber-600/20 text-amber-200",
  CM: "border-[#77a047]/60 bg-[#77a047]/20 text-[#c9efac]",
  ACEMI: "border-slate-400/60 bg-slate-500/20 text-slate-200",
};

export default function LeaguesPage() {
  const [settings, setSettings] = useState<LeagueSettingRow[]>([]);
  const [tops, setTops] = useState<Record<LeagueCode, LeagueTopPlayerRow[]>>({
    GM: [],
    IM: [],
    FM: [],
    CM: [],
    ACEMI: [],
  });
  const [err, setErr] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      try {
        await refreshLeagues().catch(() => undefined);
        const s = await listLeagueSettings();
        setSettings(s);
        const res = await Promise.all(
          leagueOrder.map(async (l) => [l, await listTopPlayersForLeague(l)] as const)
        );
        setTops({
          GM: res.find((x) => x[0] === "GM")?.[1] ?? [],
          IM: res.find((x) => x[0] === "IM")?.[1] ?? [],
          FM: res.find((x) => x[0] === "FM")?.[1] ?? [],
          CM: res.find((x) => x[0] === "CM")?.[1] ?? [],
          ACEMI: res.find((x) => x[0] === "ACEMI")?.[1] ?? [],
        });
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Lig bilgileri alınamadı.");
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const minByLeague = (league: LeagueCode) =>
    settings.find((s) => s.league === league)?.min_elo ?? "-";

  return (
    <ArenaShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Lig Skorbordu</h1>
        <p className="mt-1 text-sm text-[#9b9893]">
          Dinamik lig barajları ve her ligdeki en iyi 4 oyuncu.
        </p>
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagueOrder.map((league) => (
            <section
              key={league}
              className="rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded border px-2 py-1 text-xs font-bold ${leagueColors[league]}`}>
                  {league}
                </span>
                <span className="text-xs font-semibold text-[#9b9893]">
                  Baraj: {minByLeague(league)}
                </span>
              </div>
              <ol className="space-y-2">
                {tops[league].length === 0 ? (
                  <li className="text-sm text-[#9b9893]">Oyuncu yok.</li>
                ) : (
                  tops[league].map((p, idx) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-[#3c3b36] bg-[#2a2926] px-3 py-2"
                    >
                      <span className="truncate text-sm text-[#e8e6e3]">
                        {idx + 1}. {p.display_name || p.full_name || p.id.slice(0, 8)}
                      </span>
                      <span className="text-xs font-semibold text-[#77a047]">{p.elo ?? "-"}</span>
                    </li>
                  ))
                )}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </ArenaShell>
  );
}
