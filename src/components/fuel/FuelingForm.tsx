'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DepartureWithFuel, FuelPrice, FuelType } from '@/lib/types'
import { computeAmount, formatFcfa, latestPrice, sumAmounts, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select } from '@/components/ui'
import { DropletIcon, AlertIcon, BanknotesIcon } from '@/components/ui/icons'

interface Props {
  departure: DepartureWithFuel
  onSaved: () => void
}

export function FuelingForm({ departure, onSaved }: Props) {
  const supabase = createClient()
  const [type, setType] = useState<FuelType>('diesel')
  const [liters, setLiters] = useState('')
  const [prices, setPrices] = useState<FuelPrice[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('fuel_prices').select('*').order('effective_date').then(({ data }) => setPrices((data ?? []) as FuelPrice[]))
  }, [supabase])

  const today = todayLocalISO()
  const unitPrice = latestPrice(prices, type, today) ?? 0
  const amount = computeAmount(Number(liters) || 0, unitPrice)
  const departureTotal = sumAmounts(departure.fuelings) + amount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const l = Number(liters)
    if (!l || l <= 0) {
      setError('Saisissez une quantité en litres.')
      return
    }
    if (unitPrice <= 0) {
      setError('Aucun prix défini pour ce carburant. Réglez-le dans Admin.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('fuelings').insert({
      date: today,
      departure_id: departure.id,
      bus_number: departure.bus_number,
      driver_name: departure.driver_name,
      fuel_type: type,
      liters: l,
      unit_price: unitPrice,
      amount,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <DropletIcon size={22} />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-bold text-slate-900">{departure.bus_number}</p>
          <p className="truncate text-slate-600">{departure.axis}</p>
          <p className="text-slate-500">{departure.driver_name} · {departure.departure_time}</p>
        </div>
      </div>

      <Select
        id="type"
        label="Type de carburant"
        value={type}
        onChange={(e) => setType(e.target.value as FuelType)}
        options={[
          { value: 'diesel', label: 'Diesel' },
          { value: 'essence', label: 'Essence' },
        ]}
      />

      <Input
        id="liters"
        label="Quantité (litres)"
        type="number"
        step="0.5"
        min="0"
        inputMode="decimal"
        placeholder="ex. 300"
        value={liters}
        onChange={(e) => setLiters(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Prix du litre</p>
          <p className="tabular mt-0.5 font-bold text-slate-900">{unitPrice ? formatFcfa(unitPrice) : '—'}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-sm">
          <p className="flex items-center gap-1 text-emerald-700">
            <BanknotesIcon size={14} />
            Montant
          </p>
          <p data-testid="amount" className="tabular mt-0.5 text-lg font-extrabold text-emerald-700">
            {formatFcfa(amount)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
        <p className="text-blue-700">Total du départ (avec ce plein)</p>
        <p className="tabular text-lg font-extrabold text-blue-800">{formatFcfa(departureTotal)}</p>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" disabled={busy} className="w-full">
        <DropletIcon size={18} />
        {busy ? 'Enregistrement…' : 'Enregistrer le plein'}
      </Button>
    </form>
  )
}
