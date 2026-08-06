import { createClient } from '@/lib/supabase/server'
import type { Fueling } from '@/lib/types'
import { ReceiptIcon } from '@/components/ui/icons'
import { ReceiptsList } from '@/components/history/ReceiptsList'

export default async function RecusPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('fuelings').select('*').order('created_at', { ascending: false })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <ReceiptIcon size={24} className="text-blue-600" />
          Historique des reçus
        </h1>
        <p className="mt-1 text-sm text-slate-500">Tous les pleins enregistrés, filtrables par statut.</p>
      </div>
      <ReceiptsList fuelings={(data ?? []) as Fueling[]} />
    </div>
  )
}
