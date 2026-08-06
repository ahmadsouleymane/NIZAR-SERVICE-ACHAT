'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Departure, DepartureWithFuel, Fueling } from '@/lib/types'
import { fetchDeparturesForDate, fetchFuelingsForDate } from '@/lib/supabase/queries'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { DatePicker } from './DatePicker'
import { DepartureList } from './DepartureList'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button, Card } from '@/components/ui'
import { FuelingSheet } from '@/components/fuel/FuelingSheet'

export function DeparturesScreen() {
  const [date, setDate] = useState(todayLocalISO())
  const [departures, setDepartures] = useState<DepartureWithFuel[]>([])
  const [fuelings, setFuelings] = useState<Fueling[]>([])
  const [selected, setSelected] = useState<DepartureWithFuel | null>(null)
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
    load(date)
  }, [date, load])

  const grandTotal = sumAmounts(fuelings)
  const pendingCount = fuelings.filter((f) => !f.paid).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Départs du jour</h1>
        <DatePicker value={date} onChange={setDate} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Grand total de la journée</p>
          <p data-testid="grand-total" className="text-xl font-bold text-gray-900">{formatFcfa(grandTotal)}</p>
        </Card>
        <Card className="flex-1 min-w-40">
          <p className="text-xs text-gray-500">Reçus à payer</p>
          <p data-testid="pending-count" className="text-xl font-bold text-gray-900">{pendingCount}</p>
        </Card>
        <Button variant="secondary" disabled={pendingCount === 0} onClick={async () => {
          const { error } = await supabase
            .from('fuelings')
            .update({ paid: true, paid_at: new Date().toISOString() })
            .eq('date', date)
            .eq('paid', false)
          if (!error) load(date)
        }}>
          Tout payer
        </Button>
      </div>

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : departures.length === 0 ? (
        <EmptyState message="Aucun départ prévu pour cette date." />
      ) : (
        <DepartureList departures={departures} onFuel={(d) => setSelected(d)} />
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
