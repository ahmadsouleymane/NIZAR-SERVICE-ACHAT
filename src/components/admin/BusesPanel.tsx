'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Bus, FuelType } from '@/lib/types'
import { Button, Input, Select, Card } from '@/components/ui'
import { AlertIcon, TrashIcon, PencilIcon } from '@/components/ui/icons'

interface Props {
  initialBuses: Bus[]
}

const emptyForm = { busNumber: '', label: '', fuelType: 'diesel' as FuelType, consumption: '', tank: '' }

export function BusesPanel({ initialBuses }: Props) {
  const supabase = createClient()
  const [buses, setBuses] = useState<Bus[]>(initialBuses)
  const [form, setForm] = useState(emptyForm)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fuelLabel = (t: FuelType) => (t === 'diesel' ? 'Diesel' : 'Essence')

  async function refresh() {
    const { data, error } = await supabase.from('buses').select('*').order('bus_number')
    if (error) { setError(error.message); return }
    setBuses((data ?? []) as Bus[])
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingKey(null)
  }

  function handleEdit(b: Bus) {
    setForm({
      busNumber: b.bus_number,
      label: b.label,
      fuelType: b.fuel_type,
      consumption: b.consumption_l_per_100km != null ? String(b.consumption_l_per_100km) : '',
      tank: b.tank_capacity_l != null ? String(b.tank_capacity_l) : '',
    })
    setEditingKey(b.bus_number)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const busNumber = form.busNumber.trim().toUpperCase().replace(/\s+/g, ' ')
    if (!busNumber) { setError('Saisissez le numéro du bus.'); return }
    const consumption = form.consumption ? Number(form.consumption) : null
    if (consumption != null && (!Number.isFinite(consumption) || consumption <= 0)) {
      setError('Consommation invalide (litres / 100 km).'); return
    }
    const tank = form.tank ? Number(form.tank) : null
    if (tank != null && (!Number.isFinite(tank) || tank <= 0)) {
      setError('Capacité du réservoir invalide.'); return
    }
    setBusy(true)
    const payload = {
      bus_number: busNumber,
      label: form.label.trim(),
      fuel_type: form.fuelType,
      consumption_l_per_100km: consumption,
      tank_capacity_l: tank,
    }
    // upsert sur la clé primaire bus_number (création ou mise à jour).
    const { error } = await supabase.from('buses').upsert(payload)
    setBusy(false)
    if (error) { setError(error.message); return }
    resetForm()
    await refresh()
  }

  async function handleDelete(busNumber: string) {
    setBusy(true)
    const { error } = await supabase.from('buses').delete().eq('bus_number', busNumber)
    setBusy(false)
    if (error) { setError(error.message); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">
          {editingKey ? 'Modifier un bus' : 'Ajouter un bus'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="b-number"
            label="N° du bus (ex. CG 6377)"
            value={form.busNumber}
            onChange={(e) => setForm((f) => ({ ...f, busNumber: e.target.value }))}
            disabled={editingKey != null}
            required
          />
          <Input
            id="b-label"
            label="Modèle / libellé (optionnel)"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
          <Select
            id="b-fuel"
            label="Carburant"
            value={form.fuelType}
            onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value as FuelType }))}
            options={[
              { value: 'diesel', label: 'Diesel' },
              { value: 'essence', label: 'Essence' },
            ]}
          />
          <Input
            id="b-cons"
            label="Consommation (L / 100 km)"
            type="number"
            min="0"
            step="0.5"
            value={form.consumption}
            onChange={(e) => setForm((f) => ({ ...f, consumption: e.target.value }))}
          />
          <Input
            id="b-tank"
            label="Réservoir (litres, optionnel)"
            type="number"
            min="0"
            step="1"
            value={form.tank}
            onChange={(e) => setForm((f) => ({ ...f, tank: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? '…' : editingKey ? 'Mettre à jour' : 'Ajouter le bus'}
          </Button>
          {editingKey ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>
              Annuler
            </Button>
          ) : null}
        </div>
      </form>

      <Card title="Bus enregistrés">
        {buses.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">Aucun bus enregistré. Ajoutez-en pour affiner la prédiction de carburant.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {buses.map((b) => (
              <li key={b.bus_number} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{b.bus_number}{b.label ? ` · ${b.label}` : ''}</div>
                  <div className="text-xs text-slate-500">
                    {fuelLabel(b.fuel_type)}
                    {b.consumption_l_per_100km != null ? ` · ${b.consumption_l_per_100km} L/100km` : ' · consommation non définie'}
                    {b.tank_capacity_l != null ? ` · réservoir ${b.tank_capacity_l} L` : ''}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <button type="button" aria-label={`Modifier ${b.bus_number}`} onClick={() => handleEdit(b)} className="text-blue-600 hover:text-blue-700">
                    <PencilIcon size={16} />
                  </button>
                  <button type="button" aria-label={`Supprimer ${b.bus_number}`} onClick={() => handleDelete(b.bus_number)} className="text-red-600 hover:text-red-700">
                    <TrashIcon size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
