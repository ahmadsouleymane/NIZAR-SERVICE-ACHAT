-- ============================================================
-- Itinéraires (distances), réglages applicatifs, photo de reçu carburant
-- ============================================================

create table public.route_segments (
  id uuid primary key default gen_random_uuid(),
  city_a text not null,
  city_b text not null,
  distance_km numeric not null check (distance_km > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (city_a, city_b)
);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.fuelings add column receipt_photo_url text;

-- Seed : distances routières (sources web concordantes, arrondies au km).
-- LOGA ↔ AGADEZ volontairement absent : aucune source fiable trouvée, à
-- renseigner manuellement dans Admin > Itinéraires dès que la route exacte
-- au nord de Loga est connue.
insert into public.route_segments (city_a, city_b, distance_km) values
  ('NIAMEY', 'AGADEZ', 951),
  ('NIAMEY', 'LOGA', 139),
  ('LOGA', 'DOSSO', 73),
  ('NIAMEY', 'DOSSO', 139),
  ('DOSSO', 'DOGONDOUTCHI', 139),
  ('DOGONDOUTCHI', 'KONNI', 147),
  ('KONNI', 'TAHOUA', 133),
  ('TAHOUA', 'AGADEZ', 398),
  ('AGADEZ', 'ARLIT', 240),
  ('NIAMEY', 'MARADI', 664),
  ('MARADI', 'ZINDER', 238),
  ('NIAMEY', 'ZINDER', 891),
  ('NIAMEY', 'GAYA', 287);

-- Seed : taux de consommation prévisionnelle global (L/100km), provisoire
-- (bus diesel type Yutong) — à ajuster dans Admin dès réception des specs réelles.
insert into public.app_settings (key, value) values
  ('consumption_l_per_100km', '30');

-- RLS : lecture pour tout utilisateur authentifié, écriture réservée admin
-- (même pattern que fuel_prices, voir 0001_init.sql).
alter table public.route_segments enable row level security;
alter table public.app_settings enable row level security;

create policy "route_segments_read_all" on public.route_segments
  for select using (auth.role() = 'authenticated');
create policy "route_segments_insert_admin" on public.route_segments
  for insert with check (public.is_admin());
create policy "route_segments_delete_admin" on public.route_segments
  for delete using (public.is_admin());

create policy "app_settings_read_all" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings_insert_admin" on public.app_settings
  for insert with check (public.is_admin());
create policy "app_settings_update_admin" on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Stockage : bucket "receipts" (à créer manuellement dans Supabase, public,
-- comme le bucket "plannings" — voir DEPLOYMENT.md).
create policy "receipts_storage_read" on storage.objects
  for select using (bucket_id = 'receipts');
create policy "receipts_storage_insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
