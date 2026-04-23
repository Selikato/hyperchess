"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { listTournaments } from "@/lib/arena/api";
import type { TournamentRow } from "@/lib/arena/types";

const statusLabel: Record<TournamentRow["status"], string> = {
  bekliyor: "Bekliyor",
  devam_ediyor: "Devam ediyor",
  bitti: "Bitti",
};

export function TournamentsCard() {
  const [items, setItems] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void listTournaments()
      .then((rows) => setItems(rows.slice(0, 4)))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Turnuvalar yüklenemedi.";
        setErr(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-[140px] flex-col rounded-xl border border-[#3c3b36] bg-[#2a2926] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#77a047]">
          Turnuvalar
        </p>
        <Trophy className="size-5 text-[#77a047]" />
      </div>
      {loading ? (
        <p className="text-sm text-[#9b9893]">Yükleniyor...</p>
      ) : err ? (
        <p className="text-sm text-red-300">{err}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#9b9893]">Henüz aktif turnuva yok.</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <Link
              key={t.id}
              href={`/play/online/tournaments/${t.id}`}
              className="flex items-center justify-between rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-sm hover:border-[#77a047]"
            >
              <span className="truncate text-[#e8e6e3]">{t.title}</span>
              <span className="text-xs text-[#77a047]">{statusLabel[t.status]}</span>
            </Link>
          ))}
        </div>
      )}
      <Link
        href="/play/online/tournaments"
        className="mt-3 text-sm font-semibold text-[#77a047] hover:underline"
      >
        Tümünü gör →
      </Link>
    </div>
  );
}
