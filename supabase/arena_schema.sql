-- HyperChess Arena: online maç, arkadaşlık, bildirimler.
-- Supabase SQL Editor veya CLI ile çalıştırın. Mevcut profiles tablosuna ekler.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  white_player_id uuid references auth.users (id) on delete set null,
  black_player_id uuid references auth.users (id) on delete set null,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn text not null default 'w' check (turn in ('w', 'b')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  match_type text not null default 'public' check (match_type in ('public', 'private')),
  private_invitee_id uuid references auth.users (id) on delete set null,
  winner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_public_waiting_idx
  on public.matches (status, match_type, created_at)
  where status = 'waiting' and match_type = 'public' and black_player_id is null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_distinct check (user_id <> friend_id),
  constraint friendships_pair unique (user_id, friend_id)
);

create index if not exists friendships_user_idx on public.friendships (user_id);
create index if not exists friendships_friend_idx on public.friendships (friend_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('friend_request', 'match_invite')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- profiles: online + aktif maç (matches tablosu oluşturulduktan sonra FK)
alter table public.profiles
  add column if not exists is_online boolean not null default false;

alter table public.profiles
  add column if not exists current_match_id uuid references public.matches (id) on delete set null;

-- Realtime (INSERT/UPDATE için replica identity)
alter table public.matches replica identity full;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.matches enable row level security;
alter table public.friendships enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "matches_select_participants" on public.matches;
create policy "matches_select_participants"
  on public.matches for select
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or auth.uid() = private_invitee_id
  );

drop policy if exists "matches_insert_own" on public.matches;
create policy "matches_insert_own"
  on public.matches for insert
  with check (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

drop policy if exists "matches_update_participants" on public.matches;
create policy "matches_update_participants"
  on public.matches for update
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "friendships_insert_request" on public.friendships;
create policy "friendships_insert_request"
  on public.friendships for insert
  with check (auth.uid() = user_id);

drop policy if exists "friendships_update_invitee" on public.friendships;
create policy "friendships_update_invitee"
  on public.friendships for update
  using (auth.uid() = friend_id or auth.uid() = user_id);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Profiller (Arena): is_online / arama — mevcut projede RLS kapalıysa bu blok hata verebilir; o zaman
-- Dashboard’dan manuel ekleyin veya aşağıdaki satırları tek tek uyarlayın.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles' and c.relrowsecurity
  ) then
    alter table public.profiles enable row level security;
  end if;
end;
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RPC: genel eşleşme
-- ---------------------------------------------------------------------------

create or replace function public.arena_join_public_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  r uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- INTO / EXECUTE USING bazı istemcilerde düz SQL sanıldığı için tablo adı hatası veriyor; := ve tek UPDATE kullan
  r := (
    select id
    from public.matches
    where status = 'waiting'
      and match_type = 'public'
      and black_player_id is null
      and white_player_id = uid
    limit 1
  );

  if r is not null then
    return r;
  end if;

  r := null;
  update public.matches m
  set
    black_player_id = uid,
    status = 'playing',
    updated_at = now()
  from (
    select id
    from public.matches
    where status = 'waiting'
      and match_type = 'public'
      and black_player_id is null
      and white_player_id is not null
      and white_player_id <> uid
    order by created_at asc
    limit 1
    for update skip locked
  ) sub
  where m.id = sub.id
  returning m.id into r;

  if r is not null then
    return r;
  end if;

  insert into public.matches (white_player_id, black_player_id, status, match_type, fen, turn)
  values (
    uid,
    null,
    'waiting',
    'public',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w'
  )
  returning id into r;

  return r;
end;
$function$;

grant execute on function public.arena_join_public_match() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: özel davet + katılım
-- ---------------------------------------------------------------------------

