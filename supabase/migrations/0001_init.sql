-- Enums
create type user_role as enum ('admin', 'achat');
create type fuel_type as enum ('essence', 'diesel');

-- Profils utilisateurs (1-1 avec auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role user_role not null default 'achat',
  created_at timestamptz not null default now()
);

-- Plannings de départs (une date + photos scannées)
create table public.plannings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source_label text not null default '',
  image_urls text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Départs (lignes d'un planning)
create table public.departures (
  id uuid primary key default gen_random_uuid(),
  planning_id uuid not null references public.plannings(id) on delete cascade,
  axis text not null,
  bus_number text not null default '',
  departure_time text not null default '',
  driver_name text not null default '',
  driver_phone text not null default '',
  backup_driver text,
  backup_phone text
);

-- Historique des prix carburant
create table public.fuel_prices (
  id uuid primary key default gen_random_uuid(),
  fuel_type fuel_type not null,
  price integer not null check (price >= 0),
  effective_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Reçus de plein
create table public.fuelings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  departure_id uuid references public.departures(id) on delete set null,
  bus_number text not null,
  driver_name text not null default '',
  fuel_type fuel_type not null,
  liters numeric not null check (liters >= 0),
  unit_price integer not null check (unit_price >= 0),
  amount numeric not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_departures_planning on public.departures(planning_id);
create index if not exists idx_plannings_date on public.plannings(date);
create index if not exists idx_fuelings_date on public.fuelings(date);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'achat');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.plannings enable row level security;
alter table public.departures enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.fuelings enable row level security;

create policy "profiles_read_all" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_admin" on public.profiles
  for update using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "plannings_read_all" on public.plannings
  for select using (auth.role() = 'authenticated');
create policy "plannings_insert_admin" on public.plannings
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));
create policy "plannings_delete_admin" on public.plannings
  for delete using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "departures_read_all" on public.departures
  for select using (auth.role() = 'authenticated');
create policy "departures_insert_admin" on public.departures
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));
create policy "departures_delete_admin" on public.departures
  for delete using (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "fuel_prices_read_all" on public.fuel_prices
  for select using (auth.role() = 'authenticated');
create policy "fuel_prices_insert_admin" on public.fuel_prices
  for insert with check (auth.uid() in (select id from public.profiles where role = 'admin'));

create policy "fuelings_read_all" on public.fuelings
  for select using (auth.role() = 'authenticated');
create policy "fuelings_insert_agents" on public.fuelings
  for insert with check (auth.uid() in (select id from public.profiles where role in ('admin','achat')));
create policy "fuelings_update_agents" on public.fuelings
  for update using (auth.uid() in (select id from public.profiles where role in ('admin','achat')));
