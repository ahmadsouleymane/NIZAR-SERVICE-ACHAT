import { type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div data-testid="card" className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2> : null}
      {children}
    </div>
  )
}
