'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RouteSegment } from '@/lib/types'
import { normalizeCityName } from '@/lib/planning/route'
import { Button, Input, Card, ConfirmDeleteButton } from '@/components/ui'
import { AlertIcon, PencilIcon } from '@/components/ui/icons'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rate, setRate] = useState(initialConsumptionRate ? String(initialConsumptionRate) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const { data, error } = await supabase.from('route_segments').select('*').order('city_a')
      if (error) {
        setError(error.message)
        return
      }
      setSegments((data ?? []) as RouteSegment[])
    } catch (err) {
      setError('Rechargement des tronçons impossible')
      console.error('refresh route_segments', err)
    }
  }

  function resetForm() {
    setCityA('')
    setCityB('')
    setDistanceKm('')
    setEditingId(null)
  }

  function handleEdit(s: RouteSegment) {
    setCityA(s.city_a)
    setCityB(s.city_b)
    setDistanceKm(String(s.distance_km))
    setEditingId(s.id)
    setError('')
  }

  async function handleSubmitSegment(e: React.FormEvent) {
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
    const payload = {
      city_a: normalizeCityName(cityA),
      city_b: normalizeCityName(cityB),
      distance_km: d,
    }
    let res: { error: { message: string } | null } | null = null
    if (editingId) {
      res = await supabase.from('route_segments').update(payload).eq('id', editingId)
    } else {
      res = await supabase.from('route_segments').insert(payload)
    }
    setBusy(false)
    if (res?.error) {
      setError(res.error.message)
      return
    }
    resetForm()
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
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
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

      <form onSubmit={handleSubmitSegment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">
          {editingId ? 'Modifier un tronçon' : 'Ajouter un tronçon'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input id="cityA" label="Ville A" value={cityA} onChange={(e) => setCityA(e.target.value)} />
          <Input id="cityB" label="Ville B" value={cityB} onChange={(e) => setCityB(e.target.value)} />
          <Input id="distanceKm" label="Distance (km)" type="number" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : editingId ? 'Mettre à jour' : 'Ajouter'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>
                Annuler
              </Button>
            ) : null}
          </div>
        </div>
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
                  aria-label="Modifier"
                  onClick={() => handleEdit(s)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <PencilIcon size={16} />
                </button>
                <ConfirmDeleteButton label={`Supprimer ${s.city_a} ↔ ${s.city_b}`} onConfirm={() => handleDelete(s.id)} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
