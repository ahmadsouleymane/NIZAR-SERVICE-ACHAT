// Prédiction de la consommation de carburant d'un bus pour un départ.
// Priorité du taux de consommation (L/100km) :
//   1. le taux propre au bus (référentiel `buses`) si renseigné ;
//   2. sinon le taux global de l'application (Admin › Itinéraires) ;
//   3. sinon une valeur par défaut prudente, pour que la prédiction reste
//      toujours opérationnelle même avant tout paramétrage.
import type { Bus, FuelPrice, FuelType } from '@/lib/types'
import { computeAmount, latestPrice } from '@/lib/fuel/calculations'

// Bus diesel type Yutong (valeur provisoire, ajustable dans Admin).
export const DEFAULT_CONSUMPTION_L_PER_100KM = 30

export type RateSource = 'bus' | 'global' | 'default'

// Comparaison robuste : on ignore la casse ET tous les espaces, car l'OCR écrit
// tantôt « CG 6377 », tantôt « CG6377 ».
function busKey(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '')
}

export function findBus(buses: Bus[], busNumber: string): Bus | null {
  const key = busKey(busNumber)
  return buses.find((b) => busKey(b.bus_number) === key) ?? null
}

export function resolveConsumptionRate(
  bus: Bus | null,
  globalRate: number | null
): { rate: number; source: RateSource } {
  if (bus?.consumption_l_per_100km && bus.consumption_l_per_100km > 0) {
    return { rate: bus.consumption_l_per_100km, source: 'bus' }
  }
  if (globalRate && globalRate > 0) {
    return { rate: globalRate, source: 'global' }
  }
  return { rate: DEFAULT_CONSUMPTION_L_PER_100KM, source: 'default' }
}

export interface FuelPredictionInput {
  distanceKm: number | null
  busNumber: string
  buses: Bus[]
  globalRate: number | null
  prices: FuelPrice[]
  onDate: string
}

export interface FuelPrediction {
  distanceKm: number | null
  liters: number | null
  cost: number | null
  fuelType: FuelType
  ratePer100km: number
  rateSource: RateSource
}

export function predictFuel(input: FuelPredictionInput): FuelPrediction {
  const { distanceKm, busNumber, buses, globalRate, prices, onDate } = input
  const bus = findBus(buses, busNumber)
  const { rate, source } = resolveConsumptionRate(bus, globalRate)
  const fuelType: FuelType = bus?.fuel_type ?? 'diesel'

  let liters: number | null = null
  let cost: number | null = null
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm >= 0) {
    liters = Math.round((distanceKm * rate) / 100)
    const unitPrice = latestPrice(prices, fuelType, onDate)
    if (unitPrice != null) cost = computeAmount(liters, unitPrice)
  }

  return { distanceKm, liters, cost, fuelType, ratePer100km: rate, rateSource: source }
}
