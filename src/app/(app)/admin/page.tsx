import { createClient } from '@/lib/supabase/server'
import type { FuelPrice, Profile } from '@/lib/types'
import { PricesPanel } from '@/components/admin/PricesPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'admin') {
    return <p className="text-sm text-red-600">Accès réservé à l&apos;administrateur.</p>
  }

  const [{ data: prices }, { data: profiles }] = await Promise.all([
    supabase.from('fuel_prices').select('*').order('effective_date'),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Prix du carburant</h2>
        <PricesPanel initialPrices={(prices ?? []) as FuelPrice[]} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Utilisateurs</h2>
        <UsersPanel initialProfiles={(profiles ?? []) as Profile[]} />
      </section>
    </div>
  )
}
