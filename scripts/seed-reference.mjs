// Seed des données de référence pour la prédiction de carburant :
//   - distances routières (route_segments) des axes réels du réseau ;
//   - taux de consommation prévisionnel global (app_settings) ;
//   - bus du planning type (buses), consommation laissée à null → repli sur le
//     taux global tant que l'admin n'a pas saisi la conso réelle par bus.
// Réutilisable (upsert / on conflict). Usage : node scripts/seed-reference.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Distances directes (km) couvrant les axes du planning type + réseau courant.
// Estimations carte (RN routes du Niger), ajustables dans Admin › Itinéraires.
const segments = [
  { city_a: 'AGADEZ', city_b: 'NIAMEY', distance_km: 951 },
  { city_a: 'AGADEZ', city_b: 'ARLIT', distance_km: 240 },
  { city_a: 'AGADEZ', city_b: 'MARADI', distance_km: 553 },
  { city_a: 'AGADEZ', city_b: 'ZINDER', distance_km: 431 },
  { city_a: 'AGADEZ', city_b: 'INGAL', distance_km: 160 },
  { city_a: 'MARADI', city_b: 'ZINDER', distance_km: 238 },
  { city_a: 'NIAMEY', city_b: 'MARADI', distance_km: 664 },
  { city_a: 'NIAMEY', city_b: 'ZINDER', distance_km: 891 },
]

// Bus du planning type (DEPART AGADEZ + DEPART ARLIT du 06/08/2026).
const buses = [
  'CG 6377', 'BZ 5942', 'BM 5769', 'BM 5774', 'BM 5840', 'BM 5860',
  'BZ 5741', 'BM 5856', 'BZ 5742', 'BH 8212', 'BM 5844',
  'BM 5852', 'BM 5853', 'BM 5854', 'BM 5773',
].map((bus_number) => ({ bus_number, fuel_type: 'diesel' }))

const seg = await supabase.from('route_segments').upsert(segments, { onConflict: 'city_a,city_b' })
if (seg.error) { console.error(`❌ route_segments : ${seg.error.message}`); process.exit(1) }
console.log(`🛣️  ${segments.length} tronçon(s) enregistré(s)`)

const rate = await supabase.from('app_settings').upsert({ key: 'consumption_l_per_100km', value: '30' })
if (rate.error) { console.error(`❌ app_settings : ${rate.error.message}`); process.exit(1) }
console.log('⛽ Taux de consommation global : 30 L/100km')

const bus = await supabase.from('buses').upsert(buses, { onConflict: 'bus_number' })
if (bus.error) { console.error(`❌ buses : ${bus.error.message}`); process.exit(1) }
console.log(`🚌 ${buses.length} bus enregistré(s)`)

console.log('✅ Seed terminé.')
