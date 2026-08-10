'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RouteSegment } from '@/lib/types'
import { normalizeCityName } from '@/lib/planning/route'
import { Button, Input, Card } from '@/components/ui'
import { AlertIcon, TrashIcon } from '@/components/ui/icons'

interface Props {
  initialSegments: RouteSegment[]
  initialConsumptionRate: number | null
}

export function RoutesPanel({ initialSegments, initialConsumptionRate }: Props) {
  const supabase = createClient()
  const [segments, setSegments] = useState<RouteSegment[]>(initialSegments)
  const [cityA, setCityA] = useState('')
  const [cityB, setCityB] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [rate, setRate] = useState(initialConsumptionRate ? String(initialConsumptionRate) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await supabase.from('route_segments').select('*').order('city_a')
    setSegments((data ?? []) as RouteSegment[])
  }

  async function handleAddSegment(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const d = Number(distanceKm)
    if (!cityA.trim() || !cityB.trim()) {
      setError('Saisissez les deux villes.')
      return
    }
    if (!d || d <= 0) {
      setError('Saisissez une distance valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('route_segments').insert({
      city_a: normalizeCityName(cityA),
      city_b: normalizeCityName(cityB),
      distance_km: d,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setCityA('')
    setCityB('')
    setDistanceKm('')
    await refresh()
  }

  async function handleDelete(id: string) {
    setBusy(true)
    const { error } = await supabase.from('route_segments').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refresh()
  }

  async function handleRateSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const r = Number(rate)
    if (!r || r <= 0) {
      setError('Saisissez un taux valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'consumption_l_per_100km', value: String(r) })
    setBusy(false)
    if (error) {
      setError(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleRateSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Consommation prévisionnelle</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input id="rate" label="Litres / 100 km" type="number" min="0" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} />
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? '…' : 'Enregistrer le taux'}
            </Button>
          </div>
        </div>
      </form>

      <form onSubmit={handleAddSegment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Ajouter un tronçon</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input id="cityA" label="Ville A" value={cityA} onChange={(e) => setCityA(e.target.value)} />
          <Input id="cityB" label="Ville B" value={cityB} onChange={(e) => setCityB(e.target.value)} />
          <Input id="distanceKm" label="Distance (km)" type="number" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : 'Ajouter'}
            </Button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>

      <Card title="Tronçons enregistrés">
        <ul className="divide-y divide-slate-100 text-sm">
          {segments.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">{s.city_a} ↔ {s.city_b}</span>
              <span className="flex items-center gap-3">
                <span className="tabular font-bold text-slate-900">{s.distance_km} km</span>
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => handleDelete(s.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
