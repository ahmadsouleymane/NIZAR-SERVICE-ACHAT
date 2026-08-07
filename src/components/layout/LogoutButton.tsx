'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogoutIcon } from '@/components/ui/icons'

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const supabase = createClient()

  return (
    <button
      type="button"
      aria-label="Déconnexion"
      title="Déconnexion"
      onClick={async () => {
        try {
          await supabase.auth.signOut()
        } catch {
          // même si le réseau échoue, on redirige quand même
        }
        router.push('/login')
        router.refresh()
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-red-600 ${className}`}
    >
      <LogoutIcon size={19} />
    </button>
  )
}
