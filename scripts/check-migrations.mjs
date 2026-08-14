// Vérifie que les migrations 0005→0011 sont appliquées en prod.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

for (const t of ['buses', 'drivers']) {
  const { error } = await supabase.from(t).select('*').limit(1)
  console.log(error ? `❌ table ${t} : ${error.message}` : `✅ table ${t}`)
}
const cols = [['fuelings','receipt_photo_paths'],['fuelings','odometer_km'],['fuelings','approved'],['fuelings','bl_number'],['buses','service_interval_km']]
for (const [t,c] of cols) {
  const { error } = await supabase.from(t).select(c).limit(1)
  console.log(error ? `❌ ${t}.${c} : ${error.message}` : `✅ ${t}.${c}`)
}
const { data: segs, error: segErr } = await supabase.from('route_segments').select('city_a,city_b,distance_km')
console.log(segErr ? `❌ route_segments : ${segErr.message}` : `✅ route_segments : ${segs?.length ?? 0} tronçons`)
const { data: buses, error: busErr } = await supabase.from('buses').select('bus_number')
console.log(busErr ? `❌ buses : ${busErr.message}` : `✅ buses : ${buses?.length ?? 0} bus`)
const { data: drivers, error: drvErr } = await supabase.from('drivers').select('full_name')
console.log(drvErr ? `❌ drivers : ${drvErr.message}` : `✅ drivers : ${drivers?.length ?? 0} chauffeurs`)
const { data: fuels, error: fuelErr } = await supabase.from('fuelings').select('id').limit(1)
console.log(fuelErr ? `❌ fuelings : ${fuelErr.message}` : `✅ fuelings : accessible`)
