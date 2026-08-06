import { type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div data-testid="card" className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {title ? <h2 className="mb-3 text-base font-bold text-gray-900">{title}</h2> : null}
      {children}
    </div>
  )
}
