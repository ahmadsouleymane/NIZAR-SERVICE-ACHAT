import { createClient } from '@/lib/supabase/server'
import type { Bus, Driver, FuelPrice, Profile, RouteSegment } from '@/lib/types'
import { parseConsumptionRate } from '@/lib/planning/route'
import { latestOdometerByBus } from '@/lib/fuel/maintenance'
import { DropletIcon, UsersIcon, BusIcon } from '@/components/ui/icons'
import { PricesPanel } from '@/components/admin/PricesPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { RoutesPanel } from '@/components/admin/RoutesPanel'
import { BusesPanel } from '@/components/admin/BusesPanel'
import { DriversPanel } from '@/components/admin/DriversPanel'

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

  const [{ data: prices }, { data: profiles }, { data: segments }, { data: setting }, { data: buses }, { data: odoRows }] = await Promise.all([
    supabase.from('fuel_prices').select('*').order('effective_date'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('route_segments').select('*').order('city_a'),
    supabase.from('app_settings').select('*').eq('key', 'consumption_l_per_100km').maybeSingle(),
    supabase.from('buses').select('*').order('bus_number'),
    supabase.from('fuelings').select('bus_number, odometer_km').not('odometer_km', 'is', null),
  ])

  const { data: drivers } = await supabase.from('drivers').select('*').order('full_name')

  const latestOdometer = Object.fromEntries(
    latestOdometerByBus((odoRows ?? []) as { bus_number: string; odometer_km: number | null }[])
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">Prix du carburant, itinéraires et comptes utilisateurs.</p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <DropletIcon size={18} className="text-blue-600" />
          Prix du carburant
        </h2>
        <PricesPanel initialPrices={(prices ?? []) as FuelPrice[]} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <BusIcon size={18} className="text-blue-600" />
          Bus & consommation
        </h2>
        <BusesPanel initialBuses={(buses ?? []) as Bus[]} latestOdometer={latestOdometer} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <BusIcon size={18} className="text-blue-600" />
          Itinéraires
        </h2>
        <RoutesPanel
          initialSegments={(segments ?? []) as RouteSegment[]}
          initialConsumptionRate={parseConsumptionRate(setting?.value ?? null)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <UsersIcon size={18} className="text-blue-600" />
          Chauffeurs
        </h2>
        <DriversPanel initialDrivers={(drivers ?? []) as Driver[]} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <UsersIcon size={18} className="text-blue-600" />
          Utilisateurs
        </h2>
        <UsersPanel initialProfiles={(profiles ?? []) as Profile[]} />
      </section>
    </div>
  )
}
