-- İsteğe bağlı: Eski varsayılan 1200 kalan profilleri 700'e çekmek için (bir kez çalıştır).
-- Yeni kullanıcılar handle_new_user tetikleyicisi ile zaten 700 alır.

update public.profiles
set elo = 700, updated_at = now()
where elo = 1200;
