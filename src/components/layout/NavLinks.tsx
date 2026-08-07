'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'
import { CalendarIcon, CameraIcon, ClockIcon, ReceiptIcon, CogIcon, BarChartIcon } from '@/components/ui/icons'

export type NavVariant = 'sidebar' | 'bottom'

const LINKS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: BarChartIcon },
  { href: '/', label: 'Départs', icon: CalendarIcon },
  { href: '/scanner', label: 'Scanner', icon: CameraIcon },
  { href: '/historique', label: 'Historique', icon: ClockIcon },
  { href: '/recus', label: 'Reçus', icon: ReceiptIcon },
  { href: '/admin', label: 'Admin', icon: CogIcon, adminOnly: true },
]

export function NavLinks({ profile, variant = 'sidebar' }: { profile: Profile; variant?: NavVariant }) {
  const pathname = usePathname()
  const links = LINKS.filter((l) => !l.adminOnly || profile.role === 'admin')

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  if (variant === 'bottom') {
    return (
      <nav className="flex w-full" data-testid="nav">
        {links.map((link) => {
          const active = isActive(link.href)
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors duration-150 ${
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={23} />
              {link.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex flex-col gap-1" data-testid="nav">
      {links.map((link) => {
        const active = isActive(link.href)
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150 ${
              active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={20} />
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
