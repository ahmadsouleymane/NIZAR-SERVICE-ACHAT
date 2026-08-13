export type Role = 'admin' | 'achat'
export type FuelType = 'essence' | 'diesel'

export interface Profile {
  id: string
  full_name: string
  username: string | null
  role: Role
  created_at: string
}

export interface Planning {
  id: string
  date: string
  source_label: string
  image_urls: string[]
  created_by: string | null
  created_at: string
}

export interface Departure {
  id: string
  planning_id: string
  axis: string
  bus_number: string
  departure_time: string
  driver_name: string
  driver_phone: string
  backup_driver: string | null
  backup_phone: string | null
}

export interface FuelPrice {
  id: string
  fuel_type: FuelType
  price: number
  effective_date: string
  created_by: string | null
  created_at: string
}

export interface Bus {
  bus_number: string
  label: string
  fuel_type: FuelType
  consumption_l_per_100km: number | null
  tank_capacity_l: number | null
  created_by: string | null
  created_at: string
}

export interface RouteSegment {
  id: string
  city_a: string
  city_b: string
  distance_km: number
  created_by: string | null
  created_at: string
}

export interface Fueling {
  id: string
  date: string
  departure_id: string | null
  bus_number: string
  driver_name: string
  fuel_type: FuelType
  liters: number
  unit_price: number
  amount: number
  paid: boolean
  paid_at: string | null
  receipt_photo_path: string | null
  receipt_photo_paths: string[]
  recorded_by: string | null
  created_at: string
}

export interface DepartureWithFuel extends Departure {
  fuelings: Fueling[]
}
