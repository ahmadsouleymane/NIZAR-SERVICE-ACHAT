import { describe, it, expect } from 'vitest'
import {
  normalizeCityName,
  parseRoute,
  computeDistanceKm,
  predictedLiters,
  parseConsumptionRate,
  type RouteSegmentInput,
} from '@/lib/planning/route'

describe('normalizeCityName', () => {
  it('met en majuscules et compacte les espaces', () => {
    expect(normalizeCityName('  niamey   ')).toBe('NIAMEY')
    expect(normalizeCityName('Dosso  Doutchi')).toBe('DOSSO DOUTCHI')
  })
})

describe('parseRoute', () => {
  it('découpe un axe direct en deux villes', () => {
    expect(parseRoute('AGADEZ - NIAMEY')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('découpe un axe avec une ville de passage', () => {
    expect(parseRoute('NIAMEY - LOGA - AGADEZ')).toEqual(['NIAMEY', 'LOGA', 'AGADEZ'])
  })
  it('retire le suffixe SPECIAL collé à la dernière ville', () => {
    expect(parseRoute('AGADEZ - NIAMEY SPECIAL')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('retire le qualificatif ENCOUR (service, pas une ville)', () => {
    expect(parseRoute('AGADEZ - NIAMEY ENCOUR')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('réduit ARLIT - REPOS à la seule ville de départ', () => {
    expect(parseRoute('ARLIT - REPOS')).toEqual(['ARLIT'])
  })
  it('découpe un axe collé sans espaces et retire SPECIAL collé', () => {
    expect(parseRoute('ZINDER-LOGA-NIAMEYSPECIAL')).toEqual(['ZINDER', 'LOGA', 'NIAMEY'])
  })
  it('découpe AGADEZ-NIAMEYENCOUR (qualificatif collé)', () => {
    expect(parseRoute('AGADEZ-NIAMEYENCOUR')).toEqual(['AGADEZ', 'NIAMEY'])
  })
  it('ignore un tiret de tête et découpe DOUTCHI-BAGAROUA', () => {
    expect(parseRoute('— DOUTCHI-BAGAROUA')).toEqual(['DOUTCHI', 'BAGAROUA'])
  })
  it('découpe un axe sans espaces simple', () => {
    expect(parseRoute('INGAL-AGADEZ')).toEqual(['INGAL', 'AGADEZ'])
  })
  it('retire NUIT même en position de ville', () => {
    expect(parseRoute('NUIT - GAYA')).toEqual(['GAYA'])
  })
  it('renvoie un tableau vide pour un axe vide', () => {
    expect(parseRoute('')).toEqual([])
  })
})

describe('computeDistanceKm', () => {
  const segments: RouteSegmentInput[] = [
    { cityA: 'NIAMEY', cityB: 'AGADEZ', distanceKm: 951 },
    { cityA: 'NIAMEY', cityB: 'LOGA', distanceKm: 139 },
  ]

  it('trouve un tronçon direct', () => {
    expect(computeDistanceKm(['NIAMEY', 'AGADEZ'], segments)).toBe(951)
  })
  it('trouve un tronçon stocké dans le sens inverse', () => {
    expect(computeDistanceKm(['AGADEZ', 'NIAMEY'], segments)).toBe(951)
  })
  it('additionne une chaîne de tronçons', () => {
    const withLogaAgadez = [...segments, { cityA: 'LOGA', cityB: 'AGADEZ', distanceKm: 850 }]
    expect(computeDistanceKm(['NIAMEY', 'LOGA', 'AGADEZ'], withLogaAgadez)).toBe(139 + 850)
  })
  it('renvoie null si un tronçon de la chaîne manque', () => {
    expect(computeDistanceKm(['NIAMEY', 'LOGA', 'AGADEZ'], segments)).toBeNull()
  })
  it('renvoie null pour moins de deux villes', () => {
    expect(computeDistanceKm(['GAYA'], segments)).toBeNull()
    expect(computeDistanceKm([], segments)).toBeNull()
  })
})

describe('predictedLiters', () => {
  it('calcule les litres prévus et arrondit', () => {
    expect(predictedLiters(951, 30)).toBe(285)
  })
  it('renvoie null si la distance est inconnue', () => {
    expect(predictedLiters(null, 30)).toBeNull()
  })
  it('renvoie null si le taux est absent ou invalide', () => {
    expect(predictedLiters(951, null)).toBeNull()
    expect(predictedLiters(951, 0)).toBeNull()
  })
  it('renvoie null pour des entrées non finies ou négatives', () => {
    expect(predictedLiters(NaN, 30)).toBeNull()
    expect(predictedLiters(951, Infinity)).toBeNull()
    expect(predictedLiters(-100, 30)).toBeNull()
  })
})

describe('parseConsumptionRate', () => {
  it('parse une valeur texte valide', () => {
    expect(parseConsumptionRate('30')).toBe(30)
    expect(parseConsumptionRate('27.5')).toBe(27.5)
  })
  it('renvoie null pour une valeur absente ou invalide', () => {
    expect(parseConsumptionRate(null)).toBeNull()
    expect(parseConsumptionRate(undefined)).toBeNull()
    expect(parseConsumptionRate('abc')).toBeNull()
    expect(parseConsumptionRate('0')).toBeNull()
    expect(parseConsumptionRate('-5')).toBeNull()
  })
})
