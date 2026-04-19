"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";

/** Tüm oturum açmış kullanıcıların presence anahtarları (arkadaşlarla kesiştirilir). */
export function useFriendsPresence(friendIds: string[]) {
  const { user } = useProfile();
  const [presenceKeys, setPresenceKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("arena_presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const next = new Set<string>();
        for (const key of Object.keys(state)) {
          next.add(key);
        }
        setPresenceKeys(next);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const onlineFriendIds = useMemo(
    () => friendIds.filter((id) => presenceKeys.has(id)),
    [friendIds, presenceKeys]
  );

  const isFriendOnline = useMemo(() => {
    const s = new Set(onlineFriendIds);
    return (id: string) => s.has(id);
  }, [onlineFriendIds]);

  return { onlineFriendIds, isFriendOnline };
}
