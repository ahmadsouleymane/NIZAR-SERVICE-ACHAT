import type { SupabaseClient } from '@supabase/supabase-js'
import type { Bus, Departure, Fueling, FuelPrice, RouteSegment } from '@/lib/types'
import { parseConsumptionRate } from '@/lib/planning/route'

export async function fetchDeparturesForDate(supabase: SupabaseClient, date: string): Promise<Departure[]> {
  const { data } = await supabase
    .from('departures')
    .select('*, plannings!inner(date)')
    .eq('plannings.date', date)
    .order('departure_time')
  return (data ?? []) as Departure[]
}

export async function fetchFuelingsForDate(supabase: SupabaseClient, date: string): Promise<Fueling[]> {
  const { data } = await supabase
    .from('fuelings')
    .select('*')
    .eq('date', date)
    .order('created_at')
  return (data ?? []) as Fueling[]
}

export async function fetchFuelPrices(supabase: SupabaseClient): Promise<FuelPrice[]> {
  const { data } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date')
  return (data ?? []) as FuelPrice[]
}

export async function fetchRouteSegments(supabase: SupabaseClient): Promise<RouteSegment[]> {
  const { data } = await supabase.from('route_segments').select('*').order('city_a')
  return (data ?? []) as RouteSegment[]
}

export async function fetchBuses(supabase: SupabaseClient): Promise<Bus[]> {
  const { data } = await supabase.from('buses').select('*').order('bus_number')
  return (data ?? []) as Bus[]
}

export async function fetchConsumptionRate(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'consumption_l_per_100km')
    .maybeSingle()
  return parseConsumptionRate(data?.value ?? null)
}
