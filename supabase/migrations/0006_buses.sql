-- ============================================================
-- Référentiel des bus : consommation par bus (L/100km) pour la prédiction
-- de carburant à partir des données réelles du véhicule + distance calculée.
-- Ré-exécutable. RLS : lecture connectés, écriture admin (comme route_segments).
-- ============================================================

create table if not exists public.buses (
  bus_number text primary key,
  label text not null default '',
  fuel_type fuel_type not null default 'diesel',
  consumption_l_per_100km numeric check (consumption_l_per_100km > 0),
  tank_capacity_l numeric check (tank_capacity_l > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.buses enable row level security;

drop policy if exists "buses_read_all" on public.buses;
create policy "buses_read_all" on public.buses
  for select using (auth.role() = 'authenticated');
drop policy if exists "buses_insert_admin" on public.buses;
create policy "buses_insert_admin" on public.buses
  for insert with check (public.is_admin());
drop policy if exists "buses_update_admin" on public.buses;
create policy "buses_update_admin" on public.buses
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "buses_delete_admin" on public.buses;
create policy "buses_delete_admin" on public.buses
  for delete using (public.is_admin());
