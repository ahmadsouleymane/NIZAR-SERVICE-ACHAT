'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runOcr } from '@/lib/planning/ocr'
import { parsePlanning, type ParsedPlanning } from '@/lib/planning/parse'
import { todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input } from '@/components/ui'
import { CameraIcon, UploadIcon, AlertIcon, CheckCircleIcon } from '@/components/ui/icons'
import { PreviewTable } from './PreviewTable'

export function ScanForm() {
  const supabase = createClient()
  const [date, setDate] = useState(todayLocalISO())
  const [sourceLabel, setSourceLabel] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [preview, setPreview] = useState<ParsedPlanning | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [success, setSuccess] = useState(false)

  function reset() {
    setPreview(null)
    setPhotos([])
    setDone(false)
    setSuccess(false)
    setError('')
  }

  async function handleScan() {
    setError('')
    if (photos.length === 0) {
      setError('Ajoutez au moins une photo du planning.')
      return
    }
    setBusy(true)
    const lines = []
    for (const photo of photos) {
      try {
        const l = await runOcr(photo)
        lines.push(...l)
      } catch {
        setError('Lecture de la photo impossible. Réessayez avec une meilleure photo.')
        setBusy(false)
        return
      }
    }
    const parsed = parsePlanning(lines)
    setPreview(parsed)
    setBusy(false)
    setDone(true)
  }

  async function handleSave() {
    if (!preview) return
    setError('')
    setBusy(true)

    const imageUrls: string[] = []
    for (const photo of photos) {
      const path = `${date}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage.from('plannings').upload(path, photo)
      if (upErr) {
        setError(`Upload de la photo impossible : ${upErr.message}`)
        setBusy(false)
        return
      }
      const { data: pub } = supabase.storage.from('plannings').getPublicUrl(path)
      imageUrls.push(pub.publicUrl)
    }

    const { data: planning, error: pErr } = await supabase
      .from('plannings')
      .insert({ date, source_label: sourceLabel || 'Planning', image_urls: imageUrls })
      .select()
      .single()
    if (pErr) {
      setError(pErr.message)
      setBusy(false)
      return
    }

    const rows = preview.sections.flatMap((s) =>
      s.departures.map((d) => ({
        planning_id: planning.id,
        axis: d.axis,
        bus_number: d.busNumber,
        departure_time: d.departureTime,
        driver_name: d.driverName,
        driver_phone: d.driverPhone,
        backup_driver: d.backupDriver || null,
        backup_phone: d.backupPhone || null,
      }))
    )
    const { error: dErr } = await supabase.from('departures').insert(rows)
    if (dErr) {
      setError(dErr.message)
      setBusy(false)
      return
    }
    setBusy(false)
    setSuccess(true)
    reset()
  }

  if (done && preview) {
    return (
      <div className="space-y-4">
        <PreviewTable planning={preview} onChange={setPreview} />
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={busy}>
            <CheckCircleIcon size={18} />
            {busy ? 'Enregistrement…' : 'Enregistrer le planning'}
          </Button>
          <Button variant="secondary" onClick={reset}>
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {success ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircleIcon size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Planning enregistré ✓</p>
            <p className="mt-0.5 text-emerald-700">Les départs sont maintenant visibles dans l&apos;onglet Départs.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="sc-date" label="Date du planning" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input id="sc-source" label="Libellé (ex. Feuille Agadez)" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <UploadIcon size={26} />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          Photographiez la feuille de planning
        </span>
        <span className="max-w-xs text-xs text-slate-500">
          Plusieurs photos possibles (feuille Agadez, feuille Niamey…). Cadrez bien le tableau.
        </span>
        <input
          data-testid="photo-input"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          className="sr-only"
        />
      </label>

      {photos.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
          <CameraIcon size={18} className="shrink-0 text-slate-500" />
          {photos.length} photo{photos.length > 1 ? 's' : ''} sélectionnée{photos.length > 1 ? 's' : ''}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button onClick={handleScan} disabled={busy} className="w-full">
        <CameraIcon size={18} />
        {busy ? 'Lecture de la photo…' : 'Lire le planning'}
      </Button>
    </div>
  )
}
