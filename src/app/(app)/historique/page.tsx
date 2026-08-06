import { createClient } from '@/lib/supabase/server'
import type { Planning } from '@/lib/types'
import { PlanningsList } from '@/components/history/PlanningsList'

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('plannings').select('*').order('date', { ascending: false })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Historique des plannings</h1>
      <PlanningsList plannings={(data ?? []) as Planning[]} />
    </div>
  )
}
