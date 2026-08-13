import type { Bus, DepartureWithFuel, FuelPrice, RouteSegment } from '@/lib/types'
import { originOf } from '@/lib/planning/parse'
import { parseRoute, computeDistanceKm } from '@/lib/planning/route'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { predictFuel } from '@/lib/fuel/prediction'
import { StatusBadge, type FuelingStatus } from './StatusBadge'

interface Props {
  departures: DepartureWithFuel[]
  onFuel?: (d: DepartureWithFuel) => void
  segments?: RouteSegment[]
  consumptionRate?: number | null
  buses?: Bus[]
  prices?: FuelPrice[]
}

export function DepartureList({ departures, onFuel, segments = [], consumptionRate = null, buses = [], prices = [] }: Props) {
  const today = todayLocalISO()
  const groups = new Map<string, DepartureWithFuel[]>()
  for (const d of departures) {
    const city = originOf(d.axis)
    if (!groups.has(city)) groups.set(city, [])
    groups.get(city)!.push(d)
  }

  const segmentInputs = segments.map((s) => ({ cityA: s.city_a, cityB: s.city_b, distanceKm: s.distance_km }))

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([city, rows]) => (
        <section key={city}>
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{city}</h2>
            <span className="text-xs text-slate-400">· {rows.length} départ{rows.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rows.map((d) => {
              const total = sumAmounts(d.fuelings)
              const paid = d.fuelings.length > 0 && d.fuelings.every((f) => f.paid)
              const status: FuelingStatus = d.fuelings.length === 0 ? 'empty' : paid ? 'paid' : 'fueled'
              const distanceKm = computeDistanceKm(parseRoute(d.axis), segmentInputs)
              const prediction = predictFuel({
                distanceKm,
                busNumber: d.bus_number,
                buses,
                globalRate: consumptionRate,
                prices,
                onDate: today,
              })
              return (
                <button
                  key={d.id}
                  data-testid="departure-row"
                  onClick={() => onFuel?.(d)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="w-16 shrink-0 rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-bold text-slate-700">
                    {d.departure_time || '—'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{d.axis}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {d.bus_number} · {d.driver_name || '—'}
                    </span>
                    {distanceKm != null ? (
                      <span className="block text-xs text-slate-400">
                        ≈ {distanceKm} km
                        {prediction.liters != null ? ` · ≈ ${prediction.liters} L` : ''}
                        {prediction.cost != null ? ` · ≈ ${formatFcfa(prediction.cost)}` : ''}
                        {' prévus'}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {d.fuelings.length > 0 ? (
                      <span className="tabular text-sm font-bold text-slate-900">{formatFcfa(total)}</span>
                    ) : null}
                    <StatusBadge status={status} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
