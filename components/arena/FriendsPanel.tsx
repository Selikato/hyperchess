"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/components/ProfileProvider";
import {
  acceptFriendRequest,
  createPrivateChallenge,
  listAcceptedFriendships,
  listPendingIncomingFriendships,
  otherFriendId,
  searchProfilesByName,
  sendFriendRequest,
} from "@/lib/arena/api";
import type { FriendshipRow, ProfileSearchRow } from "@/lib/arena/types";
import { useFriendsPresence } from "@/components/arena/useFriendsPresence";

function displayName(p: { display_name: string | null; full_name: string | null }) {
  return (
    (p.display_name && p.display_name.trim()) ||
    (p.full_name && p.full_name.trim()) ||
    "Oyuncu"
  );
}

type FriendsPanelProps = {
  /** Sağ şerit (Chess.com tarzı) — daha sıkı padding */
  variant?: "card" | "rail";
};

export function FriendsPanel({ variant = "card" }: FriendsPanelProps) {
  const { user } = useProfile();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfileSearchRow[]>([]);
  const [friends, setFriends] = useState<FriendshipRow[]>([]);
  const [pendingIn, setPendingIn] = useState<FriendshipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSearchRow>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [f, p] = await Promise.all([
      listAcceptedFriendships(user.id),
      listPendingIncomingFriendships(user.id),
    ]);
    setFriends(f);
    setPendingIn(p);
    const ids = new Set<string>();
    for (const row of f) {
      ids.add(otherFriendId(row, user.id));
    }
    for (const row of p) {
      ids.add(row.user_id);
    }
    if (ids.size === 0) {
      setProfiles({});
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", [...ids]);
    if (error) {
      console.warn(error);
      return;
    }
    const map: Record<string, ProfileSearchRow> = {};
    for (const row of data ?? []) {
      map[row.id] = row as ProfileSearchRow;
    }
    setProfiles(map);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const friendIds = useMemo(
    () => (user ? friends.map((r) => otherFriendId(r, user.id)) : []),
    [friends, user]
  );

  const { isFriendOnline } = useFriendsPresence(friendIds);

  const onSearch = useCallback(async () => {
    if (!user) return;
    setSearching(true);
    setMsg(null);
    try {
      const rows = await searchProfilesByName(query);
      setResults(rows.filter((r) => r.id !== user.id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Arama başarısız.");
    } finally {
      setSearching(false);
    }
  }, [query, user]);

  const onRequest = async (id: string) => {
    setBusy(id);
    setMsg(null);
    try {
      await sendFriendRequest(id);
      setMsg("İstek gönderildi.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "İstek gönderilemedi.");
    } finally {
      setBusy(null);
    }
  };

  const onAccept = async (friendshipId: string) => {
    setBusy(friendshipId);
    try {
      await acceptFriendRequest(friendshipId);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kabul edilemedi.");
    } finally {
      setBusy(null);
    }
  };

  const onChallenge = async (friendId: string) => {
    setBusy(`ch-${friendId}`);
    setMsg(null);
    try {
      const matchId = await createPrivateChallenge(friendId);
      setMsg("Davet gönderildi.");
      window.location.href = `/play/online/${matchId}`;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Davet oluşturulamadı.");
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  const rail = variant === "rail";
  const box = rail
    ? "w-full space-y-5 p-4 text-[#e8e6e3]"
    : "w-full max-w-md space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/80 p-4 text-zinc-100";
  const inputCls = rail
    ? "min-w-0 flex-1 rounded-md border border-[#3c3b36] bg-[#201f1b] px-3 py-2 text-sm text-white placeholder:text-[#6b6863]"
    : "min-w-0 flex-1 rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500";
  const btnPrimary = rail
    ? "shrink-0 rounded-md bg-[#81b64c] px-3 py-2 text-sm font-semibold text-[#262421] transition enabled:hover:bg-[#8fc057] disabled:opacity-50"
    : "shrink-0 rounded-md border border-[#5a7a45] bg-[#739552] px-3 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50";
  const rowCls = rail
    ? "flex items-center justify-between gap-2 rounded-md border border-[#3c3b36] bg-[#312e2b] px-2 py-2 text-sm"
    : "flex items-center justify-between gap-2 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2 py-1.5 text-sm";
  const h2 = rail ? "text-base font-bold text-white" : "text-lg font-semibold text-white";
  const labelMuted = rail ? "mb-1 text-xs text-[#9b9893]" : "mb-1 text-xs text-zinc-400";

  return (
    <div className={box} id={rail ? "friends" : undefined}>
      <h2 className={h2}>Arkadaşlar</h2>

      <div>
        <p className={labelMuted}>İsimle ara</p>
        <div className="flex gap-2">
          <input
            data-friends-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı adı"
            className={inputCls}
          />
          <button
            type="button"
            disabled={searching || query.trim().length < 2}
            onClick={() => void onSearch()}
            className={btnPrimary}
          >
            Ara
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 space-y-1">
            {results.map((r) => (
              <li
                key={r.id}
                className={rowCls}
              >
                <span className="truncate">{displayName(r)}</span>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void onRequest(r.id)}
                  className={
                    rail
                      ? "shrink-0 rounded border border-[#3c3b36] bg-[#262421] px-2 py-0.5 text-xs font-medium text-[#e8e6e3] hover:bg-[#3c3b36]"
                      : "shrink-0 rounded border border-zinc-500 px-2 py-0.5 text-xs font-medium hover:bg-zinc-800"
                  }
                >
                  İstek at
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingIn.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-200/90">Gelen istekler</p>
          <ul className="space-y-1">
            {pendingIn.map((row) => (
              <li
                key={row.id}
                className={
                  rail
                    ? "flex items-center justify-between gap-2 rounded-md border border-amber-800/40 bg-[#312e2b] px-2 py-2 text-sm"
                    : "flex items-center justify-between gap-2 rounded-md border border-amber-900/50 bg-amber-950/30 px-2 py-1.5 text-sm"
                }
              >
                <span className="truncate">
                  {displayName(profiles[row.user_id] ?? { display_name: null, full_name: null })}
                </span>
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void onAccept(row.id)}
                  className={
                    rail
                      ? "shrink-0 rounded bg-[#81b64c] px-2 py-0.5 text-xs font-semibold text-[#262421]"
                      : "shrink-0 rounded border border-[#5a7a45] bg-[#739552] px-2 py-0.5 text-xs font-semibold text-white"
                  }
                >
                  Kabul
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className={labelMuted}>Arkadaş listesi</p>
        <ul className="space-y-1">
          {friends.length === 0 && (
            <li className={rail ? "text-sm text-[#9b9893]" : "text-sm text-zinc-500"}>
              Henüz arkadaşın yok.
            </li>
          )}
          {friends.map((row) => {
            const oid = otherFriendId(row, user.id);
            const p = profiles[oid];
            const online = isFriendOnline(oid);
            return (
              <li key={row.id} className={rowCls}>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      online ? (rail ? "bg-[#81b64c]" : "bg-emerald-400") : rail ? "bg-[#6b6863]" : "bg-zinc-500"
                    }`}
                    title={online ? "Çevrimiçi" : "Çevrimdışı"}
                  />
                  <span className="truncate">{displayName(p ?? { display_name: null, full_name: null })}</span>
                </span>
                <button
                  type="button"
                  disabled={busy === `ch-${oid}`}
                  onClick={() => void onChallenge(oid)}
                  className={
                    rail
                      ? "shrink-0 rounded bg-[#81b64c] px-2 py-0.5 text-xs font-semibold text-[#262421] disabled:opacity-50"
                      : "shrink-0 rounded border border-[#5a7a45] bg-[#739552] px-2 py-0.5 text-xs font-semibold text-white"
                  }
                >
                  Meydan Oku
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {rail && (
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#3c3b36] bg-[#312e2b] py-2.5 text-sm font-semibold text-[#e8e6e3] hover:bg-[#3a3734]"
          onClick={() => {
            document.querySelector<HTMLInputElement>("[data-friends-search]")?.focus();
          }}
        >
          Arkadaşına karşı oyna
        </button>
      )}

      {msg && (
        <p
          className={
            rail ? "text-center text-xs text-[#81b64c]" : "text-center text-xs text-sky-200/90"
          }
        >
          {msg}
        </p>
      )}
    </div>
  );
}
