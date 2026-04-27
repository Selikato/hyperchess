-- Turnuva modülü: tablolar, eşleştirme RPC, puan trigger'ı.
-- arena_schema.sql sonrası Supabase SQL Editor'da çalıştırın.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null default now(),
  registration_ends_at timestamptz not null default (now() + interval '5 days'),
  created_by uuid references auth.users (id) on delete set null,
  bracket_json jsonb,
  status text not null default 'bekliyor'
    check (status in ('bekliyor', 'devam_ediyor', 'bitti')),
  created_at timestamptz not null default now()
);

alter table public.tournaments
  add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.tournaments
  add column if not exists registration_ends_at timestamptz not null default (now() + interval '5 days');
alter table public.tournaments
  add column if not exists bracket_json jsonb;

-- Eski kayıtlarda created_by boşsa, ilk katılımcıyı kurucu kabul et.
with first_participant as (
  select distinct on (tp.tournament_id)
    tp.tournament_id,
    tp.user_id
  from public.tournament_participants tp
  order by tp.tournament_id, tp.created_at asc
)
update public.tournaments t
set created_by = fp.user_id
from first_participant fp
where t.id = fp.tournament_id
  and t.created_by is null;

create table if not exists public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score int not null default 0,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.matches
  add column if not exists tournament_id uuid
    references public.tournaments (id) on delete set null;

create index if not exists matches_tournament_idx on public.matches (tournament_id, created_at desc);
create index if not exists tournament_participants_tournament_idx
  on public.tournament_participants (tournament_id, score desc);

alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('friend_request', 'match_invite', 'tournament_created'));

drop policy if exists "tournaments_select_authenticated" on public.tournaments;
create policy "tournaments_select_authenticated"
  on public.tournaments for select
  to authenticated
  using (true);

drop policy if exists "tournaments_insert_authenticated" on public.tournaments;
create policy "tournaments_insert_authenticated"
  on public.tournaments for insert
  to authenticated
  with check (true);

drop policy if exists "tournament_participants_select_authenticated" on public.tournament_participants;
create policy "tournament_participants_select_authenticated"
  on public.tournament_participants for select
  to authenticated
  using (true);

drop policy if exists "tournament_participants_insert_self" on public.tournament_participants;
create policy "tournament_participants_insert_self"
  on public.tournament_participants for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.arena_join_tournament(p_tournament_id uuid)
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

  insert into public.tournament_participants (tournament_id, user_id, score)
  values (p_tournament_id, uid, 0)
  on conflict (tournament_id, user_id) do nothing;

  perform public.arena_refresh_tournament_bracket(p_tournament_id);
end;
$$;

grant execute on function public.arena_join_tournament(uuid) to authenticated;

