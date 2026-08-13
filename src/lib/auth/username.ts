// Connexion par nom d'utilisateur uniquement.
// Supabase Auth impose une adresse email en interne : on la dérive de façon
// déterministe à partir du nom d'utilisateur (aucun email réel n'est demandé
// ni affiché à l'utilisateur). L'unicité des emails dans auth.users garantit
// donc l'unicité des noms d'utilisateur.
export const USERNAME_EMAIL_DOMAIN = 'nizar.local'

// Caractères autorisés : lettres, chiffres, point, tiret, underscore.
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(normalizeUsername(username))
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}

// Reconstruit le nom d'utilisateur affichable depuis l'email interne stocké
// par Supabase (ex. "jean.dupont@nizar.local" → "jean.dupont").
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, at)
}
