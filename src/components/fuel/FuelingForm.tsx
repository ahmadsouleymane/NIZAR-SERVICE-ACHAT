'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DepartureWithFuel, FuelPrice, FuelType } from '@/lib/types'
import { computeAmount, formatFcfa, latestPrice, sumAmounts, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select } from '@/components/ui'

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <p className="font-bold text-gray-900">{departure.bus_number}</p>
        <p className="text-gray-600">{departure.axis}</p>
        <p className="text-gray-500">{departure.driver_name} · {departure.departure_time}</p>
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

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Prix du litre</p>
          <p className="font-semibold text-gray-900">{unitPrice ? formatFcfa(unitPrice) : '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Montant</p>
          <p data-testid="amount" className="font-bold text-gray-900">{formatFcfa(amount)}</p>
        </div>
      </div>
      <div className="rounded-lg bg-blue-50 p-3 text-sm">
        <p className="text-gray-600">Total du départ (avec ce plein)</p>
        <p className="text-lg font-bold text-blue-900">{formatFcfa(departureTotal)}</p>
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Enregistrement…' : 'Enregistrer le plein'}
      </Button>
    </form>
  )
}
