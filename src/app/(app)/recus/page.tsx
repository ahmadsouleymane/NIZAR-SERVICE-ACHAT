import { createClient } from '@/lib/supabase/server'
import type { Fueling } from '@/lib/types'
import { ReceiptIcon } from '@/components/ui/icons'
import { ReceiptsList } from '@/components/history/ReceiptsList'

export type ReceiptWithUrl = Fueling & { receipt_photo_urls: string[]; axis: string | null }

export default async function RecusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // "departures(axis)" fournit l'axe (provenance/destination) du départ lié, pour le rapport.
  const [{ data }, { data: profile }] = await Promise.all([
    supabase.from('fuelings').select('*, departures(axis)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
  ])

  // Le bucket "receipts" est privé : on génère une URL signée (1 h) pour chaque
  // photo de reçu (plusieurs possibles), sans exposer la ressource publiquement.
  const fuelings: ReceiptWithUrl[] = await Promise.all(
    (data ?? []).map(async (f) => {
      const paths: string[] =
        f.receipt_photo_paths?.length
          ? f.receipt_photo_paths
          : f.receipt_photo_path
            ? [f.receipt_photo_path]
            : []
      const urls = (
        await Promise.all(
          paths.map(async (p: string) => {
            const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(p, 3600)
            return signed?.signedUrl ?? null
          })
        )
      ).filter((u): u is string => u !== null)
      const { departures, ...rest } = f
      return { ...rest, receipt_photo_urls: urls, axis: departures?.axis ?? null }
    })
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <ReceiptIcon size={24} className="text-blue-600" />
          Historique des reçus
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tous les pleins enregistrés, filtrables par statut.</p>
      </div>
      <ReceiptsList fuelings={fuelings} isAdmin={profile?.role === 'admin'} />
    </div>
  )
}
