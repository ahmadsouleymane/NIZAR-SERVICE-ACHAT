// Prédiction de la consommation de carburant d'un bus pour un départ.
// Priorité du taux de consommation (L/100km) :
//   1. le taux propre au bus (référentiel `buses`) si renseigné ;
//   2. sinon le taux global de l'application (Admin › Itinéraires) ;
//   3. sinon une valeur par défaut prudente, pour que la prédiction reste
//      toujours opérationnelle même avant tout paramétrage.
import type { Bus, Fueling, FuelPrice, FuelType } from '@/lib/types'
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

// Détection de surconsommation : au-delà de +15 % vs la prévision, on alerte
// (trajet anormal, fuite ou détournement de carburant). En dessous de -15 %,
// on signale une consommation inhabituellement basse (à vérifier).
export const OVERCONSUMPTION_THRESHOLD = 0.15

export type DeviationStatus = 'over' | 'normal' | 'under'

export function consumptionDeviation(
  actualLiters: number,
  predictedLiters: number | null
): { pct: number; status: DeviationStatus } | null {
  if (
    predictedLiters == null ||
    predictedLiters <= 0 ||
    !Number.isFinite(actualLiters) ||
    actualLiters <= 0
  ) {
    return null
  }
  const pct = (actualLiters - predictedLiters) / predictedLiters
  const status: DeviationStatus =
    pct > OVERCONSUMPTION_THRESHOLD ? 'over' : pct < -OVERCONSUMPTION_THRESHOLD ? 'under' : 'normal'
  return { pct, status }
}

// Consommation RÉELLE par bus (L/100km), méthode plein-à-plein : entre deux
// pleins successifs d'un même bus, distance = Δ odomètre, carburant = litres du
// 2e plein. On agrège toutes les paires valides pour lisser les écarts.
// Renvoie une Map bus_number (normalisé) → { l_per_100km, distanceKm, pairs }.
export function realConsumptionByBus(
  fuelings: Pick<Fueling, 'bus_number' | 'odometer_km' | 'liters' | 'date' | 'created_at'>[]
): Map<string, { lPer100km: number; distanceKm: number; pairs: number }> {
  const byBus = new Map<string, typeof fuelings>()
  for (const f of fuelings) {
    if (f.odometer_km == null) continue
    const key = f.bus_number.toUpperCase().replace(/\s+/g, '')
    if (!byBus.has(key)) byBus.set(key, [])
    byBus.get(key)!.push(f)
  }

  const result = new Map<string, { lPer100km: number; distanceKm: number; pairs: number }>()
  for (const [key, list] of byBus) {
    const sorted = [...list].sort((a, b) =>
      a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date.localeCompare(b.date)
    )
    let totalDist = 0
    let totalLiters = 0
    let pairs = 0
    for (let i = 1; i < sorted.length; i++) {
      const dist = Number(sorted[i].odometer_km) - Number(sorted[i - 1].odometer_km)
      const liters = Number(sorted[i].liters)
      if (dist > 0 && liters > 0) {
        totalDist += dist
        totalLiters += liters
        pairs++
      }
    }
    if (pairs > 0 && totalDist > 0) {
      result.set(key, {
        lPer100km: Math.round((totalLiters / totalDist) * 100 * 10) / 10,
        distanceKm: totalDist,
        pairs,
      })
    }
  }
  return result
}
