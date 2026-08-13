// Réinitialisation des données (garde UNIQUEMENT les comptes utilisateurs).
// Supprime toutes les données métier : plannings, départs, pleins, prix,
// itinéraires, réglages. Les profils (profiles) et comptes Auth sont conservés.
//
// ⚠️ IRRÉVERSIBLE. Usage : node scripts/reset-data.mjs --yes
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

if (!process.argv.includes('--yes')) {
  console.error('⚠️  Suppression IRRÉVERSIBLE. Relance avec --yes pour confirmer.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Ordre respectant les clés étrangères (enfants d'abord).
const steps = [
  { table: 'fuelings', key: 'id' },
  { table: 'departures', key: 'id' },
  { table: 'plannings', key: 'id' },
  { table: 'fuel_prices', key: 'id' },
  { table: 'route_segments', key: 'id' },
  { table: 'app_settings', key: 'key' },
]

for (const { table, key } of steps) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .not(key, 'is', null)
  if (error) {
    console.error(`❌ ${table} : ${error.message}`)
    process.exit(1)
  }
  console.log(`🗑️  ${table} : ${count ?? 0} ligne(s) supprimée(s)`)
}

const { count: profileCount } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
console.log(`✅ Terminé. Comptes conservés : ${profileCount ?? '?'} profil(s).`)
