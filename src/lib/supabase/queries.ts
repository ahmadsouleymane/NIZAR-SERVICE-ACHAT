import type { Departure, Fueling, FuelPrice } from '@/lib/types'

type Supabase = {
  from: (table: string) => any
}

export async function fetchDeparturesForDate(supabase: Supabase, date: string): Promise<Departure[]> {
  const { data } = await supabase
    .from('departures')
    .select('*, plannings!inner(date)')
    .eq('plannings.date', date)
    .order('departure_time')
  return (data ?? []) as Departure[]
}

export async function fetchFuelingsForDate(supabase: Supabase, date: string): Promise<Fueling[]> {
  const { data } = await supabase
    .from('fuelings')
    .select('*')
    .eq('date', date)
    .order('created_at')
  return (data ?? []) as Fueling[]
}

export async function fetchFuelPrices(supabase: Supabase): Promise<FuelPrice[]> {
  const { data } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date')
  return (data ?? []) as FuelPrice[]
}
