import { supabase } from "@/lib/supabaseClient";
import type { FriendshipRow, MatchRow, ProfileSearchRow } from "@/lib/arena/types";

export async function joinPublicMatch(): Promise<string> {
  const { data, error } = await supabase.rpc("arena_join_public_match");
  if (error) throw error;
  if (!data || typeof data !== "string") throw new Error("Eşleşme oluşturulamadı.");
  return data;
}

export async function createPrivateChallenge(inviteeId: string): Promise<string> {
  const { data, error } = await supabase.rpc("arena_create_private_challenge", {
    p_invitee: inviteeId,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") throw new Error("Davet oluşturulamadı.");
  return data;
}

export async function joinPrivateMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc("arena_join_private_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
}

export async function fetchMatch(matchId: string): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data as MatchRow | null;
}

export type ActiveMatchSummary = Pick<
  MatchRow,
  "id" | "fen" | "status" | "white_player_id" | "black_player_id"
>;

/** Lobide “devam eden maçlar” için: oyuncu olduğun playing veya waiting maçlar */
export async function listActiveMatchesForUser(
  userId: string
): Promise<ActiveMatchSummary[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("id,fen,status,white_player_id,black_player_id")
    .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
    .in("status", ["playing", "waiting"])
    .order("updated_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as ActiveMatchSummary[];
}

export async function applyMove(
  matchId: string,
  fen: string,
  nextTurn: "w" | "b"
): Promise<void> {
  const { error } = await supabase.rpc("arena_apply_move", {
    p_match_id: matchId,
    p_fen: fen,
    p_next_turn: nextTurn,
  });
  if (error) throw error;
}

export async function finishMatch(matchId: string, winnerId: string | null): Promise<void> {
  const { error } = await supabase.rpc("arena_finish_match", {
    p_match_id: matchId,
    p_winner_id: winnerId,
  });
  if (error) throw error;
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const { error } = await supabase.rpc("arena_send_friend_request", {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc("arena_accept_friend_request", {
    p_friendship_id: friendshipId,
  });
  if (error) throw error;
}

export async function searchProfilesByName(q: string): Promise<ProfileSearchRow[]> {
  const term = q.trim().replace(/%/g, "").replace(/_/g, "");
  if (term.length < 2) return [];
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, full_name")
    .or(`display_name.ilike.${pattern},full_name.ilike.${pattern}`)
    .limit(12);
  if (error) throw error;
  return (data ?? []) as ProfileSearchRow[];
}

export async function listAcceptedFriendships(userId: string): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;
  return (data ?? []) as FriendshipRow[];
}

export async function listPendingIncomingFriendships(
  userId: string
): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("friend_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return (data ?? []) as FriendshipRow[];
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function setProfileOnlineState(isOnline: boolean): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("profiles")
    .update({ is_online: isOnline, updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (error) console.warn("is_online güncellenemedi", error.message);
}

export async function setCurrentMatch(matchId: string | null): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("profiles")
    .update({
      current_match_id: matchId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);
  if (error) console.warn("current_match_id güncellenemedi", error.message);
}

export function otherFriendId(row: FriendshipRow, me: string): string {
  return row.user_id === me ? row.friend_id : row.user_id;
}
