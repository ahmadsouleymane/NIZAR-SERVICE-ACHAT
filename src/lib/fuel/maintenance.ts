// Statut d'entretien d'un bus : à partir de l'intervalle de révision, du
// kilométrage au dernier entretien et du dernier odomètre relevé (via les
// pleins), on calcule les km parcourus depuis la révision et ceux restants.
import type { Bus, Fueling } from '@/lib/types'

export interface MaintenanceStatus {
  kmSinceService: number
  kmRemaining: number
  due: boolean // révision dépassée ou imminente (< 10 % restants)
}

export function maintenanceStatus(
  bus: Pick<Bus, 'service_interval_km' | 'last_service_km'>,
  latestOdometerKm: number | null
): MaintenanceStatus | null {
  const interval = bus.service_interval_km
  if (interval == null || interval <= 0 || latestOdometerKm == null) return null
  const base = bus.last_service_km ?? 0
  const kmSinceService = Math.max(0, latestOdometerKm - base)
  const kmRemaining = Math.round(interval - kmSinceService)
  return {
    kmSinceService: Math.round(kmSinceService),
    kmRemaining,
    due: kmRemaining <= interval * 0.1,
  }
}

// Dernier odomètre connu par bus (max sur tous les pleins renseignés).
export function latestOdometerByBus(
  fuelings: Pick<Fueling, 'bus_number' | 'odometer_km'>[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const f of fuelings) {
    if (f.odometer_km == null) continue
    const key = f.bus_number.toUpperCase().replace(/\s+/g, '')
    const prev = map.get(key)
    if (prev == null || f.odometer_km > prev) map.set(key, Number(f.odometer_km))
  }
  return map
}
