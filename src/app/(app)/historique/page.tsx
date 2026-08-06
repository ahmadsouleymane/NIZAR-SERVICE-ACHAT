import { createClient } from '@/lib/supabase/server'
import type { Planning } from '@/lib/types'
import { ClockIcon } from '@/components/ui/icons'
import { PlanningsList } from '@/components/history/PlanningsList'

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data } = await supabase.from('plannings').select('*').order('date', { ascending: false })
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
          <ClockIcon size={24} className="text-blue-600" />
          Historique des plannings
        </h1>
        <p className="mt-1 text-sm text-slate-500">Retrouvez les plannings scannés et leurs photos.</p>
      </div>
      <PlanningsList plannings={(data ?? []) as Planning[]} />
    </div>
  )
}
