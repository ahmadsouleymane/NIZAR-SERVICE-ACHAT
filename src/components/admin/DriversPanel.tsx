'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Driver } from '@/lib/types'
import { Button, Input, Card, ConfirmDeleteButton } from '@/components/ui'
import { AlertIcon, PencilIcon } from '@/components/ui/icons'

interface Props {
  initialDrivers: Driver[]
}

export function DriversPanel({ initialDrivers }: Props) {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data, error } = await supabase.from('drivers').select('*').order('full_name')
    if (error) { setError(error.message); return }
    setDrivers((data ?? []) as Driver[])
  }

  function resetForm() {
    setFullName('')
    setPhone('')
    setEditingId(null)
  }

  function handleEdit(d: Driver) {
    setFullName(d.full_name)
    setPhone(d.phone)
    setEditingId(d.id)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const name = fullName.trim().toUpperCase()
    if (!name) { setError('Saisissez le nom du chauffeur.'); return }
    setBusy(true)
    const payload = { full_name: name, phone: phone.trim() }
    const { error } = editingId
      ? await supabase.from('drivers').update(payload).eq('id', editingId)
      : await supabase.from('drivers').insert(payload)
    setBusy(false)
    if (error) { setError(error.message); return }
    resetForm()
    await refresh()
  }

  async function handleDelete(id: string) {
    setBusy(true)
    const { error } = await supabase.from('drivers').delete().eq('id', id)
    setBusy(false)
    if (error) { setError(error.message); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-bold text-slate-900">
          {editingId ? 'Modifier un chauffeur' : 'Ajouter un chauffeur'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input id="d-name" label="Nom" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input id="d-phone" label="Téléphone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? '…' : editingId ? 'Mettre à jour' : 'Ajouter'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>
                Annuler
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <Card title="Chauffeurs enregistrés">
        {drivers.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">Aucun chauffeur enregistré.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {drivers.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{d.full_name}</div>
                  <div className="text-xs text-slate-500">{d.phone || '—'}</div>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <button type="button" aria-label={`Modifier ${d.full_name}`} onClick={() => handleEdit(d)} className="text-blue-600 hover:text-blue-700">
                    <PencilIcon size={16} />
                  </button>
                  <ConfirmDeleteButton label={`Supprimer ${d.full_name}`} onConfirm={() => handleDelete(d.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
