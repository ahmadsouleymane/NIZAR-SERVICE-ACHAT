'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { runOcr } from '@/lib/planning/ocr'
import { parsePlanning, type ParsedPlanning } from '@/lib/planning/parse'
import { todayLocalISO } from '@/lib/fuel/calculations'
import { Button, Input, EmptyState } from '@/components/ui'
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
    setPreview(null)
    setPhotos([])
    alert('Planning enregistré ✓')
  }

  if (done && preview) {
    return (
      <div className="space-y-4">
        <PreviewTable planning={preview} onChange={setPreview} />
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le planning'}
          </Button>
          <Button variant="secondary" onClick={() => { setDone(false); setPreview(null) }}>
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="sc-date" label="Date du planning" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input id="sc-source" label="Libellé (ex. Feuille Agadez)" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Photo(s) du planning</label>
        <input
          data-testid="photo-input"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {photos.length > 0 ? <p className="mt-1 text-xs text-gray-500">{photos.length} photo(s) sélectionnée(s)</p> : null}
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <Button onClick={handleScan} disabled={busy}>
        {busy ? 'Lecture de la photo…' : 'Lire le planning'}
      </Button>

      {photos.length === 0 ? <EmptyState message="Photographiez la feuille de planning ou choisissez un fichier." /> : null}
    </div>
  )
}
