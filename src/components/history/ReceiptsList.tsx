'use client'

import { useMemo, useState } from 'react'
import type { Fueling } from '@/lib/types'
import { sumAmounts, formatFcfa } from '@/lib/fuel/calculations'
import { Select, EmptyState, Card } from '@/components/ui'

type Filter = 'all' | 'paid' | 'unpaid'

export function ReceiptsList({ fuelings }: { fuelings: Fueling[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'paid') return fuelings.filter((f) => f.paid)
    if (filter === 'unpaid') return fuelings.filter((f) => !f.paid)
    return fuelings
  }, [fuelings, filter])

  const total = sumAmounts(filtered)
  const typeLabel = (t: string) => (t === 'diesel' ? 'Diesel' : 'Essence')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          id="statut"
          label="Statut"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'paid', label: 'Payés' },
            { value: 'unpaid', label: 'Non payés' },
          ]}
        />
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Total affiché</p>
          <p data-testid="receipts-total" className="text-xl font-bold text-gray-900">{formatFcfa(total)}</p>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="Aucun reçu pour ces critères." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {filtered.map((f) => (
            <div key={f.id} data-testid="receipt-row" className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div>
                <div className="text-sm font-semibold text-gray-900">{f.bus_number}</div>
                <div className="text-xs text-gray-500">
                  {f.date} · {typeLabel(f.fuel_type)} · {f.liters} L
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-gray-900">{formatFcfa(f.amount)}</span>
                <span className={`text-xs font-semibold ${f.paid ? 'text-green-600' : 'text-amber-600'}`}>
                  {f.paid ? 'Payé' : 'Non payé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
