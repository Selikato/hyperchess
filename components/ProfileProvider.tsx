"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_ELO } from "@/lib/elo";

type ProfileContextValue = {
  user: User | null;
  elo: number | null;
  title: "GM" | "IM" | "FM" | "CM" | "ACEMI" | null;
  profileLoading: boolean;
  /** Profildeki Elo varsayılan başlangıç değerindeyse (placement). */
  placementMatch: boolean;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function isRefreshTokenError(message: string) {
  const m = message.toLowerCase();
  return m.includes("invalid refresh token") || m.includes("refresh token not found");
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [elo, setElo] = useState<number | null>(null);
  const [title, setTitle] = useState<"GM" | "IM" | "FM" | "CM" | "ACEMI" | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      setUser(u);
      if (!u) {
        setElo(null);
        setTitle(null);
        setProfileLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("elo,title")
        .eq("id", u.id)
        .maybeSingle();
      if (error) {
        setElo(DEFAULT_ELO);
        setTitle(null);
      } else {
        setElo(typeof data?.elo === "number" ? data.elo : DEFAULT_ELO);
        setTitle(
          data?.title === "GM" ||
            data?.title === "IM" ||
            data?.title === "FM" ||
            data?.title === "CM" ||
            data?.title === "ACEMI"
            ? data.title
            : null
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isRefreshTokenError(msg)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      setUser(null);
      setElo(null);
      setTitle(null);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refreshProfile();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      startTransition(() => {
        setProfileLoading(true);
        void refreshProfile();
      });
    });
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  const placementMatch = Boolean(user) && elo === DEFAULT_ELO;

  const value = useMemo<ProfileContextValue>(
    () => ({
      user,
      elo,
      title,
      profileLoading,
      placementMatch,
      refreshProfile,
    }),
    [user, elo, title, profileLoading, placementMatch, refreshProfile]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile yalnızca ProfileProvider içinde kullanılabilir.");
  }
  return ctx;
}
