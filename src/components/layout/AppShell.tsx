import Image from 'next/image'
import type { ReactNode } from 'react'
import type { Profile } from '@/lib/types'
import { NavLinks } from './NavLinks'

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/nizar-logo.jpg"
        alt="Logo Nizar Transport Voyageur"
        width={40}
        height={40}
        className="rounded-lg"
      />
      <span className="text-sm font-extrabold leading-tight text-slate-900">
        Nizar Transport
        <span className="block text-[11px] font-semibold text-slate-500">Service d&apos;achat</span>
      </span>
    </div>
  )
}

function roleLabel(role: Profile['role']) {
  return role === 'admin' ? 'Administrateur' : 'Service achat'
}

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const initial = (profile.full_name || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavLinks profile={profile} variant="sidebar" />
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{profile.full_name || '—'}</p>
              <p className="text-xs text-slate-500">{roleLabel(profile.role)}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <div className="lg:pl-64">
        {/* Barre du haut mobile */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <span className="text-xs font-medium text-slate-500">{profile.full_name || ''}</span>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] lg:hidden" data-testid="bottom-nav">
          <NavLinks profile={profile} variant="bottom" />
        </nav>
      </div>
    </div>
  )
}
