-- ============================================================
-- Kilométrage (odomètre) au moment du plein → permet de calculer la
-- consommation RÉELLE par bus (méthode plein-à-plein) et d'affiner la
-- prédiction. Ré-exécutable.
-- ============================================================

alter table public.fuelings
  add column if not exists odometer_km numeric check (odometer_km >= 0);
