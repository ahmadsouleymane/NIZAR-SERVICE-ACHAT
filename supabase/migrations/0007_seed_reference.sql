-- ============================================================
-- Seed des données de référence pour la prédiction de carburant
-- (distances, taux de consommation, bus du planning type).
-- À exécuter APRÈS 0006_buses.sql. Ré-exécutable (ON CONFLICT DO NOTHING).
-- Valeurs de distance = estimations carte (RN du Niger), ajustables dans
-- Admin › Itinéraires.
-- ============================================================

insert into public.route_segments (city_a, city_b, distance_km) values
  ('AGADEZ', 'NIAMEY', 951),
  ('AGADEZ', 'ARLIT', 240),
  ('AGADEZ', 'MARADI', 553),
  ('AGADEZ', 'ZINDER', 431),
  ('AGADEZ', 'INGAL', 160),
  ('MARADI', 'ZINDER', 238),
  ('NIAMEY', 'MARADI', 664),
  ('NIAMEY', 'ZINDER', 891)
on conflict (city_a, city_b) do nothing;

insert into public.app_settings (key, value) values
  ('consumption_l_per_100km', '30')
on conflict (key) do nothing;

-- Bus du planning type (DEPART AGADEZ + DEPART ARLIT). Consommation laissée
-- à null → repli sur le taux global tant que l'admin n'a pas saisi la conso
-- réelle par bus.
insert into public.buses (bus_number, fuel_type) values
  ('CG 6377', 'diesel'), ('BZ 5942', 'diesel'), ('BM 5769', 'diesel'),
  ('BM 5774', 'diesel'), ('BM 5840', 'diesel'), ('BM 5860', 'diesel'),
  ('BZ 5741', 'diesel'), ('BM 5856', 'diesel'), ('BZ 5742', 'diesel'),
  ('BH 8212', 'diesel'), ('BM 5844', 'diesel'), ('BM 5852', 'diesel'),
  ('BM 5853', 'diesel'), ('BM 5854', 'diesel'), ('BM 5773', 'diesel')
on conflict (bus_number) do nothing;
