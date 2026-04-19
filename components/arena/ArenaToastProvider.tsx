"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";
import type { NotificationRow } from "@/lib/arena/types";
import { markNotificationRead } from "@/lib/arena/api";

type ToastItem = {
  key: string;
  notification: NotificationRow;
};

export function ArenaToastProvider({ children }: { children: React.ReactNode }) {
  const { user } = useProfile();
  const router = useRouter();
  const [queue, setQueue] = useState<ToastItem[]>([]);

  const dismiss = useCallback((key: string, n: NotificationRow, goMatch?: string) => {
    setQueue((q) => q.filter((t) => t.key !== key));
    void markNotificationRead(n.id).catch(() => undefined);
    if (goMatch) {
      router.push(`/play/online/${goMatch}`);
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
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
          if (!row?.id) return;
          setQueue((q) => [
            ...q,
            { key: row.id, notification: row },
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[min(100vw-2rem,360px)] flex-col gap-2"
        aria-live="polite"
      >
        {queue.map(({ key, notification: n }) => {
          const matchId = n.payload?.match_id as string | undefined;
          const title =
            n.type === "friend_request"
              ? "Arkadaşlık isteği"
              : "Maç daveti";
          const body =
            n.type === "friend_request"
              ? "Bir oyuncu seni arkadaş olarak eklemek istiyor."
              : "Özel bir maça davet edildin.";

          return (
            <div
              key={key}
              className="pointer-events-auto rounded-xl border border-zinc-600 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-sm"
            >
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.type === "match_invite" && matchId && (
                  <button
                    type="button"
                    className="rounded-md border border-[#5a7a45] bg-[#739552] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                    onClick={() => void dismiss(key, n, matchId)}
                  >
                    Kabul Et
                  </button>
                )}
                {n.type === "friend_request" && (
                  <button
                    type="button"
                    className="rounded-md border border-[#5a7a45] bg-[#739552] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                    onClick={() => {
                      void dismiss(key, n);
                      router.push("/play/online");
                    }}
                  >
                    Arenaya git
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md border border-zinc-500 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  onClick={() => void dismiss(key, n)}
                >
                  Kapat
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
