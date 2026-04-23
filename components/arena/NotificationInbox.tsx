"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { listUnreadNotifications, markNotificationRead } from "@/lib/arena/api";
import type { NotificationRow } from "@/lib/arena/types";
import { supabase } from "@/lib/supabaseClient";

export function NotificationInbox() {
  const { user } = useProfile();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void listUnreadNotifications(user.id).then(setItems).catch(() => undefined);
    const channel = supabase
      .channel(`notifications-inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (!row?.id || row.read_at) return;
          setItems((prev) => [row, ...prev]);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const count = items.length;
  const topItems = useMemo(() => items.slice(0, 15), [items]);

  if (!user) return null;

  return (
    <div className="fixed right-3 top-3 z-[220]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-[#3c3b36] bg-[#201f1b] p-2 text-[#e8e6e3] hover:bg-[#2a2926]"
        aria-label="Bildirim kutusu"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#77a047] px-1.5 text-[10px] font-bold text-[#262421]">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-[min(92vw,360px)] rounded-xl border border-[#3c3b36] bg-[#1b1a17] p-3 shadow-2xl">
          <p className="mb-2 text-sm font-semibold text-white">Bildirimler</p>
          {topItems.length === 0 ? (
            <p className="text-xs text-[#9b9893]">Yeni bildirim yok.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto">
              {topItems.map((n) => {
                const title =
                  n.type === "tournament_created"
                    ? `${n.payload?.creator_name ?? "Bir oyuncu"} yeni turnuva oluşturdu`
                    : n.type === "match_invite"
                      ? "Maç daveti aldın"
                      : "Arkadaşlık isteği";
                const actionHref =
                  n.type === "tournament_created" && n.payload?.tournament_id
                    ? `/play/online/tournaments/${n.payload.tournament_id}`
                    : n.type === "match_invite" && n.payload?.match_id
                      ? `/play/online/${n.payload.match_id}`
                      : "/play/online";
                return (
                  <div key={n.id} className="rounded-md border border-[#3c3b36] bg-[#262421] p-2">
                    <p className="text-xs text-[#e8e6e3]">{title}</p>
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={actionHref}
                        onClick={() => {
                          void markNotificationRead(n.id).catch(() => undefined);
                          setItems((prev) => prev.filter((x) => x.id !== n.id));
                        }}
                        className="rounded bg-[#77a047] px-2.5 py-1 text-[11px] font-semibold text-[#262421]"
                      >
                        Aç
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          void markNotificationRead(n.id).catch(() => undefined);
                          setItems((prev) => prev.filter((x) => x.id !== n.id));
                        }}
                        className="rounded border border-[#55524e] px-2.5 py-1 text-[11px] text-[#e8e6e3]"
                      >
                        Okundu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
