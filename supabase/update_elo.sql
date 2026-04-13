-- Supabase SQL Editor'de bir kez çalıştır.
-- Amaç: giriş yapmış kullanıcının public.profiles.elo alanını güvenli güncellemek.

create or replace function public.update_elo(p_elo integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
  set elo = p_elo, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.update_elo(integer) from public;
grant execute on function public.update_elo(integer) to authenticated;
