import { describe, it, expect } from 'vitest'
import type { Bus, FuelPrice } from '@/lib/types'
import {
  predictFuel,
  resolveConsumptionRate,
  findBus,
  DEFAULT_CONSUMPTION_L_PER_100KM,
} from '@/lib/fuel/prediction'

const bus = (over: Partial<Bus> = {}): Bus => ({
  bus_number: 'CG 6377',
  label: '',
  fuel_type: 'diesel',
  consumption_l_per_100km: 35,
  tank_capacity_l: null,
  created_by: null,
  created_at: '',
  ...over,
})

const price = (over: Partial<FuelPrice> = {}): FuelPrice => ({
  id: 'p1',
  fuel_type: 'diesel',
  price: 600,
  effective_date: '2026-08-01',
  created_by: null,
  created_at: '',
  ...over,
})

describe('findBus', () => {
  it('retrouve le bus indépendamment de la casse et des espaces', () => {
    const buses = [bus({ bus_number: 'CG 6377' })]
    expect(findBus(buses, 'cg6377')?.bus_number).toBe('CG 6377')
    expect(findBus(buses, '  CG   6377 ')?.bus_number).toBe('CG 6377')
    expect(findBus(buses, 'ZZ 0000')).toBeNull()
  })
})

describe('resolveConsumptionRate', () => {
  it('prend le taux du bus en priorité', () => {
    expect(resolveConsumptionRate(bus({ consumption_l_per_100km: 42 }), 30)).toEqual({ rate: 42, source: 'bus' })
  })
  it('retombe sur le taux global si le bus n’a pas de taux', () => {
    expect(resolveConsumptionRate(bus({ consumption_l_per_100km: null }), 28)).toEqual({ rate: 28, source: 'global' })
  })
  it('retombe sur la valeur par défaut si rien n’est défini', () => {
    expect(resolveConsumptionRate(null, null)).toEqual({ rate: DEFAULT_CONSUMPTION_L_PER_100KM, source: 'default' })
  })
})

describe('predictFuel', () => {
  it('calcule litres et coût à partir des données du bus et de la distance', () => {
    const p = predictFuel({
      distanceKm: 951,
      busNumber: 'CG 6377',
      buses: [bus({ consumption_l_per_100km: 30, fuel_type: 'diesel' })],
      globalRate: null,
      prices: [price({ price: 600 })],
      onDate: '2026-08-10',
    })
    expect(p.liters).toBe(285) // round(951 * 30 / 100)
    expect(p.cost).toBe(171000) // 285 * 600
    expect(p.rateSource).toBe('bus')
    expect(p.fuelType).toBe('diesel')
  })

  it('renvoie des valeurs nulles si la distance est inconnue', () => {
    const p = predictFuel({
      distanceKm: null,
      busNumber: 'CG 6377',
      buses: [bus()],
      globalRate: 30,
      prices: [price()],
      onDate: '2026-08-10',
    })
    expect(p.liters).toBeNull()
    expect(p.cost).toBeNull()
  })

  it('prédit les litres même sans prix (coût nul)', () => {
    const p = predictFuel({
      distanceKm: 100,
      busNumber: 'ZZ 0000',
      buses: [],
      globalRate: null,
      prices: [],
      onDate: '2026-08-10',
    })
    expect(p.liters).toBe(30) // 100 * 30(défaut) / 100
    expect(p.cost).toBeNull()
    expect(p.rateSource).toBe('default')
  })
})