create or replace function public.arena_create_private_challenge(p_invitee uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  r uuid;
  uid uuid := auth.uid();
  invite_payload jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_invitee is null or p_invitee = uid then
    raise exception 'invalid invitee';
  end if;

  insert into public.matches (
    white_player_id,
    black_player_id,
    status,
    match_type,
    private_invitee_id,
    fen,
    turn
  )
  values (
    uid,
    null,
    'waiting',
    'private',
    p_invitee,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w'
  )
  returning id into r;

  -- Metin birleştirerek jsonb üret; değişken adı SQL tarafında hiç görünmez
  invite_payload := format(
    '{"match_id":"%s","from_user_id":"%s"}',
    r::text,
    uid::text
  )::jsonb;

  insert into public.notifications (user_id, type, payload)
  values (
    p_invitee,
    'match_invite',
    invite_payload
  );

  return r;
end;
$function$;

grant execute on function public.arena_create_private_challenge(uuid) to authenticated;

create or replace function public.arena_join_private_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.matches
  set
    black_player_id = uid,
    status = 'playing',
    updated_at = now()
  where id = p_match_id
    and match_type = 'private'
    and status = 'waiting'
    and black_player_id is null
    and private_invitee_id = uid;

  if not found then
    raise exception 'cannot join this match';
  end if;
end;
$$;

grant execute on function public.arena_join_private_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: hamle (sıra kontrolü sunucuda)
-- ---------------------------------------------------------------------------

create or replace function public.arena_apply_move(
  p_match_id uuid,
  p_fen text,
  p_next_turn text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_next_turn is null or p_next_turn not in ('w', 'b') then
    raise exception 'invalid turn';
  end if;

  select * into m
  from public.matches
  where id = p_match_id
  for update;

  if m.id is null then
    raise exception 'match not found';
  end if;
  if m.status <> 'playing' then
    raise exception 'match not in progress';
  end if;

  if m.turn = 'w' and uid <> m.white_player_id then
    raise exception 'not your turn';
  end if;
  if m.turn = 'b' and uid <> m.black_player_id then
    raise exception 'not your turn';
  end if;

  update public.matches
  set
    fen = p_fen,
    turn = p_next_turn,
    updated_at = now()
  where id = p_match_id;
end;
$$;

grant execute on function public.arena_apply_move(uuid, text, text) to authenticated;

create or replace function public.arena_finish_match(
  p_match_id uuid,
  p_winner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then
    raise exception 'match not found';
  end if;
  if uid <> m.white_player_id and uid <> m.black_player_id then
    raise exception 'not a player';
  end if;

  update public.matches
  set
    status = 'finished',
    winner_id = p_winner_id,
    updated_at = now()
  where id = p_match_id;
end;
$$;

grant execute on function public.arena_finish_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: arkadaşlık + bildirim
-- ---------------------------------------------------------------------------

create or replace function public.arena_send_friend_request(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rev public.friendships%rowtype;
  new_row_id uuid := null;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_friend_id is null or p_friend_id = uid then
    raise exception 'invalid friend';
  end if;

  select * into rev
  from public.friendships
  where user_id = p_friend_id and friend_id = uid and status = 'accepted'
  limit 1;
  if rev.id is not null then
    raise exception 'already friends';
  end if;

  insert into public.friendships (user_id, friend_id, status)
  values (uid, p_friend_id, 'pending')
  on conflict (user_id, friend_id) do nothing
  returning id into new_row_id;

  if new_row_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_friend_id,
    'friend_request',
    jsonb_build_object('from_user_id', uid)
  );
end;
$$;

grant execute on function public.arena_send_friend_request(uuid) to authenticated;

create or replace function public.arena_accept_friend_request(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.friendships
  set status = 'accepted'
  where id = p_friendship_id
    and friend_id = uid
    and status = 'pending';
  if not found then
    raise exception 'cannot accept';
  end if;
end;
$$;

grant execute on function public.arena_accept_friend_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime yayını (Dashboard’da da “replica” açık olmalı)
-- ---------------------------------------------------------------------------

-- Realtime: Dashboard → Database → Publications → supabase_realtime → bu tabloları ekleyin
-- veya:
-- alter publication supabase_realtime add table public.matches;
-- alter publication supabase_realtime add table public.notifications;
