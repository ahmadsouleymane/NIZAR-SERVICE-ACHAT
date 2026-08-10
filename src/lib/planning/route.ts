const ROUTE_STOPWORDS = new Set(['SPECIAL', 'REPOS', 'NUIT'])

export function normalizeCityName(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ')
}

export function parseRoute(axis: string): string[] {
  return axis
    .split(' - ')
    .map((part) =>
      part
        .split(/\s+/)
        .filter((tok) => tok.length > 0 && !ROUTE_STOPWORDS.has(tok.toUpperCase()))
        .join(' ')
    )
    .map((part) => normalizeCityName(part))
    .filter((part) => part.length > 0)
}

export interface RouteSegmentInput {
  cityA: string
  cityB: string
  distanceKm: number
}

export function computeDistanceKm(cities: string[], segments: RouteSegmentInput[]): number | null {
  if (cities.length < 2) return null
  let total = 0
  for (let i = 0; i < cities.length - 1; i++) {
    const a = cities[i]
    const b = cities[i + 1]
    const seg = segments.find(
      (s) => (s.cityA === a && s.cityB === b) || (s.cityA === b && s.cityB === a)
    )
    if (!seg) return null
    total += seg.distanceKm
  }
  return total
}

export function predictedLiters(distanceKm: number | null, ratePer100km: number | null): number | null {
  if (distanceKm == null || ratePer100km == null || ratePer100km <= 0) return null
  return Math.round((distanceKm * ratePer100km) / 100)
}

export function parseConsumptionRate(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}
