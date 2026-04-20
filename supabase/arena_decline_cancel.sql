-- Davet reddi ve halka açık kuyrukta bekleyen maçı iptal (10 sn sonra bot’a geçiş için).
-- arena_schema.sql uygulandıktan sonra Supabase SQL Editor’da bir kez çalıştırın.

create or replace function public.arena_decline_private_invite(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.matches
  where id = p_match_id
    and match_type = 'private'
    and status = 'waiting'
    and black_player_id is null
    and private_invitee_id = uid;

  if not found then
    raise exception 'cannot decline this invite';
  end if;
end;
$function$;

grant execute on function public.arena_decline_private_invite(uuid) to authenticated;

create or replace function public.arena_cancel_public_waiting(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from public.matches
  where id = p_match_id
    and match_type = 'public'
    and status = 'waiting'
    and black_player_id is null
    and white_player_id = uid;

  if not found then
    raise exception 'cannot cancel this match';
  end if;
end;
$function$;

grant execute on function public.arena_cancel_public_waiting(uuid) to authenticated;
