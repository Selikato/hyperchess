export type MatchStatus = "waiting" | "playing" | "finished";
export type MatchType = "public" | "private";
export type NotificationType = "friend_request" | "match_invite" | "tournament_created";

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
  tournament_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentStatus = "bekliyor" | "devam_ediyor" | "bitti";

export type TournamentRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  registration_ends_at: string;
  created_by: string | null;
  bracket_json: {
    size?: number;
    round1?: Array<{ slot: number; left: string | null; right: string | null }>;
  } | null;
  status: TournamentStatus;
  created_at: string;
};

export type TournamentParticipantRow = {
  tournament_id: string;
  user_id: string;
  score: number;
  display_name: string | null;
  full_name: string | null;
  elo: number | null;
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
    tournament_id?: string;
    creator_name?: string;
    tournament_title?: string;
  };
  read_at: string | null;
  created_at: string;
};

export type ProfileSearchRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
};

export type LeagueCode = "GM" | "IM" | "FM" | "CM" | "ACEMI";

export type LeagueSettingRow = {
  league: LeagueCode;
  min_elo: number;
  updated_at: string;
};

export type LeagueTopPlayerRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  elo: number | null;
  title: LeagueCode | null;
};
