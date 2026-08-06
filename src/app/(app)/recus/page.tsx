import { createClient } from '@/lib/supabase/server'
import type { Fueling } from '@/lib/types'
import { ReceiptsList } from '@/components/history/ReceiptsList'

export default async function RecusPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('fuelings').select('*').order('created_at', { ascending: false })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Historique des reçus</h1>
      <ReceiptsList fuelings={(data ?? []) as Fueling[]} />
    </div>
  )
}