create or replace function public.arena_refresh_tournament_bracket(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  users uuid[];
  shuffled uuid[];
  n int;
  bracket_size int := 1;
  round1_count int;
  i int := 1;
  left_uid uuid;
  right_uid uuid;
  round1 jsonb := '[]'::jsonb;
  t_status text;
begin
  select status into t_status
  from public.tournaments
  where id = p_tournament_id;

  if t_status is null then
    raise exception 'tournament not found';
  end if;
  if t_status <> 'bekliyor' then
    return;
  end if;

  select array_agg(tp.user_id)
  into users
  from public.tournament_participants tp
  where tp.tournament_id = p_tournament_id;

  if users is null or array_length(users, 1) is null then
    update public.tournaments
    set bracket_json = null
    where id = p_tournament_id;
    return;
  end if;

  select array_agg(x.user_id)
  into shuffled
  from unnest(users) as x(user_id)
  order by random();

  n := array_length(shuffled, 1);
  while bracket_size < n loop
    bracket_size := bracket_size * 2;
  end loop;

  round1_count := bracket_size / 2;
  while i <= round1_count loop
    left_uid := shuffled[i];
    right_uid := shuffled[bracket_size - i + 1];
    round1 := round1 || jsonb_build_object(
      'slot', i,
      'left', coalesce(left_uid::text, null),
      'right', coalesce(right_uid::text, null)
    );
    i := i + 1;
  end loop;

  update public.tournaments
  set bracket_json = jsonb_build_object(
    'size', bracket_size,
    'round1', round1
  )
  where id = p_tournament_id;
end;
$$;

grant execute on function public.arena_refresh_tournament_bracket(uuid) to authenticated;

create or replace function public.arena_join_tournament(p_tournament_id uuid)
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

  insert into public.tournament_participants (tournament_id, user_id, score)
  values (p_tournament_id, uid, 0)
  on conflict (tournament_id, user_id) do nothing;

  perform public.arena_refresh_tournament_bracket(p_tournament_id);
end;
$$;

grant execute on function public.arena_join_tournament(uuid) to authenticated;

create or replace function public.arena_create_tournament(
  p_title text,
  p_description text default null,
  p_start_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t_id uuid;
  creator_name text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_title is null or length(trim(p_title)) < 3 then
    raise exception 'invalid title';
  end if;

  insert into public.tournaments (title, description, start_at, registration_ends_at, status, created_by)
  values (
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_start_at, now()),
    coalesce(p_start_at, now()) + interval '5 days',
    'bekliyor',
    uid
  )
  returning id into t_id;

  insert into public.tournament_participants (tournament_id, user_id, score)
  values (t_id, uid, 0)
  on conflict (tournament_id, user_id) do nothing;

  perform public.arena_refresh_tournament_bracket(t_id);

  select coalesce(nullif(trim(display_name), ''), nullif(trim(full_name), ''), 'Bir oyuncu')
  into creator_name
  from public.profiles
  where id = uid;

  insert into public.notifications (user_id, type, payload)
  select distinct
    case
      when f.user_id = uid then f.friend_id
      else f.user_id
    end as friend_uid,
    'tournament_created',
    jsonb_build_object(
      'tournament_id', t_id::text,
      'from_user_id', uid::text,
      'creator_name', coalesce(creator_name, 'Bir oyuncu'),
      'tournament_title', trim(p_title)
    )
  from public.friendships f
  where f.status = 'accepted'
    and (f.user_id = uid or f.friend_id = uid);

  return t_id;
end;
$$;

grant execute on function public.arena_create_tournament(text, text, timestamptz) to authenticated;

create or replace function public.arena_delete_tournament(p_tournament_id uuid)
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

  delete from public.tournaments
  where id = p_tournament_id
    and created_by = uid;

  if not found then
    raise exception 'cannot delete this tournament';
  end if;
end;
$$;

grant execute on function public.arena_delete_tournament(uuid) to authenticated;

create or replace function public.arena_start_tournament(p_tournament_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  users uuid[];
  shuffled uuid[];
  n int;
  bracket_size int := 1;
  round1_count int;
  i int := 1;
  left_uid uuid;
  right_uid uuid;
  round1 jsonb := '[]'::jsonb;
  pair_count int := 0;
begin
  if exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id
      and t.registration_ends_at > now()
  ) then
    raise exception 'registration still open';
  end if;

  update public.tournaments
  set status = 'devam_ediyor'
  where id = p_tournament_id
    and status = 'bekliyor';

  select array_agg(tp.user_id)
  into users
  from public.tournament_participants tp
  where tp.tournament_id = p_tournament_id;

  if users is null or array_length(users, 1) is null or array_length(users, 1) < 2 then
    raise exception 'not enough participants';
  end if;

  -- Rastgele kura
  select array_agg(x.user_id)
  into shuffled
  from unnest(users) as x(user_id)
  order by random();

  n := array_length(shuffled, 1);
  while bracket_size < n loop
    bracket_size := bracket_size * 2;
  end loop;

  round1_count := bracket_size / 2;
  while i <= round1_count loop
    left_uid := shuffled[i];
    right_uid := shuffled[bracket_size - i + 1];

    round1 := round1 || jsonb_build_object(
      'slot', i,
      'left', coalesce(left_uid::text, null),
      'right', coalesce(right_uid::text, null)
    );

    if left_uid is not null and right_uid is not null then
      insert into public.matches (
        white_player_id,
        black_player_id,
        status,
        match_type,
        fen,
        turn,
        tournament_id
      )
      values (
        left_uid,
        right_uid,
        'playing',
        'public',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'w',
        p_tournament_id
      );
      pair_count := pair_count + 1;
    end if;
    i := i + 1;
  end loop;

  update public.tournaments
  set bracket_json = jsonb_build_object(
    'size', bracket_size,
    'round1', round1
  )
  where id = p_tournament_id;

  return pair_count;
end;
$$;

grant execute on function public.arena_start_tournament(uuid) to authenticated;

create or replace function public.arena_maybe_start_tournament(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  t_status text;
  t_end timestamptz;
begin
  select status, registration_ends_at
  into t_status, t_end
  from public.tournaments
  where id = p_tournament_id;

  if t_status is null then
    return false;
  end if;
  if t_status <> 'bekliyor' then
    return false;
  end if;
  if t_end > now() then
    return false;
  end if;

  perform public.arena_start_tournament(p_tournament_id);
  return true;
exception
  when others then
    return false;
end;
$$;

grant execute on function public.arena_maybe_start_tournament(uuid) to authenticated;

create or replace function public.arena_tournament_apply_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tournament_id is null or new.status <> 'finished' then
    return new;
  end if;
  if old.status = 'finished' then
    return new;
  end if;

  if new.winner_id is null then
    update public.tournament_participants
    set score = score + 1
    where tournament_id = new.tournament_id
      and user_id in (new.white_player_id, new.black_player_id);
  else
    update public.tournament_participants
    set score = score + 3
    where tournament_id = new.tournament_id
      and user_id = new.winner_id;
  end if;

  return new;
end;
$$;

drop trigger if exists arena_tournament_score_trigger on public.matches;
create trigger arena_tournament_score_trigger
after update on public.matches
for each row
execute function public.arena_tournament_apply_score();

-- Realtime için: Dashboard -> Publications -> supabase_realtime
-- public.tournaments ve public.tournament_participants tablolarını ekleyin.
