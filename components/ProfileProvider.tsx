"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type ProfileContextValue = {
  user: User | null;
  elo: number | null;
  profileLoading: boolean;
  /** Profildeki Elo tam 1200 ise seviye belirleme maçı (varsayılan). */
  placementMatch: boolean;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [elo, setElo] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const u = session?.user ?? null;
    setUser(u);
    if (!u) {
      setElo(null);
      setProfileLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("elo")
      .eq("id", u.id)
      .maybeSingle();
    if (error) {
      setElo(1200);
    } else {
      setElo(typeof data?.elo === "number" ? data.elo : 1200);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    void refreshProfile();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setProfileLoading(true);
      void refreshProfile();
    });
    return () => subscription.unsubscribe();
  }, [refreshProfile]);

  const placementMatch = Boolean(user) && elo === 1200;

  const value = useMemo<ProfileContextValue>(
    () => ({
      user,
      elo,
      profileLoading,
      placementMatch,
      refreshProfile,
    }),
    [user, elo, profileLoading, placementMatch, refreshProfile]
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
