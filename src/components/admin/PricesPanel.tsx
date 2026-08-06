'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FuelPrice, FuelType } from '@/lib/types'
import { formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, Select, Card } from '@/components/ui'
import { DropletIcon, AlertIcon } from '@/components/ui/icons'

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
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <DropletIcon size={16} />
            Diesel actuel
          </p>
          <p className="tabular mt-1 text-xl font-extrabold text-slate-900">
            {current('diesel') ? formatFcfa(current('diesel')!.price) : '—'}
          </p>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <DropletIcon size={16} />
            Essence actuelle
          </p>
          <p className="tabular mt-1 text-xl font-extrabold text-slate-900">
            {current('essence') ? formatFcfa(current('essence')!.price) : '—'}
          </p>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">Changer un prix</h3>
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
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </form>

      <Card title="Historique des prix">
        <ul className="divide-y divide-slate-100 text-sm">
          {prices.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5">
              <span className="capitalize text-slate-700">{p.fuel_type} · {p.effective_date}</span>
              <span className="tabular font-bold text-slate-900">{formatFcfa(p.price)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
