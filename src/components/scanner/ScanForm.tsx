'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { rotateImage, prepareImage } from '@/lib/planning/preprocess'
import { parsePlanning, type ParsedPlanning, type OcrLine } from '@/lib/planning/parse'
import { ocrImageToLines } from '@/lib/planning/ocr'
import { serializeOcrLines } from '@/lib/planning/ai'
import { todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input } from '@/components/ui'
import { CameraIcon, UploadIcon, AlertIcon, CheckCircleIcon, RotateIcon, TrashIcon, SearchIcon } from '@/components/ui/icons'
import { PreviewTable } from './PreviewTable'

export function ScanForm() {
  const supabase = createClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [date, setDate] = useState(todayLocalISO())
  const [sourceLabel, setSourceLabel] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [preview, setPreview] = useState<ParsedPlanning | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [success, setSuccess] = useState(false)

  // Vignettes de prévisualisation (URL objet révoquées à chaque changement).
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])

  function reset() {
    setPreview(null)
    setPhotos([])
    setDone(false)
    setSuccess(false)
    setError('')
  }

  // Ajoute les photos sélectionnées SANS écraser les précédentes (multi-photos).
  function addPhotos(fileList: FileList | null, input: HTMLInputElement | null) {
    const added = Array.from(fileList ?? [])
    if (added.length > 0) {
      setPhotos((prev) => [...prev, ...added])
      setSuccess(false)
    }
    // Réinitialise l'input pour pouvoir reprendre/ajouter la même source.
    if (input) input.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setError('')
  }

  async function rotatePhoto(index: number) {
    setError('')
    setBusy(true)
    try {
      const rotated = await rotateImage(photos[index], 90)
      const file = new File([rotated], `photo-${index + 1}-tournee.jpg`, { type: 'image/jpeg' })
      const next = [...photos]
      next[index] = file
      setPhotos(next)
    } catch {
      setError('Impossible de tourner la photo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleScan() {
    setError('')
    if (photos.length === 0) {
      setError('Ajoutez au moins une photo du planning.')
      return
    }
    setBusy(true)
    try {
      let date: string | null = null
      const sections: ParsedPlanning['sections'] = []
      for (const photo of photos) {
        // OCR 100% local (Tesseract.js) : aucun serveur, aucun coût.
        const prepared = await prepareImage(photo)
        const lines = await ocrImageToLines(prepared)
        const parsed = parsePlanning(lines)
        if (parsed.date) date = parsed.date
        sections.push(...parsed.sections)
      }
      setPreview({ date, sections })
      setDone(true)
    } catch {
      setError('Impossible de lire la photo sur cet appareil. Vérifiez votre connexion internet (première utilisation) et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  // Lecture « IA » : Tesseract fait l'OCR local, puis DeepSeek (texte) corrige
  // et structure le résultat en JSON. Repli possible sur la lecture classique.
  async function handleAiScan() {
    setError('')
    if (photos.length === 0) {
      setError('Ajoutez au moins une photo du planning.')
      return
    }
    setAiBusy(true)
    try {
      const allLines: OcrLine[][] = []
      for (const photo of photos) {
        const prepared = await prepareImage(photo)
        const lines = await ocrImageToLines(prepared)
        allLines.push(lines)
      }
      const text = serializeOcrLines(allLines)
      const res = await fetch('/api/ai/extract-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'La correction IA a échoué. Utilisez la lecture classique.')
        return
      }
      setPreview(body as ParsedPlanning)
      setDone(true)
    } catch {
      setError('La correction IA a échoué. Utilisez la lecture classique.')
    } finally {
      setAiBusy(false)
    }
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
    if (rows.length > 0) {
      const { error: dErr } = await supabase.from('departures').insert(rows)
      if (dErr) {
        setError(dErr.message)
        setBusy(false)
        return
      }
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Ajoutez la photo du planning</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <CameraIcon size={24} />
            </span>
            <span className="text-sm font-semibold text-slate-800">Prendre une photo</span>
            <span className="text-xs text-slate-500">Une ou plusieurs, l’une après l’autre</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <UploadIcon size={24} />
            </span>
            <span className="text-sm font-semibold text-slate-800">Ajouter des images</span>
            <span className="text-xs text-slate-500">Depuis les photos du téléphone</span>
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => addPhotos(e.target.files, e.currentTarget)}
          className="hidden"
        />
        <input
          ref={galleryRef}
          data-testid="photo-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addPhotos(e.target.files, e.currentTarget)}
          className="hidden"
        />
      </div>

      {photos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">
            {photos.length} photo{photos.length > 1 ? 's' : ''} prête{photos.length > 1 ? 's' : ''} — vérifiez avant de lancer la lecture
          </p>
          {photos.map((photo, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i]}
                alt={`Aperçu photo ${i + 1}`}
                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
              <span className="min-w-0 flex-1 font-medium">Photo {i + 1}</span>
              <button
                type="button"
                onClick={() => rotatePhoto(i)}
                disabled={busy}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
              >
                <RotateIcon size={14} />
                Tourner
              </button>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                disabled={busy}
                aria-label={`Supprimer la photo ${i + 1}`}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Button onClick={handleScan} disabled={busy || aiBusy} className="w-full">
          <CameraIcon size={18} />
          {busy ? 'Lecture de la photo…' : 'Lire le planning'}
        </Button>
        <Button onClick={handleAiScan} disabled={busy || aiBusy} variant="secondary" className="w-full">
          <SearchIcon size={18} />
          {aiBusy ? 'Lecture IA…' : 'Lire avec l’IA (optionnel)'}
        </Button>
        <p className="text-center text-[11px] text-slate-400">
          IA : l’OCR est corrigé et structuré par DeepSeek (coût minime). En cas d’échec, la lecture classique reste disponible.
        </p>
      </div>
    </div>
  )
}
