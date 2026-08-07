'use client'

import { useMemo, useState } from 'react'
import type { Fueling } from '@/lib/types'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { Select, Input, EmptyState } from '@/components/ui'
import { BanknotesIcon, ReceiptIcon, DropletIcon, DownloadIcon } from '@/components/ui/icons'

type Filter = 'all' | 'paid' | 'unpaid'

export function ReceiptsList({ fuelings }: { fuelings: Fueling[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [date, setDate] = useState('')

  const filtered = useMemo(() => {
    let list = fuelings
    if (date) list = list.filter((f) => f.date === date)
    if (filter === 'paid') return list.filter((f) => f.paid)
    if (filter === 'unpaid') return list.filter((f) => !f.paid)
    return list
  }, [fuelings, filter, date])

  const total = sumAmounts(filtered)
  const typeLabel = (t: string) => (t === 'diesel' ? 'Diesel' : 'Essence')

  function exportCsv() {
    const header = ['Date', 'Bus', 'Chauffeur', 'Type', 'Litres', 'Prix/L', 'Montant', 'Statut']
    const rows = filtered.map((f) => [
      f.date,
      f.bus_number,
      f.driver_name,
      typeLabel(f.fuel_type),
      String(f.liters),
      String(f.unit_price),
      String(f.amount),
      f.paid ? 'Payé' : 'Non payé',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recus-${todayLocalISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          id="statut"
          label="Statut"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'paid', label: 'Payés' },
            { value: 'unpaid', label: 'Non payés' },
          ]}
        />
        <div className="w-40">
          <Input id="rec-date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {date ? (
          <button
            type="button"
            onClick={() => setDate('')}
            className="h-11 rounded-xl px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Effacer la date
          </button>
        ) : null}
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 min-w-44">
          <BanknotesIcon size={18} className="shrink-0 text-emerald-700" />
          <div>
            <p className="text-xs font-semibold text-emerald-700">Total affiché</p>
            <p data-testid="receipts-total" className="tabular text-xl font-extrabold text-emerald-700">
              {formatFcfa(total)}
            </p>
          </div>
        </div>
        {filtered.length > 0 ? (
          <button
            type="button"
            onClick={exportCsv}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <DownloadIcon size={16} />
            Exporter CSV
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ReceiptIcon size={40} />} message="Aucun reçu pour ces critères." />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((f) => (
            <div key={f.id} data-testid="receipt-row" className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{f.bus_number}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    <DropletIcon size={12} />
                    {typeLabel(f.fuel_type)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {f.date} · {f.liters} L
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="tabular text-sm font-bold text-slate-900">{formatFcfa(f.amount)}</span>
                <span className={`text-xs font-semibold ${f.paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {f.paid ? 'Payé' : 'Non payé'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
