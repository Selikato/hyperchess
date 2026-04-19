export type MatchStatus = "waiting" | "playing" | "finished";
export type MatchType = "public" | "private";
export type NotificationType = "friend_request" | "match_invite";

export type MatchRow = {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  fen: string;
  turn: "w" | "b";
  status: MatchStatus;
  match_type: MatchType;
  private_invitee_id: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: {
    match_id?: string;
    from_user_id?: string;
  };
  read_at: string | null;
  created_at: string;
};

export type ProfileSearchRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
};
