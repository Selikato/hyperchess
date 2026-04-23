"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { useProfile } from "@/components/ProfileProvider";
import {
  deleteTournament,
  fetchTournament,
  joinTournament,
  listTournamentParticipants,
  maybeStartTournament,
} from "@/lib/arena/api";
import { supabase } from "@/lib/supabaseClient";
import type { TournamentParticipantRow, TournamentRow } from "@/lib/arena/types";

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const { user } = useProfile();
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [players, setPlayers] = useState<TournamentParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadAll = useMemo(
    () => async () => {
      try {
        await maybeStartTournament(tournamentId).catch(() => false);
        const [t, p] = await Promise.all([
          fetchTournament(tournamentId),
          listTournamentParticipants(tournamentId),
        ]);
        setTournament(t);
        setPlayers(p);
        setErr(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Turnuva bilgisi alınamadı.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    },
    [tournamentId]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${tournamentId}` },
        () => void loadAll()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        () => void loadAll()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, loadAll]);

  const myIn = Boolean(user && players.some((p) => p.user_id === user.id));
  const regEndsAt = tournament ? new Date(tournament.registration_ends_at).getTime() : null;
  const regClosed = regEndsAt !== null ? Date.now() >= regEndsAt : false;
  const canDelete =
    Boolean(user && tournament && tournament.created_by === user.id) ||
    Boolean(
      user &&
        tournament &&
        tournament.created_by == null &&
        players.length > 0 &&
        players[0]?.user_id === user.id
    );

  return (
    <ArenaShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/play/online/tournaments" className="text-sm text-[#77a047] hover:underline">
          ← Turnuvalar
        </Link>
        {loading ? (
          <p className="mt-4 text-sm text-[#9b9893]">Yükleniyor...</p>
        ) : err ? (
          <p className="mt-4 text-sm text-red-300">{err}</p>
        ) : !tournament ? (
          <p className="mt-4 text-sm text-red-300">Turnuva bulunamadı.</p>
        ) : (
          <>
            <div className="mt-3 rounded-xl border border-[#3c3b36] bg-[#2a2926] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-white">{tournament.title}</h1>
                  {tournament.description && (
                    <p className="mt-1 text-sm text-[#9b9893]">{tournament.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!myIn && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void joinTournament(tournament.id)
                          .then(loadAll)
                          .catch((e) => {
                            const msg =
                              e instanceof Error ? e.message : "Turnuvaya katılınamadı.";
                            setErr(msg);
                          })
                          .finally(() => setBusy(false));
                      }}
                      className="rounded-md bg-[#77a047] px-4 py-2 text-sm font-semibold text-[#262421] hover:brightness-110 disabled:opacity-50"
                    >
                      Katıl
                    </button>
                  )}
                  {tournament.status === "bekliyor" && (
                    <span className="rounded-md border border-[#77a047]/50 px-3 py-2 text-xs font-semibold text-[#77a047]">
                      {regClosed ? "Kura hazırlanıyor..." : "Kayıt açık"}
                    </span>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm("Turnuvayı silmek istediğine emin misin?")) return;
                        setBusy(true);
                        void deleteTournament(tournament.id)
                          .then(() => {
                            window.location.href = "/play/online/tournaments";
                          })
                          .catch((e) => {
                            const msg =
                              e instanceof Error ? e.message : "Turnuva silinemedi.";
                            setErr(msg);
                          })
                          .finally(() => setBusy(false));
                      }}
                      className="rounded-md border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Turnuvayı Sil
                    </button>
                  )}
                </div>
              </div>
            </div>

            {tournament.status === "bekliyor" && (
              <p className="mt-3 text-xs text-[#9b9893]">
                Kayıt bitiş:{" "}
                <span className="font-semibold text-[#77a047]">
                  {new Date(tournament.registration_ends_at).toLocaleString("tr-TR")}
                </span>
              </p>
            )}

            <div className="mt-5 rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4">
              <h2 className="mb-3 text-lg font-bold text-white">Puan Durumu</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3c3b36] text-left text-[#9b9893]">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Oyuncu</th>
                      <th className="px-2 py-2">Elo</th>
                      <th className="px-2 py-2">Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, idx) => {
                      const name = p.display_name || p.full_name || p.user_id.slice(0, 8);
                      return (
                        <tr key={p.user_id} className="border-b border-[#2f2e2b] text-[#e8e6e3]">
                          <td className="px-2 py-2">{idx + 1}</td>
                          <td className="px-2 py-2">{name}</td>
                          <td className="px-2 py-2">{p.elo ?? "—"}</td>
                          <td className="px-2 py-2 font-semibold text-[#77a047]">{p.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {tournament.bracket_json?.round1 && (
              <div className="mt-5 rounded-xl border border-[#3c3b36] bg-[#201f1b] p-4">
                <h2 className="mb-3 text-lg font-bold text-white">Turnuva Ağacı (1. Tur)</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tournament.bracket_json.round1.map((m) => {
                    const leftName =
                      players.find((p) => p.user_id === m.left)?.display_name ||
                      players.find((p) => p.user_id === m.left)?.full_name ||
                      (m.left ? m.left.slice(0, 8) : "BYE");
                    const rightName =
                      players.find((p) => p.user_id === m.right)?.display_name ||
                      players.find((p) => p.user_id === m.right)?.full_name ||
                      (m.right ? m.right.slice(0, 8) : "BYE");
                    return (
                      <div
                        key={m.slot}
                        className="rounded-lg border border-[#3c3b36] bg-[#2a2926] p-3 text-sm"
                      >
                        <p className="mb-1 text-xs text-[#77a047]">Eşleşme {m.slot}</p>
                        <p className="text-[#e8e6e3]">{leftName}</p>
                        <p className="my-1 text-xs text-[#9b9893]">vs</p>
                        <p className="text-[#e8e6e3]">{rightName}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ArenaShell>
  );
}
