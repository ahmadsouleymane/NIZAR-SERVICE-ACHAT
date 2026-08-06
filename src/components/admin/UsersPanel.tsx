'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/types'
import { Button, Input, Select, Card } from '@/components/ui'

interface Props {
  initialProfiles: Profile[]
}

export function UsersPanel({ initialProfiles }: Props) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)

  async function refresh() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles((data ?? []) as Profile[])
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('achat')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const roleLabel = (r: Role) => (r === 'admin' ? 'Administrateur' : 'Service achat')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    })
    setBusy(false)
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'Erreur lors de la création.')
      return
    }
    setEmail(''); setPassword(''); setFullName('')
    await refresh()
  }

  async function changeRole(id: string, next: Role) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: next }),
    })
    if (res.ok) await refresh()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold text-gray-900">Créer un utilisateur</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="u-name" label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input id="u-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="u-pass" label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Select
            id="u-role"
            label="Rôle"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={[
              { value: 'achat', label: 'Service achat' },
              { value: 'admin', label: 'Administrateur' },
            ]}
          />
        </div>
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Création…' : 'Créer l’utilisateur'}
        </Button>
      </form>

      <Card title="Utilisateurs">
        <ul className="divide-y divide-gray-100 text-sm">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="font-semibold text-gray-900">{p.full_name || '—'}</div>
                <div className="text-xs text-gray-500">{roleLabel(p.role)}</div>
              </div>
              <Select
                id={`role-${p.id}`}
                aria-label={`Rôle de ${p.full_name}`}
                value={p.role}
                onChange={(e) => changeRole(p.id, e.target.value as Role)}
                options={[
                  { value: 'achat', label: 'Service achat' },
                  { value: 'admin', label: 'Administrateur' },
                ]}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
