-- Supabase SQL Editor'de bir kez çalıştır.
-- Elo manipülasyonunu sınırlar; doğrudan profiles.elo güncellemesini engeller.

create or replace function public.profiles_block_protected_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.allow_profile_protected_update', true) = '1' then
    return new;
  end if;

  if new.elo is distinct from old.elo then
    raise exception 'elo is read-only for clients';
  end if;
  if new.title is distinct from old.title then
    raise exception 'title is read-only for clients';
  end if;
  if new.email is distinct from old.email then
    raise exception 'email is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row
  execute function public.profiles_block_protected_columns();

create or replace function public.update_elo(p_elo integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_elo integer;
  max_delta constant integer := 50;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_elo < 100 or p_elo > 3500 then
    raise exception 'elo out of range';
  end if;

  select elo into current_elo from public.profiles where id = auth.uid();
  if current_elo is null then
    current_elo := 700;
  end if;

  if abs(p_elo - current_elo) > max_delta then
    raise exception 'elo change too large';
  end if;

  perform set_config('app.allow_profile_protected_update', '1', true);
  update public.profiles
  set elo = p_elo, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.update_elo(integer) from public;
grant execute on function public.update_elo(integer) to authenticated;
