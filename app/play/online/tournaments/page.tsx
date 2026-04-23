"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ArenaShell } from "@/components/arena/ArenaShell";
import { useProfile } from "@/components/ProfileProvider";
import { createTournament, deleteTournament, listTournaments } from "@/lib/arena/api";
import type { TournamentRow } from "@/lib/arena/types";

const statusLabel: Record<TournamentRow["status"], string> = {
  bekliyor: "Bekliyor",
  devam_ediyor: "Devam ediyor",
  bitti: "Bitti",
};

export default function TournamentsPage() {
  const { user } = useProfile();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [deleteModeId, setDeleteModeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    void listTournaments()
      .then((data) => setRows(data))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Turnuva listesi alınamadı.";
        setErr(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ArenaShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Turnuvalar</h1>
        <p className="mt-1 text-sm text-[#9b9893]">Arena turnuvaları ve puan tabloları.</p>
        <form
          className="mt-4 rounded-xl border border-[#3c3b36] bg-[#2a2926] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length < 3) {
              setErr("Turnuva adı en az 3 karakter olmalı.");
              return;
            }
            setCreateBusy(true);
            void createTournament(title.trim(), description.trim())
              .then(() => listTournaments().then((data) => setRows(data)))
              .then(() => {
                setTitle("");
                setDescription("");
                setErr(null);
              })
              .catch((e2) => {
                const msg = e2 instanceof Error ? e2.message : "Turnuva oluşturulamadı.";
                setErr(msg);
              })
              .finally(() => setCreateBusy(false));
          }}
        >
          <p className="mb-3 text-sm font-semibold text-[#77a047]">Turnuva Oluştur</p>
          <div className="grid gap-2 sm:grid-cols-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Turnuva adı"
              className="rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-sm text-white outline-none focus:border-[#77a047]"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama (opsiyonel)"
            className="mt-2 min-h-20 w-full rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-sm text-white outline-none focus:border-[#77a047]"
          />
          <button
            type="submit"
            disabled={createBusy}
            className="mt-3 rounded-md bg-[#77a047] px-4 py-2 text-sm font-semibold text-[#262421] hover:brightness-110 disabled:opacity-50"
          >
            {createBusy ? "Oluşturuluyor..." : "Turnuva Oluştur"}
          </button>
        </form>
        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm text-[#9b9893]">Yükleniyor...</p>
          ) : err ? (
            <p className="text-sm text-red-300">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#9b9893]">Şu an turnuva bulunmuyor.</p>
          ) : (
            rows.map((t) => {
              const canDelete = Boolean(user && t.created_by === user.id);
              const showDelete = deleteModeId === t.id && canDelete;
              return (
                <div
                  key={t.id}
                  onContextMenu={(e) => {
                    if (!canDelete) return;
                    e.preventDefault();
                    setDeleteModeId((prev) => (prev === t.id ? null : t.id));
                  }}
                  onTouchStart={() => {
                    if (!canDelete) return;
                    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                    longPressTimer.current = window.setTimeout(() => {
                      setDeleteModeId((prev) => (prev === t.id ? null : t.id));
                    }, 520);
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                  }}
                  onTouchCancel={() => {
                    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                  }}
                  className="relative"
                >
                  <Link
                    href={`/play/online/tournaments/${t.id}`}
                    className="block rounded-xl border border-[#3c3b36] bg-[#2a2926] p-4 transition hover:border-[#77a047]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{t.title}</p>
                      <span className="rounded-md bg-[#77a047]/20 px-2 py-1 text-xs font-semibold text-[#77a047]">
                        {statusLabel[t.status]}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-2 text-sm text-[#9b9893]">{t.description}</p>
                    )}
                  </Link>
                  {showDelete && (
                    <button
                      type="button"
                      disabled={deleteBusyId === t.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteBusyId(t.id);
                        void deleteTournament(t.id)
                          .then(() => listTournaments().then((data) => setRows(data)))
                          .then(() => {
                            setDeleteModeId(null);
                            setErr(null);
                          })
                          .catch((e2) => {
                            const msg =
                              e2 instanceof Error ? e2.message : "Turnuva silinemedi.";
                            setErr(msg);
                          })
                          .finally(() => setDeleteBusyId(null));
                      }}
                      className="absolute right-2 top-2 rounded-md border border-red-400/50 bg-[#1f1c1c] p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      title="Turnuvayı sil"
                      aria-label="Turnuvayı sil"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </ArenaShell>
  );
}
