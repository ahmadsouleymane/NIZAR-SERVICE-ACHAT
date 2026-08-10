import { createClient } from '@/lib/supabase/server'
import type { Fueling } from '@/lib/types'
import { ReceiptIcon } from '@/components/ui/icons'
import { ReceiptsList } from '@/components/history/ReceiptsList'

export type ReceiptWithUrl = Fueling & { receipt_photo_url: string | null }

export default async function RecusPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('fuelings').select('*').order('created_at', { ascending: false })

  // Le bucket "receipts" est privé : on génère une URL signée (1 h) pour chaque
  // reçu, affichable dans le navigateur sans exposer la ressource publiquement.
  const fuelings: ReceiptWithUrl[] = await Promise.all(
    (data ?? []).map(async (f) => {
      if (!f.receipt_photo_path) return { ...f, receipt_photo_url: null }
      const { data: signed } = await supabase.storage
        .from('receipts')
        .createSignedUrl(f.receipt_photo_path, 3600)
      return { ...f, receipt_photo_url: signed?.signedUrl ?? null }
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
      <ReceiptsList fuelings={fuelings} />
    </div>
  )
}
