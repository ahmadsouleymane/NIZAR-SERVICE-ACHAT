-- ============================================================
-- Workflow de validation des pleins : Demandé → Approuvé → Payé.
-- Ajoute l'étape d'approbation avant paiement. Ré-exécutable.
-- (Le paiement implique l'approbation : voir la logique applicative.)
-- ============================================================

alter table public.fuelings
  add column if not exists approved boolean not null default false;
alter table public.fuelings
  add column if not exists approved_at timestamptz;

-- Les pleins déjà payés sont considérés approuvés (cohérence historique).
update public.fuelings
set approved = true, approved_at = coalesce(approved_at, paid_at, created_at)
where paid = true and approved = false;
