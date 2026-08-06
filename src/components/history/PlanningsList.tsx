'use client'

import { useState } from 'react'
import type { Planning } from '@/lib/types'

export function PlanningsList({ plannings }: { plannings: Planning[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sorted = [...plannings].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <div key={p.id} data-testid="planning-row" className="rounded-xl border border-gray-200 bg-white">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
          >
            <div>
              <div className="text-sm font-bold text-gray-900">{p.date}</div>
              <div className="text-xs text-gray-500">{p.source_label || 'Planning'} · {p.image_urls.length} photo(s)</div>
            </div>
            <span className="text-gray-400">{openId === p.id ? '−' : '+'}</span>
          </button>
          {openId === p.id ? (
            <div className="grid gap-2 border-t border-gray-100 px-4 py-3 sm:grid-cols-2">
              {p.image_urls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`Photo du planning ${p.date}`} className="rounded-lg border border-gray-200" />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
