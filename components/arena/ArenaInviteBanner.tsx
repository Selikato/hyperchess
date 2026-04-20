"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import {
  declinePrivateInvite,
  fetchProfileDisplayName,
  listUnreadMatchInvites,
  markNotificationRead,
} from "@/lib/arena/api";
import { supabase } from "@/lib/supabaseClient";
import type { NotificationRow } from "@/lib/arena/types";

export function ArenaInviteBanner() {
  const { user } = useProfile();
  const router = useRouter();
  const [invites, setInvites] = useState<NotificationRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const top = useMemo(() => invites[0] ?? null, [invites]);

  const refreshInvites = useCallback(async () => {
    if (!user) return;
    const rows = await listUnreadMatchInvites(user.id);
    setInvites(rows);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshInvites();

    const channel = supabase
      .channel(`notifications-invite:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (row?.type !== "match_invite" || row.read_at) return;
          setInvites((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row, ...prev].sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refreshInvites]);

  useEffect(() => {
    const fromId = top?.payload?.from_user_id;
    if (!fromId || names[fromId]) return;
    void fetchProfileDisplayName(fromId).then((label) => {
      setNames((m) => ({
        ...m,
        [fromId]: label?.trim() || "Bir oyuncu",
      }));
    });
  }, [top, names]);

  const dismissTop = useCallback(() => {
    setInvites((prev) => prev.slice(1));
  }, []);

  const onAccept = useCallback(async () => {
    if (!top) return;
    const matchId = top.payload?.match_id;
    if (!matchId) return;
    setBusy(true);
    try {
      await markNotificationRead(top.id);
      dismissTop();
      router.push(`/play/online/${matchId}`);
    } finally {
      setBusy(false);
    }
  }, [top, router, dismissTop]);

  const onDecline = useCallback(async () => {
    if (!top) return;
    const matchId = top.payload?.match_id;
    if (!matchId) return;
    setBusy(true);
    try {
      await declinePrivateInvite(matchId);
      await markNotificationRead(top.id);
      dismissTop();
    } catch {
      await markNotificationRead(top.id);
      dismissTop();
    } finally {
      setBusy(false);
    }
  }, [top, dismissTop]);

  if (!user || !top) return null;

  const fromId = top.payload?.from_user_id;
  const label =
    (fromId && names[fromId]) || (fromId ? "Bir oyuncu" : "Bir oyuncu");

  return (
    <>
      <div className="h-[52px] shrink-0" aria-hidden />
      <div
        className="fixed inset-x-0 top-0 z-[200] flex items-center justify-between gap-3 border-b border-zinc-600 bg-zinc-900 px-3 py-2.5 shadow-lg sm:px-4"
        role="alert"
      >
        <p className="min-w-0 flex-1 text-sm font-medium text-white">
          <span className="text-[#81b64c]">{label}</span> sana meydan okudu
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            aria-label="Kabul et"
            className="flex size-10 items-center justify-center rounded-full border border-[#5a7a45] bg-[#739552] text-white transition hover:brightness-110 disabled:opacity-50"
            onClick={() => void onAccept()}
          >
            <Check className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            disabled={busy}
            aria-label="Reddet"
            className="flex size-10 items-center justify-center rounded-full border border-zinc-500 bg-zinc-800 text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50"
            onClick={() => void onDecline()}
          >
            <X className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
