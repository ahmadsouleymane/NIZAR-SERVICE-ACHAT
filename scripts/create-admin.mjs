// Création du compte administrateur principal (bootstrap).
// À lancer une seule fois pour amorcer le système : ensuite, tout admin peut
// créer d'autres comptes (admin ou assistant) depuis Admin > Utilisateurs.
//
// Usage :
//   node scripts/create-admin.mjs <nom_utilisateur> <mot_de_passe> ["Nom complet"]
//
// Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans
// l'environnement (chargés depuis .env.local si présent).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Charge .env.local sans dépendance externe.
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // .env.local absent : on s'appuie sur l'environnement courant.
}

const DOMAIN = 'nizar.local'
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

const [, , rawUsername, password, fullName = ''] = process.argv
if (!rawUsername || !password) {
  console.error('Usage : node scripts/create-admin.mjs <nom_utilisateur> <mot_de_passe> ["Nom complet"]')
  process.exit(1)
}

const username = rawUsername.trim().toLowerCase()
if (!USERNAME_RE.test(username)) {
  console.error('❌ Nom d’utilisateur invalide (3 à 32 caractères : lettres, chiffres, . _ -).')
  process.exit(1)
}
if (password.length < 6) {
  console.error('❌ Le mot de passe doit contenir au moins 6 caractères.')
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

const email = `${username}@${DOMAIN}`
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, username },
})
if (error) {
  console.error(`❌ Création impossible : ${error.message}`)
  process.exit(1)
}

const { error: roleError } = await supabase
  .from('profiles')
  .update({ role: 'admin', full_name: fullName, username })
  .eq('id', data.user.id)
if (roleError) {
  console.error(`⚠️  Compte créé mais rôle admin non appliqué : ${roleError.message}`)
  process.exit(1)
}

console.log(`✅ Administrateur « ${username} » créé. Connexion : nom d’utilisateur + mot de passe.`)
