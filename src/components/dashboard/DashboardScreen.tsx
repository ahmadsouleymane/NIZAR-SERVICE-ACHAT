'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Fueling } from '@/lib/types'
import { sumAmounts, formatFcfa, todayLocalISO } from '@/lib/fuel/calculations'
import { BanknotesIcon, DropletIcon, CheckCircleIcon, ClockIcon } from '@/components/ui/icons'

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function DashboardScreen() {
  const [fuelings, setFuelings] = useState<Fueling[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const since = isoDaysAgo(30)
    supabase
      .from('fuelings')
      .select('*')
      .gte('date', since)
      .order('date')
      .then(({ data }) => {
        setFuelings((data ?? []) as Fueling[])
        setLoading(false)
      })
  }, [supabase])

  const today = todayLocalISO()
  const monthStart = today.slice(0, 8) + '01'

  const todayList = fuelings.filter((f) => f.date === today)
  const monthList = fuelings.filter((f) => f.date >= monthStart)
  const pendingList = fuelings.filter((f) => !f.paid)

  const todayTotal = sumAmounts(todayList)
  const monthTotal = sumAmounts(monthList)
  const monthLiters = monthList.reduce((s, f) => s + Number(f.liters), 0)
  const pendingTotal = sumAmounts(pendingList)

  // 7 derniers jours
  const week: { date: string; label: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const iso = isoDaysAgo(i)
    week.push({ date: iso, label: shortDate(iso), total: sumAmounts(fuelings.filter((f) => f.date === iso)) })
  }
  const maxWeek = Math.max(...week.map((w) => w.total), 1)

  const kpis = [
    { label: 'Dépense aujourd’hui', value: formatFcfa(todayTotal), icon: BanknotesIcon, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Dépense ce mois', value: formatFcfa(monthTotal), icon: DropletIcon, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Litres ce mois', value: `${Math.round(monthLiters)} L`, icon: DropletIcon, tone: 'text-slate-700 bg-slate-100' },
    { label: 'À payer', value: formatFcfa(pendingTotal), icon: ClockIcon, tone: 'text-amber-700 bg-amber-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-500">Vue d’ensemble du carburant</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon
              return (
                <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${k.tone}`}>
                    <Icon size={18} />
                  </span>
                  <p className="tabular mt-2 text-lg font-extrabold text-slate-900">{k.value}</p>
                  <p className="text-xs text-slate-500">{k.label}</p>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Dépense sur 7 jours</h2>
              <CheckCircleIcon size={18} className="text-blue-500" />
            </div>
            <div className="flex h-40 items-end gap-2">
              {week.map((w) => (
                <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {w.total > 0 ? formatFcfa(w.total).replace(' FCFA', '') : ''}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-blue-500 transition-all"
                    style={{ height: `${Math.max(4, (w.total / maxWeek) * 100)}px` }}
                    title={`${w.date} : ${formatFcfa(w.total)}`}
                  />
                  <span className="text-[10px] text-slate-400">{w.label}</span>
                </div>
              ))}
            </div>
          </div>

          {pendingList.length > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <ClockIcon size={18} className="shrink-0" />
              <p>
                <strong>{pendingList.length} reçu{pendingList.length > 1 ? 's' : ''}</strong> à payer pour un total de{' '}
                <strong className="tabular">{formatFcfa(pendingTotal)}</strong>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircleIcon size={18} className="shrink-0" />
              <p>Tous les reçus sont payés ✅</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
