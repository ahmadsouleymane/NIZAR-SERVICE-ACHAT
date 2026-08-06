import type { ReactNode } from 'react'

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      {icon ? <div className="text-slate-400">{icon}</div> : null}
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  )
}
