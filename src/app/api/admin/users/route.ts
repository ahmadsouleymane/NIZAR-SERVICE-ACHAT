import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/types'
import { isValidUsername, normalizeUsername, usernameToEmail } from '@/lib/auth/username'

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'interdit' }, { status: 403 }) }
  return { error: null }
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await req.json()
  const { username, password, full_name, role } = body as {
    username: string
    password: string
    full_name?: string
    role?: Role
  }

  if (!isValidUsername(username ?? '')) {
    return NextResponse.json(
      { error: 'Nom d’utilisateur invalide (3 à 32 caractères : lettres, chiffres, . _ -).' },
      { status: 400 }
    )
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
      { status: 400 }
    )
  }

  const normalized = normalizeUsername(username)
  const admin = serviceClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(normalized),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? '', username: normalized },
  })
  if (error) {
    const msg = /already been registered|already exists/i.test(error.message)
      ? 'Ce nom d’utilisateur est déjà pris.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Le trigger crée le profil avec username + rôle 'achat' par défaut ;
  // on force le rôle demandé si différent.
  if (role && role !== 'achat') {
    await admin.from('profiles').update({ role }).eq('id', data.user.id)
  }
  return NextResponse.json({ ok: true, id: data.user.id })
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const body = await req.json()
  const { id, role } = body as { id: string; role: Role }
  const admin = serviceClient()
  const { error } = await admin.from('profiles').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
