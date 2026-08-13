-- ============================================================
-- Entretien des bus : intervalle de révision (km) + km au dernier entretien.
-- Combiné au dernier odomètre relevé (fuelings), permet d'alerter quand une
-- révision est due. Ré-exécutable.
-- ============================================================

alter table public.buses
  add column if not exists service_interval_km numeric check (service_interval_km > 0);
alter table public.buses
  add column if not exists last_service_km numeric check (last_service_km >= 0);
