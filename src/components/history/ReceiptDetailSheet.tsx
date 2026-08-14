'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FuelingAuditLog, FuelType } from '@/lib/types'
import { formatFcfa } from '@/lib/fuel/calculations'
import { logFuelingAudit } from '@/lib/fuel/audit'
import { Button, Input, Select, ConfirmDeleteButton } from '@/components/ui'
import { XIcon, PencilIcon, ClockIcon, AlertIcon, CheckCircleIcon } from '@/components/ui/icons'
import type { ReceiptsListFueling } from './ReceiptsList'

interface Props {
  fueling: ReceiptsListFueling
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
}

type AuditLogWithActor = FuelingAuditLog & { profiles?: { full_name: string } | null }

const actionLabel: Record<string, string> = {
  created: 'Créé',
  updated: 'Modifié',
  approved: 'Approuvé',
  paid: 'Payé',
  voided: 'Annulé',
}

export function ReceiptDetailSheet({ fueling, isAdmin, onClose, onChanged }: Props) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [liters, setLiters] = useState(String(fueling.liters))
  const [unitPrice, setUnitPrice] = useState(String(fueling.unit_price))
  const [fuelType, setFuelType] = useState<FuelType>(fueling.fuel_type)
  const [odometer, setOdometer] = useState(fueling.odometer_km != null ? String(fueling.odometer_km) : '')
  const [blNumber, setBlNumber] = useState(fueling.bl_number ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState<AuditLogWithActor[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [recorderName, setRecorderName] = useState<string | null>(null)

  const canEdit = isAdmin || !fueling.approved
  const typeLabel = (t: string) => (t === 'diesel' ? 'Diesel' : 'Essence')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('fueling_audit_log')
      .select('*, profiles(full_name)')
      .eq('fueling_id', fueling.id)
      .order('created_at')
      .then(({ data }) => {
        if (!cancelled) {
          setLog((data ?? []) as AuditLogWithActor[])
          setLogLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [supabase, fueling.id])

  useEffect(() => {
    if (!fueling.recorded_by) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', fueling.recorded_by)
      .single()
      .then(({ data }) => setRecorderName(data?.full_name ?? null))
  }, [supabase, fueling.recorded_by])

  async function handleSave() {
    setError('')
    const l = Number(liters)
    const p = Number(unitPrice)
    if (!l || l <= 0) { setError('Quantité invalide.'); return }
    if (!p || p <= 0) { setError('Prix invalide.'); return }
    setBusy(true)
    const amount = Math.round(l * p)
    const { error: updErr } = await supabase
      .from('fuelings')
      .update({
        liters: l,
        unit_price: p,
        amount,
        fuel_type: fuelType,
        odometer_km: odometer && Number(odometer) > 0 ? Number(odometer) : null,
        bl_number: blNumber.trim() || null,
      })
      .eq('id', fueling.id)
    if (updErr) {
      setBusy(false)
      setError(updErr.message)
      return
    }
    await logFuelingAudit(
      supabase,
      fueling.id,
      'updated',
      `Litres: ${fueling.liters} → ${l} · Prix/L: ${fueling.unit_price} → ${p}`
    )
    setBusy(false)
    setEditing(false)
    onChanged()
  }

  async function handleVoid() {
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: voidErr } = await supabase
      .from('fuelings')
      .update({ voided: true, voided_at: new Date().toISOString(), voided_by: user?.id ?? null })
      .eq('id', fueling.id)
    if (voidErr) {
      setBusy(false)
      setError(voidErr.message)
      return
    }
    await logFuelingAudit(supabase, fueling.id, 'voided')
    setBusy(false)
    onChanged()
    onClose()
  }

  const [origin, destination] = (() => {
    const axis = fueling.axis ?? ''
    if (!axis) return ['—', '—']
    const parts = axis.split('-').map((s) => s.trim()).filter(Boolean)
    return parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : ['—', '—']
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        data-testid="receipt-detail-sheet"
        role="dialog"
        aria-label={`Détail du reçu ${fueling.bus_number}`}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">{fueling.bus_number}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
          >
            <XIcon size={20} />
          </button>
        </div>

        {fueling.voided ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
            <AlertIcon size={16} />
            Ce plein a été annulé.
          </p>
        ) : null}

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input id="edit-liters" label="Litres" type="number" min="0" step="0.5" value={liters} onChange={(e) => setLiters(e.target.value)} />
              <Input id="edit-price" label="Prix/L" type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                id="edit-type"
                label="Carburant"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
                options={[{ value: 'diesel', label: 'Diesel' }, { value: 'essence', label: 'Essence' }]}
              />
              <Input id="edit-odo" label="Kilométrage" type="number" min="0" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
            </div>
            <Input id="edit-bl" label="Numéro de BL" value={blNumber} onChange={(e) => setBlNumber(e.target.value)} />
            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Date" value={fueling.date} />
              <Info label="Chauffeur" value={fueling.driver_name || '—'} />
              <Info label="Provenance" value={origin} />
              <Info label="Destination" value={destination} />
              <Info label="Carburant" value={typeLabel(fueling.fuel_type)} />
              <Info label="Quantité" value={`${fueling.liters} L`} />
              <Info label="Prix / L" value={formatFcfa(fueling.unit_price)} />
              <Info label="Montant" value={formatFcfa(fueling.amount)} bold />
              <Info label="Kilométrage" value={fueling.odometer_km != null ? `${fueling.odometer_km} km` : '—'} />
              <Info label="Numéro de BL" value={fueling.bl_number ?? '—'} />
            </div>

            {fueling.receipt_photo_urls?.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Photos du reçu</p>
                <div className="grid grid-cols-2 gap-2">
                  {fueling.receipt_photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Reçu ${i + 1}`} className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ClockIcon size={14} />
                Journal
              </p>
              {logLoading ? (
                <p className="text-sm text-slate-400">Chargement…</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>
                      <strong className="font-semibold text-slate-800">Créé</strong>
                      {' '}par {recorderName || 'un utilisateur'} le {new Date(fueling.created_at).toLocaleString('fr-FR')}
                    </span>
                  </li>
                  {log.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2">
                      <CheckCircleIcon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>
                        <strong className="font-semibold text-slate-800">{actionLabel[entry.action] ?? entry.action}</strong>
                        {' '}par {entry.profiles?.full_name || 'un utilisateur'} le {new Date(entry.created_at).toLocaleString('fr-FR')}
                        {entry.details ? <span className="text-slate-400"> — {entry.details}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}

            {!fueling.voided ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {canEdit ? (
                  <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                    <PencilIcon size={16} />
                    Modifier
                  </Button>
                ) : null}
                {isAdmin ? (
                  <ConfirmDeleteButton
                    label={`Annuler le plein de ${fueling.bus_number}`}
                    onConfirm={handleVoid}
                    className="rounded-xl border border-red-200 px-3 py-2"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tabular mt-0.5 ${bold ? 'text-base font-extrabold text-emerald-700' : 'font-semibold text-slate-900'}`}>{value}</p>
    </div>
  )
}
