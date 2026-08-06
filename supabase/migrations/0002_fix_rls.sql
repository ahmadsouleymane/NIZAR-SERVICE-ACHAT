-- ============================================================
-- Correction des politiques RLS + autorisation d'upload des photos
-- À exécuter dans le SQL Editor Supabase (tout en bloc)
-- ============================================================

-- --- Fonctions utilitaires (définies par le propriétaire = ignorent la RLS sur profiles) ---
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_agent()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'achat'));
$$;

-- --- plannings : écriture réservée à l'admin ---
drop policy if exists "plannings_insert_admin" on public.plannings;
create policy "plannings_insert_admin" on public.plannings
  for insert with check (public.is_admin());

drop policy if exists "plannings_delete_admin" on public.plannings;
create policy "plannings_delete_admin" on public.plannings
  for delete using (public.is_admin());

-- --- departures : écriture réservée à l'admin ---
drop policy if exists "departures_insert_admin" on public.departures;
create policy "departures_insert_admin" on public.departures
  for insert with check (public.is_admin());

drop policy if exists "departures_delete_admin" on public.departures;
create policy "departures_delete_admin" on public.departures
  for delete using (public.is_admin());

-- --- fuel_prices : écriture réservée à l'admin ---
drop policy if exists "fuel_prices_insert_admin" on public.fuel_prices;
create policy "fuel_prices_insert_admin" on public.fuel_prices
  for insert with check (public.is_admin());

-- --- fuelings : écriture admin + achat ---
drop policy if exists "fuelings_insert_agents" on public.fuelings;
create policy "fuelings_insert_agents" on public.fuelings
  for insert with check (public.is_agent());

drop policy if exists "fuelings_update_agents" on public.fuelings;
create policy "fuelings_update_agents" on public.fuelings
  for update using (public.is_agent());

-- --- profiles : changement de rôle par l'admin ---
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Stockage : autoriser la lecture et l'upload des photos du bucket "plannings"
-- ============================================================
drop policy if exists "plannings_storage_read" on storage.objects;
create policy "plannings_storage_read" on storage.objects
  for select using (bucket_id = 'plannings');

drop policy if exists "plannings_storage_insert" on storage.objects;
create policy "plannings_storage_insert" on storage.objects
  for insert with check (bucket_id = 'plannings' and auth.role() = 'authenticated');

drop policy if exists "plannings_storage_update" on storage.objects;
create policy "plannings_storage_update" on storage.objects
  for update using (bucket_id = 'plannings' and auth.role() = 'authenticated');
