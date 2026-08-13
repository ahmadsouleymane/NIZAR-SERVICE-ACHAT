import { describe, it, expect } from 'vitest'
import type { Bus, FuelPrice } from '@/lib/types'
import {
  predictFuel,
  resolveConsumptionRate,
  findBus,
  consumptionDeviation,
  realConsumptionByBus,
  DEFAULT_CONSUMPTION_L_PER_100KM,
} from '@/lib/fuel/prediction'

const bus = (over: Partial<Bus> = {}): Bus => ({
  bus_number: 'CG 6377',
  label: '',
  fuel_type: 'diesel',
  consumption_l_per_100km: 35,
  tank_capacity_l: null,
  service_interval_km: null,
  last_service_km: null,
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

describe('consumptionDeviation', () => {
  it('signale une surconsommation au-delà de +15 %', () => {
    expect(consumptionDeviation(120, 100)?.status).toBe('over') // +20 %
  })
  it('considère normal un écart dans les ±15 %', () => {
    expect(consumptionDeviation(110, 100)?.status).toBe('normal') // +10 %
    expect(consumptionDeviation(90, 100)?.status).toBe('normal') // -10 %
  })
  it('signale une consommation anormalement basse sous -15 %', () => {
    expect(consumptionDeviation(80, 100)?.status).toBe('under') // -20 %
  })
  it('renvoie null si la prévision est absente ou les litres invalides', () => {
    expect(consumptionDeviation(100, null)).toBeNull()
    expect(consumptionDeviation(0, 100)).toBeNull()
    expect(consumptionDeviation(100, 0)).toBeNull()
  })
})

describe('realConsumptionByBus', () => {
  const f = (over: Partial<{ bus_number: string; odometer_km: number | null; liters: number; date: string; created_at: string }>) => ({
    bus_number: 'CG 6377', odometer_km: null as number | null, liters: 0, date: '2026-08-01', created_at: '', ...over,
  })

  it('calcule la conso plein-à-plein (litres du 2e plein / Δ km × 100)', () => {
    const readings = [
      f({ odometer_km: 100000, liters: 300, date: '2026-08-01' }),
      f({ odometer_km: 101000, liters: 300, date: '2026-08-05' }), // 300 L / 1000 km = 30
      f({ odometer_km: 102000, liters: 300, date: '2026-08-10' }), // idem
    ]
    const map = realConsumptionByBus(readings)
    expect(map.get('CG6377')?.lPer100km).toBe(30)
    expect(map.get('CG6377')?.pairs).toBe(2)
  })

  it('ignore les bus sans odomètre et les paires incohérentes', () => {
    const readings = [
      f({ bus_number: 'BM 1', odometer_km: null, liters: 200 }),
      f({ bus_number: 'BM 2', odometer_km: 5000, liters: 100, date: '2026-08-01' }),
      f({ bus_number: 'BM 2', odometer_km: 4000, liters: 100, date: '2026-08-02' }), // recul → ignoré
    ]
    const map = realConsumptionByBus(readings)
    expect(map.has('BM1')).toBe(false)
    expect(map.has('BM2')).toBe(false)
  })
})
