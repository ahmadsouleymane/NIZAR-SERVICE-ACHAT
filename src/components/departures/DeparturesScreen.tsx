'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Departure, DepartureWithFuel, Fueling, RouteSegment } from '@/lib/types'
import { fetchDeparturesForDate, fetchFuelingsForDate, fetchRouteSegments, fetchConsumptionRate } from '@/lib/supabase/queries'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { DatePicker } from './DatePicker'
import { DepartureList } from './DepartureList'
import { EmptyState, Button } from '@/components/ui'
import { BanknotesIcon, WalletIcon, CheckCircleIcon, CalendarIcon } from '@/components/ui/icons'
import { FuelingSheet } from '@/components/fuel/FuelingSheet'

export function DeparturesScreen() {
  const [date, setDate] = useState(todayLocalISO())
  const [departures, setDepartures] = useState<DepartureWithFuel[]>([])
  const [fuelings, setFuelings] = useState<Fueling[]>([])
  const [selected, setSelected] = useState<DepartureWithFuel | null>(null)
  const [segments, setSegments] = useState<RouteSegment[]>([])
  const [consumptionRate, setConsumptionRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async (d: string) => {
    setLoading(true)
    const [deps, fuels] = await Promise.all([
      fetchDeparturesForDate(supabase, d),
      fetchFuelingsForDate(supabase, d),
    ])
    const byId = new Map<string, Fueling[]>()
    for (const f of fuels) {
      if (!f.departure_id) continue
      if (!byId.has(f.departure_id)) byId.set(f.departure_id, [])
      byId.get(f.departure_id)!.push(f)
    }
    const rows: DepartureWithFuel[] = (deps as Departure[]).map((d) => ({ ...d, fuelings: byId.get(d.id) ?? [] }))
    setDepartures(rows)
    setFuelings(fuels)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // chargement des données : setState après await (faux positif de la règle)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date)
  }, [date, load])

  useEffect(() => {
    // chargement des réglages : setState après await
    Promise.all([fetchRouteSegments(supabase), fetchConsumptionRate(supabase)]).then(([segs, rate]) => {
      setSegments(segs)
      setConsumptionRate(rate)
    })
  }, [supabase])

  const grandTotal = sumAmounts(fuelings)
  const pendingCount = fuelings.filter((f) => !f.paid).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Départs du jour</h1>
          <p className="mt-0.5 text-sm text-slate-500">Faites le plein des bus avant leur départ</p>
        </div>
        <DatePicker value={date} onChange={setDate} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <BanknotesIcon size={18} />
            <span className="text-xs font-semibold">Grand total</span>
          </div>
          <p data-testid="grand-total" className="tabular mt-1 text-xl font-extrabold text-emerald-700">
            {formatFcfa(grandTotal)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <WalletIcon size={18} />
            <span className="text-xs font-semibold">Reçus à payer</span>
          </div>
          <p data-testid="pending-count" className="tabular mt-1 text-xl font-extrabold text-blue-700">
            {pendingCount}
          </p>
        </div>
        <Button
          variant="accent"
          disabled={pendingCount === 0}
          className="col-span-2 lg:col-span-1"
          onClick={async () => {
            const { error } = await supabase
              .from('fuelings')
              .update({ paid: true, paid_at: new Date().toISOString() })
              .eq('date', date)
              .eq('paid', false)
            if (!error) load(date)
          }}
        >
          <CheckCircleIcon size={18} />
          Tout payer
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : departures.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={40} />}
          message={`Aucun départ prévu pour cette date. Scannez le planning dans l'onglet Scanner.`}
        />
      ) : (
        <DepartureList departures={departures} onFuel={(d) => setSelected(d)} segments={segments} consumptionRate={consumptionRate} />
      )}

      {selected ? (
        <FuelingSheet
          departure={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            load(date)
          }}
        />
      ) : null}
    </div>
  )
}
