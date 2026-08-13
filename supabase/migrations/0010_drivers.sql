-- ============================================================
-- Référentiel des chauffeurs (nom + téléphone). RLS : lecture connectés,
-- écriture admin. Seed avec les chauffeurs du planning type. Ré-exécutable.
-- ============================================================

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (full_name, phone)
);

alter table public.drivers enable row level security;

drop policy if exists "drivers_read_all" on public.drivers;
create policy "drivers_read_all" on public.drivers
  for select using (auth.role() = 'authenticated');
drop policy if exists "drivers_insert_admin" on public.drivers;
create policy "drivers_insert_admin" on public.drivers
  for insert with check (public.is_admin());
drop policy if exists "drivers_update_admin" on public.drivers;
create policy "drivers_update_admin" on public.drivers
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "drivers_delete_admin" on public.drivers;
create policy "drivers_delete_admin" on public.drivers
  for delete using (public.is_admin());

insert into public.drivers (full_name, phone) values
  ('YUSSOUF', '96474717'), ('GHALIOU', '96927960'), ('DAN GALMI', '96577090'),
  ('ALI', '96270623'), ('MOUSSA', '95163156'), ('MOURTALA', '97864618'),
  ('INGADAM', '98071519'), ('KODO', '91121291'), ('ILLA', '96592531'),
  ('ABDOUL AZIZ', '96656496'), ('ASSALEK', '98703837'), ('SIDI AMAR', '98428686'),
  ('BOUBACAR', '97065041'), ('HASSAN', '98061705'), ('HAMADI', '97444044')
on conflict (full_name, phone) do nothing;
