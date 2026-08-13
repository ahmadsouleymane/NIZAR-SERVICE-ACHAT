'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertIcon } from '@/components/ui/icons'
import { Button, Input } from '@/components/ui'
import { usernameToEmail } from '@/lib/auth/username'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    setLoading(false)
    if (error) {
      setError('Identifiants invalides. Vérifiez votre nom d’utilisateur et votre mot de passe.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          src="/nizar-logo.jpg"
          alt="Logo Nizar Transport Voyageur"
          width={72}
          height={72}
          className="rounded-2xl"
        />
        <h1 className="text-xl font-extrabold text-slate-900">Nizar Transport Voyageur</h1>
        <p className="text-sm text-slate-500">Service d&apos;achat — Connexion</p>
      </div>

      <Input
        id="username"
        label="Nom d’utilisateur"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
