import type { SupabaseClient } from '@supabase/supabase-js'
import type { Departure, Fueling, FuelPrice } from '@/lib/types'

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
