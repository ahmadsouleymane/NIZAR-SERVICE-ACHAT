'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Bus, DepartureWithFuel, FuelPrice, FuelType, RouteSegment } from '@/lib/types'
import { computeAmount, formatFcfa, latestPrice, sumAmounts, todayLocalISO } from '@/lib/fuel/calculations'
import { computeDistanceKm, parseRoute } from '@/lib/planning/route'
import { predictFuel, consumptionDeviation } from '@/lib/fuel/prediction'
import { Button, Input, Select } from '@/components/ui'
import { CameraIcon, UploadIcon, DropletIcon, AlertIcon, BanknotesIcon, TrashIcon, CheckCircleIcon } from '@/components/ui/icons'

interface Props {
  departure: DepartureWithFuel
  onSaved: () => void
  segments?: RouteSegment[]
  buses?: Bus[]
  consumptionRate?: number | null
}

export function FuelingForm({ departure, onSaved, segments = [], buses = [], consumptionRate = null }: Props) {
  const supabase = createClient()
  const [type, setType] = useState<FuelType>('diesel')
  const [liters, setLiters] = useState('')
  const [odometer, setOdometer] = useState('')
  const [blNumber, setBlNumber] = useState('')
  const [blDuplicate, setBlDuplicate] = useState('')
  const [prices, setPrices] = useState<FuelPrice[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receiptPhotos, setReceiptPhotos] = useState<File[]>([])
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const receiptPreviews = useMemo(() => receiptPhotos.map((f) => URL.createObjectURL(f)), [receiptPhotos])
  useEffect(() => () => { receiptPreviews.forEach((u) => URL.revokeObjectURL(u)) }, [receiptPreviews])

  function addReceipts(fileList: FileList | null, input: HTMLInputElement | null) {
    const added = Array.from(fileList ?? [])
    if (added.length > 0) setReceiptPhotos((prev) => [...prev, ...added])
    if (input) input.value = ''
  }

  function removeReceipt(index: number) {
    setReceiptPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Avertissement (non bloquant) si ce numéro de BL a déjà été saisi sur un autre plein.
  async function checkBlDuplicate() {
    const value = blNumber.trim()
    setBlDuplicate('')
    if (!value) return
    const { data } = await supabase
      .from('fuelings')
      .select('bus_number, date')
      .ilike('bl_number', value)
      .limit(1)
    if (data && data.length > 0) {
      setBlDuplicate(`Ce numéro de BL a déjà été utilisé (${data[0].bus_number}, ${data[0].date}).`)
    }
  }

  useEffect(() => {
    supabase.from('fuel_prices').select('*').order('effective_date').then(({ data }) => setPrices((data ?? []) as FuelPrice[]))
  }, [supabase])

  const today = todayLocalISO()
  const unitPrice = latestPrice(prices, type, today) ?? 0
  const amount = computeAmount(Number(liters) || 0, unitPrice)
  const departureTotal = sumAmounts(departure.fuelings) + amount

  // Prévision de carburant pour ce départ (distance × conso du bus) et
  // comparaison en direct avec la quantité saisie (détection de surconsommation).
  const distanceKm = computeDistanceKm(
    parseRoute(departure.axis),
    segments.map((s) => ({ cityA: s.city_a, cityB: s.city_b, distanceKm: s.distance_km }))
  )
  const prediction = predictFuel({
    distanceKm,
    busNumber: departure.bus_number,
    buses,
    globalRate: consumptionRate,
    prices,
    onDate: today,
  })
  const deviation = consumptionDeviation(Number(liters) || 0, prediction.liters)

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

    const uploadedPaths: string[] = []
    for (const photo of receiptPhotos) {
      const path = `${today}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, photo)
      if (upErr) {
        // Nettoie les reçus déjà envoyés avant d'abandonner.
        if (uploadedPaths.length) await supabase.storage.from('receipts').remove(uploadedPaths)
        setError(`Upload du reçu impossible : ${upErr.message}`)
        setBusy(false)
        return
      }
      uploadedPaths.push(path)
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('fuelings').insert({
      date: today,
      departure_id: departure.id,
      bus_number: departure.bus_number,
      driver_name: departure.driver_name,
      fuel_type: type,
      liters: l,
      unit_price: unitPrice,
      amount,
      receipt_photo_paths: uploadedPaths,
      recorded_by: user?.id ?? null,
      ...(uploadedPaths.length ? { receipt_photo_path: uploadedPaths[0] } : {}),
      ...(odometer && Number(odometer) > 0 ? { odometer_km: Number(odometer) } : {}),
      ...(blNumber.trim() ? { bl_number: blNumber.trim() } : {}),
    })
    setBusy(false)
    if (error) {
      if (uploadedPaths.length) await supabase.storage.from('receipts').remove(uploadedPaths)
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

      <div className="grid grid-cols-2 gap-3">
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
        <Input
          id="odometer"
          label="Kilométrage (optionnel)"
          type="number"
          step="1"
          min="0"
          inputMode="numeric"
          placeholder="ex. 152340"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
        />
      </div>

      <div>
        <Input
          id="bl-number"
          label="Numéro de BL (optionnel)"
          value={blNumber}
          onChange={(e) => { setBlNumber(e.target.value); setBlDuplicate('') }}
          onBlur={checkBlDuplicate}
          placeholder="ex. BL-00123"
        />
        {blDuplicate ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700">
            <AlertIcon size={14} className="mt-0.5 shrink-0" />
            {blDuplicate}
          </p>
        ) : null}
      </div>

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

      {prediction.liters != null ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="flex items-center justify-between text-slate-600">
            <span>Prévision pour ce trajet{distanceKm != null ? ` (≈ ${distanceKm} km)` : ''}</span>
            <span className="tabular font-bold text-slate-900">≈ {prediction.liters} L</span>
          </p>
          {deviation ? (
            deviation.status === 'over' ? (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700">
                <AlertIcon size={15} className="mt-0.5 shrink-0" />
                Surconsommation : {Math.round(deviation.pct * 100)} % de plus que prévu. Vérifiez la quantité (trajet, fuite ou erreur de saisie).
              </p>
            ) : deviation.status === 'under' ? (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-700">
                <AlertIcon size={15} className="mt-0.5 shrink-0" />
                Quantité inhabituellement basse ({Math.round(deviation.pct * 100)} % vs prévu).
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">
                <CheckCircleIcon size={15} className="shrink-0" />
                Conforme à la prévision ({deviation.pct >= 0 ? '+' : ''}{Math.round(deviation.pct * 100)} %).
              </p>
            )
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Photos du reçu (optionnel, plusieurs possibles)</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <CameraIcon size={16} />
            Photo
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <UploadIcon size={16} />
            Galerie
          </button>
        </div>
        {receiptPhotos.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {receiptPhotos.map((_, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreviews[i]}
                  alt={`Reçu ${i + 1}`}
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeReceipt(i)}
                  aria-label={`Supprimer le reçu ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow"
                >
                  <TrashIcon size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => addReceipts(e.target.files, e.currentTarget)}
          className="hidden"
        />
        <input
          ref={galleryRef}
          data-testid="receipt-photo-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addReceipts(e.target.files, e.currentTarget)}
          className="hidden"
        />
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
