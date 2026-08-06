'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'

export function NavLinks({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const links = [
    { href: '/', label: 'Départs' },
    { href: '/scanner', label: 'Scanner' },
    { href: '/historique', label: 'Historique' },
    { href: '/recus', label: 'Reçus' },
  ]
  if (profile.role === 'admin') {
    links.push({ href: '/admin', label: 'Admin' })
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex gap-1" data-testid="nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            isActive(link.href) ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
