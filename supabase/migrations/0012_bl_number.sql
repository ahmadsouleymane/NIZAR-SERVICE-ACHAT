-- ============================================================
-- Numéro de BL (bordereau de livraison) associé à un plein.
-- Ré-exécutable.
-- ============================================================

alter table public.fuelings
  add column if not exists bl_number text;
