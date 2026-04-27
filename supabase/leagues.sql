-- Lig & unvan sistemi
-- Supabase SQL Editor'da çalıştırın.

alter table public.profiles
  add column if not exists title text
  check (title in ('GM', 'IM', 'FM', 'CM', 'ACEMI'));

alter table public.profiles
  drop constraint if exists profiles_title_check;
alter table public.profiles
  add constraint profiles_title_check
  check (title in ('GM', 'IM', 'FM', 'CM', 'ACEMI'));

create table if not exists public.league_settings (
  league text primary key check (league in ('GM', 'IM', 'FM', 'CM', 'ACEMI')),
  min_elo int not null,
  updated_at timestamptz not null default now()
);

alter table public.league_settings
  drop constraint if exists league_settings_league_check;
alter table public.league_settings
  add constraint league_settings_league_check
  check (league in ('GM', 'IM', 'FM', 'CM', 'ACEMI'));

insert into public.league_settings (league, min_elo)
values
  ('GM', 1100),
  ('IM', 950),
  ('FM', 850),
  ('CM', 750),
  ('ACEMI', 0)
on conflict (league) do nothing;

alter table public.league_settings enable row level security;

drop policy if exists "league_settings_select_authenticated" on public.league_settings;
create policy "league_settings_select_authenticated"
  on public.league_settings for select
  to authenticated
  using (true);

create or replace function public.arena_refresh_leagues()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gm_base int := 1100;
  im_base int := 950;
  fm_base int := 850;
  cm_base int := 750;
  gm_count int;
  im_count int;
  gm_dynamic int;
  im_dynamic int;
begin
  select count(*) into gm_count
  from public.profiles
  where coalesce(elo, 700) >= gm_base;

  gm_dynamic := gm_base;
  if gm_count > 4 then
    select x.elo into gm_dynamic
    from (
      select coalesce(elo, 700) as elo
      from public.profiles
      where coalesce(elo, 700) >= gm_base
      order by coalesce(elo, 700) desc
      offset 3 limit 1
    ) x;
    gm_dynamic := greatest(gm_dynamic, coalesce(gm_dynamic, gm_base));
  end if;

  select count(*) into im_count
  from public.profiles
  where coalesce(elo, 700) >= im_base
    and coalesce(elo, 700) < gm_dynamic;

  im_dynamic := im_base;
  if im_count > 4 then
    select x.elo into im_dynamic
    from (
      select coalesce(elo, 700) as elo
      from public.profiles
      where coalesce(elo, 700) >= im_base
        and coalesce(elo, 700) < gm_dynamic
      order by coalesce(elo, 700) desc
      offset 3 limit 1
    ) x;
    im_dynamic := greatest(im_dynamic, coalesce(im_dynamic, im_base));
  end if;

  update public.league_settings
  set min_elo = case league
    when 'GM' then gm_dynamic
    when 'IM' then im_dynamic
    when 'FM' then fm_base
    when 'CM' then cm_base
    when 'ACEMI' then 0
    else min_elo
  end,
  updated_at = now();

  update public.profiles
  set
    title = case
      when coalesce(elo, 700) >= gm_dynamic then 'GM'
      when coalesce(elo, 700) >= im_dynamic then 'IM'
      when coalesce(elo, 700) >= fm_base then 'FM'
      when coalesce(elo, 700) >= cm_base then 'CM'
      else 'ACEMI'
    end,
    updated_at = now();
end;
$$;

grant execute on function public.arena_refresh_leagues() to authenticated;

create or replace function public.arena_league_refresh_on_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'finished' and old.status <> 'finished' then
    perform public.arena_refresh_leagues();
  end if;
  return new;
end;
$$;

drop trigger if exists arena_league_match_finished_trigger on public.matches;
create trigger arena_league_match_finished_trigger
after update on public.matches
for each row
execute function public.arena_league_refresh_on_match();

create or replace function public.arena_league_refresh_on_tournament()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'bitti' and old.status <> 'bitti' then
    perform public.arena_refresh_leagues();
  end if;
  return new;
end;
$$;

drop trigger if exists arena_league_tournament_finished_trigger on public.tournaments;
create trigger arena_league_tournament_finished_trigger
after update on public.tournaments
for each row
execute function public.arena_league_refresh_on_tournament();

-- İlk kurulum sonrası bir kez hesapla
select public.arena_refresh_leagues();
