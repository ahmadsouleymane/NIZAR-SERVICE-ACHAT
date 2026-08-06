'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FuelPrice, FuelType } from '@/lib/types'
import { formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select, Card } from '@/components/ui'

interface Props {
  initialPrices: FuelPrice[]
}

export function PricesPanel({ initialPrices }: Props) {
  const supabase = createClient()
  const [prices, setPrices] = useState<FuelPrice[]>(initialPrices)
  const [type, setType] = useState<FuelType>('diesel')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await supabase.from('fuel_prices').select('*').order('effective_date')
    setPrices((data ?? []) as FuelPrice[])
  }

  useEffect(() => {
    supabase.from('fuel_prices').select('*').order('effective_date').then(({ data }) => {
      setPrices((data ?? []) as FuelPrice[])
    })
  }, [supabase])

  const current = (t: FuelType) => {
    const candidates = prices.filter((p) => p.fuel_type === t)
    if (candidates.length === 0) return null
    return candidates.reduce((a, b) => (a.effective_date > b.effective_date ? a : b))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const p = Number(price)
    if (!p || p <= 0) {
      setError('Saisissez un prix valide.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('fuel_prices').insert({
      fuel_type: type,
      price: p,
      effective_date: todayLocalISO(),
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setPrice('')
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-gray-500">Diesel actuel</p>
          <p className="text-xl font-bold text-gray-900">{current('diesel') ? formatFcfa(current('diesel')!.price) : '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Essence actuelle</p>
          <p className="text-xl font-bold text-gray-900">{current('essence') ? formatFcfa(current('essence')!.price) : '—'}</p>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold text-gray-900">Changer un prix</h3>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <Input id="prix" label="Prix du litre (FCFA)" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : 'Enregistrer le prix'}
            </Button>
          </div>
        </div>
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      </form>

      <Card title="Historique des prix">
        <ul className="divide-y divide-gray-100 text-sm">
          {prices.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="text-gray-700 capitalize">{p.fuel_type} · {p.effective_date}</span>
              <span className="font-semibold text-gray-900">{formatFcfa(p.price)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
