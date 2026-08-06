// Script de vérification : tables + bucket Supabase
// Usage : node scripts/check-supabase.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ Variables d’environnement manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const tables = ['profiles', 'plannings', 'departures', 'fuel_prices', 'fuelings']

for (const table of tables) {
  const { error } = await supabase.from(table).select('id').limit(1)
  console.log(error ? `❌ ${table} : ${error.message}` : `✅ ${table} : table accessible`)
}

// Buckets de stockage
const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
if (bucketError) {
  console.log(`❌ storage : ${bucketError.message}`)
} else {
  const names = buckets.map((b) => b.name)
  console.log(`📦 Buckets : ${names.join(', ') || '(aucun)'}`)
  if (!names.includes('plannings')) {
    console.log('   → le bucket "plannings" est manquant, il doit être créé')
  }
}
