-- ============================================================
-- Cycle de vie complet d'un plein : qui a approuvé/payé (pas seulement
-- quand), et annulation (jamais de suppression réelle d'un plein — on
-- le marque "voided" pour garder l'historique/l'audit). Journal d'audit
-- séparé (création, modification, approbation, paiement, annulation).
-- Ré-exécutable.
-- ============================================================

alter table public.fuelings
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.fuelings
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;
alter table public.fuelings
  add column if not exists voided boolean not null default false;
alter table public.fuelings
  add column if not exists voided_at timestamptz;
alter table public.fuelings
  add column if not exists voided_by uuid references public.profiles(id) on delete set null;

create table if not exists public.fueling_audit_log (
  id uuid primary key default gen_random_uuid(),
  fueling_id uuid not null references public.fuelings(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'approved', 'paid', 'voided')),
  actor uuid references public.profiles(id) on delete set null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_fueling_audit_log_fueling on public.fueling_audit_log(fueling_id);

alter table public.fueling_audit_log enable row level security;

drop policy if exists "fueling_audit_log_read_all" on public.fueling_audit_log;
create policy "fueling_audit_log_read_all" on public.fueling_audit_log
  for select using (auth.role() = 'authenticated');

drop policy if exists "fueling_audit_log_insert_agents" on public.fueling_audit_log;
create policy "fueling_audit_log_insert_agents" on public.fueling_audit_log
  for insert with check (public.is_agent());
