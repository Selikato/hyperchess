"use client";

import { useEffect } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { setProfileOnlineState } from "@/lib/arena/api";

/** profiles.is_online için basit oturum işareti (Presence ayrı kanalda). */
export function PresenceTracker() {
  const { user } = useProfile();

  useEffect(() => {
    if (!user) return;

    void setProfileOnlineState(true);
    const id = window.setInterval(() => {
      void setProfileOnlineState(true);
    }, 45000);

    const onUnload = () => {
      void setProfileOnlineState(false);
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", onUnload);
      void setProfileOnlineState(false);
    };
  }, [user]);

  return null;
}
