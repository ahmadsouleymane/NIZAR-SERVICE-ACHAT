'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Fueling } from '@/lib/types'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { realConsumptionByBus } from '@/lib/fuel/prediction'
import { parseRoute } from '@/lib/planning/route'
import { logFuelingAudit } from '@/lib/fuel/audit'
import { Select, Input, EmptyState } from '@/components/ui'
import { BanknotesIcon, ReceiptIcon, DropletIcon, DownloadIcon, CheckCircleIcon } from '@/components/ui/icons'
import { ReceiptDetailSheet } from './ReceiptDetailSheet'

type Filter = 'all' | 'to_approve' | 'approved' | 'paid' | 'unpaid' | 'voided'

// La page /recus fournit receipt_photo_urls (URL signées du bucket privé "receipts") et axis (via le départ lié)
export type ReceiptsListFueling = Fueling & { receipt_photo_urls?: string[]; axis?: string | null }

// Provenance/destination déduites de l'axe du départ (ex. "AGADEZ - NIAMEY").
function originDestination(axis: string | null | undefined): [string, string] {
  const cities = parseRoute(axis ?? '')
  if (cities.length === 0) return ['', '']
  return [cities[0], cities[cities.length - 1]]
}

export function ReceiptsList({ fuelings, isAdmin = false }: { fuelings: ReceiptsListFueling[]; isAdmin?: boolean }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [date, setDate] = useState('')
  const [city, setCity] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReceiptsListFueling | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Étape du workflow : Demandé → Approuvé → Payé.
  const workflow = (f: Fueling) => (f.paid ? 'paid' : f.approved ? 'approved' : 'to_approve')

  async function approve(id: string) {
    setBusyId(id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('fuelings')
      .update({ approved: true, approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
      .eq('id', id)
    if (!error) await logFuelingAudit(supabase, id, 'approved')
    setBusyId(null)
    if (!error) router.refresh()
  }

  const filtered = useMemo(() => {
    let list = fuelings.filter((f) => (filter === 'voided' ? f.voided : !f.voided))
    if (date) list = list.filter((f) => f.date === date)
    if (city.trim()) {
      const needle = city.trim().toUpperCase()
      list = list.filter((f) => {
        const [origin, destination] = originDestination(f.axis)
        return origin.includes(needle) || destination.includes(needle)
      })
    }
    if (filter === 'paid') return list.filter((f) => f.paid)
    if (filter === 'unpaid') return list.filter((f) => !f.paid)
    if (filter === 'approved') return list.filter((f) => f.approved && !f.paid)
    if (filter === 'to_approve') return list.filter((f) => !f.approved && !f.paid)
    return list
  }, [fuelings, filter, date, city])

  const total = sumAmounts(filtered)
  const typeLabel = (t: string) => (t === 'diesel' ? 'Diesel' : 'Essence')

  function downloadCsv(rows: (string | number)[][], name: string) {
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const reportHeader = ['Date', 'N° BL', 'Bus', 'Chauffeur', 'Provenance', 'Destination', 'Type', 'Litres', 'Prix/L', 'Montant', 'Statut']
  function reportRows() {
    return filtered.map((f) => {
      const [origin, destination] = originDestination(f.axis)
      return [
        f.date,
        f.bl_number ?? '',
        f.bus_number,
        f.driver_name,
        origin,
        destination,
        typeLabel(f.fuel_type),
        String(f.liters),
        String(f.unit_price),
        String(f.amount),
        f.paid ? 'Payé' : 'Non payé',
      ]
    })
  }

  function exportCsv() {
    downloadCsv([reportHeader, ...reportRows()], `recus-${todayLocalISO()}.csv`)
  }

  async function exportPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Rapport des reçus de carburant', 14, 15)
    doc.setFontSize(10)
    doc.text(`Généré le ${todayLocalISO()}`, 14, 21)
    autoTable(doc, {
      startY: 26,
      head: [reportHeader],
      body: reportRows(),
      foot: [['', '', '', '', '', '', '', '', '', formatFcfa(total), '']],
      styles: { fontSize: 8 },
    })
    doc.save(`recus-${todayLocalISO()}.pdf`)
  }

  // Synthèse agrégée par bus (nombre de pleins, litres et dépense totale).
  function exportByBus() {
    const byBus = new Map<string, { count: number; liters: number; amount: number }>()
    for (const f of filtered) {
      const agg = byBus.get(f.bus_number) ?? { count: 0, liters: 0, amount: 0 }
      agg.count += 1
      agg.liters += Number(f.liters)
      agg.amount += f.amount
      byBus.set(f.bus_number, agg)
    }
    // Consommation réelle (plein-à-plein) calculée sur tout l'historique fourni.
    const realCons = realConsumptionByBus(fuelings)
    const header = ['Bus', 'Nb pleins', 'Litres', 'Dépense (FCFA)', 'Conso réelle (L/100km)']
    const rows = [...byBus.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([bus, a]) => {
        const key = bus.toUpperCase().replace(/\s+/g, '')
        const rc = realCons.get(key)
        return [
          bus,
          String(a.count),
          String(Math.round(a.liters)),
          String(Math.round(a.amount)),
          rc ? String(rc.lPer100km) : '—',
        ]
      })
    downloadCsv([header, ...rows], `synthese-par-bus-${todayLocalISO()}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <Select
            id="statut"
            label="Statut"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'to_approve', label: 'À approuver' },
              { value: 'approved', label: 'Approuvés (non payés)' },
              { value: 'paid', label: 'Payés' },
              { value: 'unpaid', label: 'Non payés' },
              { value: 'voided', label: 'Annulés' },
            ]}
          />
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-40">
          <Input id="rec-date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-48">
          <Input
            id="rec-city"
            label="Provenance / destination"
            placeholder="ex. Agadez"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        {date || city ? (
          <button
            type="button"
            onClick={() => { setDate(''); setCity('') }}
            className="h-11 rounded-xl px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Effacer les filtres
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
            >
              <DownloadIcon size={16} />
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={exportByBus}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
            >
              <DownloadIcon size={16} />
              Synthèse par bus
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
            >
              <DownloadIcon size={16} />
              Rapport PDF
            </button>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ReceiptIcon size={40} />} message="Aucun reçu pour ces critères." />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((f) => (
            <div
              key={f.id}
              data-testid="receipt-row"
              onClick={() => setSelected(f)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 ${f.voided ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{f.bus_number}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    <DropletIcon size={12} />
                    {typeLabel(f.fuel_type)}
                  </span>
                  {f.bl_number ? (
                    <span className="text-[11px] text-slate-400">BL {f.bl_number}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {f.date} · {f.liters} L
                  {(() => {
                    const [origin, destination] = originDestination(f.axis)
                    return origin && destination ? ` · ${origin} → ${destination}` : null
                  })()}
                  {f.receipt_photo_urls?.length
                    ? f.receipt_photo_urls.map((url, i) => (
                        <span key={i}>
                          {' · '}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 underline"
                          >
                            {f.receipt_photo_urls!.length > 1 ? `Reçu ${i + 1}` : 'Voir le reçu'}
                          </a>
                        </span>
                      ))
                    : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-sm font-bold text-slate-900">{formatFcfa(f.amount)}</span>
                {(() => {
                  if (f.voided) return <span className="text-xs font-semibold text-red-600">Annulé</span>
                  const step = workflow(f)
                  const cls =
                    step === 'paid' ? 'text-emerald-600'
                    : step === 'approved' ? 'text-blue-600'
                    : 'text-amber-600'
                  const label = step === 'paid' ? 'Payé' : step === 'approved' ? 'Approuvé' : 'À approuver'
                  return <span className={`text-xs font-semibold ${cls}`}>{label}</span>
                })()}
                {!f.approved && !f.paid && !f.voided ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); approve(f.id) }}
                    disabled={busyId === f.id}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                  >
                    <CheckCircleIcon size={12} />
                    {busyId === f.id ? '…' : 'Approuver'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <ReceiptDetailSheet
          fueling={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
