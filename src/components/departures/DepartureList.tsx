import type { DepartureWithFuel } from '@/lib/types'
import { originOf } from '@/lib/planning/parse'
import { sumAmounts, formatFcfa } from '@/lib/fuel/calculations'
import { StatusBadge, type FuelingStatus } from './StatusBadge'

export function DepartureList({ departures, onFuel }: { departures: DepartureWithFuel[]; onFuel?: (d: DepartureWithFuel) => void }) {
  const groups = new Map<string, DepartureWithFuel[]>()
  for (const d of departures) {
    const city = originOf(d.axis)
    if (!groups.has(city)) groups.set(city, [])
    groups.get(city)!.push(d)
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([city, rows]) => (
        <section key={city}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">{city}</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {rows.map((d) => {
              const total = sumAmounts(d.fuelings)
              const paid = d.fuelings.length > 0 && d.fuelings.every((f) => f.paid)
              const status: FuelingStatus = d.fuelings.length === 0 ? 'empty' : paid ? 'paid' : 'fueled'
              return (
                <button
                  key={d.id}
                  data-testid="departure-row"
                  onClick={() => onFuel?.(d)}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{d.bus_number}</div>
                    <div className="truncate text-sm text-gray-600">{d.axis}</div>
                    <div className="text-xs text-gray-400">
                      {d.departure_time || '—'} · {d.driver_name || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {d.fuelings.length > 0 ? <span className="text-sm font-bold text-gray-900">{formatFcfa(total)}</span> : null}
                    <StatusBadge status={status} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
