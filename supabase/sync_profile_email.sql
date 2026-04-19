-- Kullanici girisi icin sifreyi public tabloda TUTMAYIN.
-- Supabase Auth, sifreyi auth.users tarafinda guvenli hash olarak saklar.
--
-- Bu script sadece e-posta bilgisini public.profiles ile senkronlar.

alter table public.profiles
add column if not exists email text;

-- Mevcut kayitlar icin email doldur.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is distinct from u.email);

-- Yeni kullanici olustugunda profile'a email yaz.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, full_name, elo)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', '')), ''),
    700
  )
  on conflict (id) do nothing;

  update public.profiles
  set email = new.email,
      display_name = coalesce(
        nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
        display_name
      ),
      full_name = coalesce(
        nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', '')), ''),
        full_name
      ),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Kullanici email degistirirse profiles.email de guncel kalsin.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id
    and (email is distinct from new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_profile_email();
