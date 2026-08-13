-- ============================================================
-- Connexion par nom d'utilisateur (suppression de l'email côté interface).
-- Supabase Auth conserve une adresse email interne dérivée du nom d'utilisateur
-- (ex. "jean.dupont@nizar.local"). On stocke aussi le nom d'utilisateur dans
-- profiles pour l'affichage. Ré-exécutable.
-- ============================================================

alter table public.profiles add column if not exists username text;

-- Backfill : dériver le nom d'utilisateur depuis l'email interne pour les
-- comptes existants (partie avant le "@").
update public.profiles p
set username = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id
  and (p.username is null or p.username = '');

-- Unicité (insensible à la casse) des noms d'utilisateur non vides.
create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and username <> '';

-- Le trigger d'inscription récupère désormais aussi le nom d'utilisateur
-- transmis dans les métadonnées (voir POST /api/admin/users).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'achat'
  );
  return new;
end;
$$ language plpgsql security definer;
