import type { ReactNode } from 'react'
import type { Profile } from '@/lib/types'
import { NavLinks } from './NavLinks'

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
        <div className="mb-6 text-base font-bold text-gray-900">Service d&apos;achat</div>
        <div className="flex flex-1 flex-col gap-1">
          <NavLinks profile={profile} />
        </div>
        <div className="text-xs text-gray-500">
          <p className="font-medium text-gray-700">{profile.full_name}</p>
          <p className="capitalize">{profile.role === 'admin' ? 'Administrateur' : 'Service achat'}</p>
        </div>
      </aside>

      {/* Contenu */}
      <div className="lg:pl-56">
        {/* Barre du haut mobile */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <span className="text-base font-bold text-gray-900">Service d&apos;achat</span>
          <span className="text-xs text-gray-500">{profile.full_name}</span>
        </header>

        <main className="mx-auto max-w-5xl p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-2 py-2 lg:hidden" data-testid="bottom-nav">
          <NavLinks profile={profile} />
        </nav>
      </div>
    </div>
  )
}
