'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Planning } from '@/lib/types'
import { ChevronDownIcon, CameraIcon } from '@/components/ui/icons'
import { ConfirmDeleteButton } from '@/components/ui'

// Retrouve le chemin de stockage (relatif au bucket) à partir d'une URL publique.
function storagePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

export function PlanningsList({ plannings, isAdmin = false }: { plannings: Planning[]; isAdmin?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [list, setList] = useState(plannings)
  const supabase = createClient()
  const router = useRouter()
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))

  async function handleDelete(p: Planning) {
    const paths = p.image_urls
      .map((u) => storagePathFromUrl(u, 'plannings'))
      .filter((path): path is string => path !== null)
    if (paths.length > 0) {
      // Best-effort : le nettoyage du stockage ne doit pas bloquer la suppression.
      await supabase.storage.from('plannings').remove(paths).catch(() => {})
    }
    const { error } = await supabase.from('plannings').delete().eq('id', p.id)
    if (!error) {
      setList((prev) => prev.filter((x) => x.id !== p.id))
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const open = openId === p.id
        return (
          <div key={p.id} data-testid="planning-row" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex w-full items-center gap-3 px-4 py-3.5">
              <button
                className="flex flex-1 items-center justify-between gap-3 text-left"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : p.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <CameraIcon size={20} />
                  </span>
                  <div>
                    <div className="tabular text-sm font-bold text-slate-900">{p.date}</div>
                    <div className="text-xs text-slate-500">
                      {p.source_label || 'Planning'} · {p.image_urls.length} photo{p.image_urls.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <ChevronDownIcon
                  size={20}
                  className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {isAdmin ? (
                <ConfirmDeleteButton
                  label={`Supprimer le planning du ${p.date}`}
                  onConfirm={() => handleDelete(p)}
                  className="shrink-0"
                />
              ) : null}
            </div>
            {open ? (
              <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-2">
                {p.image_urls.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune photo enregistrée.</p>
                ) : (
                  p.image_urls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={`Photo du planning ${p.date}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
                    />
                  ))
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
