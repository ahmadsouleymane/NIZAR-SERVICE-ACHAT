'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'
import { AlertIcon, LogoutIcon, KeyIcon, ChevronDownIcon } from '@/components/ui/icons'

export function UserMenu({ fullName, role }: { fullName: string; role: string }) {
  const [open, setOpen] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch {
      // même si le réseau échoue, on redirige quand même
    }
    router.push('/login')
    router.refresh()
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    if (next.length < 6) {
      setMsg('Le nouveau mot de passe doit faire au moins 6 caractères.')
      return
    }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? ''
    // vérifie l'ancien mot de passe, puis change
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signErr) {
      setMsg('Ancien mot de passe incorrect.')
      setBusy(false)
      return
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updErr) {
      setMsg(updErr.message)
      return
    }
    setMsg('')
    setCurrent('')
    setNext('')
    setShowPwd(false)
    alert('Mot de passe changé ✓')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-slate-100"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {(fullName || 'U').trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{fullName || '—'}</span>
            <span className="block text-xs text-slate-500">{role}</span>
          </span>
        </span>
        <ChevronDownIcon size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => { setShowPwd(!showPwd); setMsg('') }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <KeyIcon size={16} />
            {showPwd ? 'Fermer' : 'Changer le mot de passe'}
          </button>

          {showPwd ? (
            <form onSubmit={changePassword} className="space-y-2 border-t border-slate-100 pt-2">
              <Input id="pwd-current" label="Mot de passe actuel" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              <Input id="pwd-new" label="Nouveau mot de passe" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
              {msg ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertIcon size={14} />
                  {msg}
                </p>
              ) : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? '…' : 'Enregistrer'}
              </Button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogoutIcon size={16} />
            Déconnexion
          </button>
        </div>
      ) : null}
    </div>
  )
}
