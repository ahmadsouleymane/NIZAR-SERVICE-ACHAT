import { describe, it, expect } from 'vitest'
import { computeAmount, sumAmounts, formatFcfa, latestPrice, todayLocalISO } from '@/lib/fuel/calculations'
import type { FuelPrice } from '@/lib/types'

describe('computeAmount', () => {
  it('calcule litres × prix (arrondi entier FCFA)', () => {
    expect(computeAmount(300, 618)).toBe(185400)
    expect(computeAmount(300.5, 618)).toBe(185709) // 300.5 × 618 = 185709
    expect(computeAmount(0, 618)).toBe(0)
  })
})

describe('sumAmounts', () => {
  it('additionne les montants des reçus', () => {
    expect(sumAmounts([{ amount: 1000 }, { amount: 250 }, { amount: 40 }])).toBe(1290)
    expect(sumAmounts([])).toBe(0)
  })
})

describe('formatFcfa', () => {
  it('formate en FCFA avec séparateurs français', () => {
    expect(formatFcfa(185400)).toBe('185 400 FCFA')
    expect(formatFcfa(0)).toBe('0 FCFA')
  })
})

describe('latestPrice', () => {
  const prices: FuelPrice[] = [
    { id: '1', fuel_type: 'diesel', price: 600, effective_date: '2026-01-01', created_by: null, created_at: '' },
    { id: '2', fuel_type: 'diesel', price: 618, effective_date: '2026-07-01', created_by: null, created_at: '' },
    { id: '3', fuel_type: 'essence', price: 499, effective_date: '2026-07-01', created_by: null, created_at: '' },
  ]
  it('renvoie le dernier prix applicable avant la date', () => {
    expect(latestPrice(prices, 'diesel', '2026-07-15')).toBe(618)
    expect(latestPrice(prices, 'diesel', '2026-06-30')).toBe(600)
  })
  it('ignore les prix futurs', () => {
    expect(latestPrice(prices, 'diesel', '2026-01-01')).toBe(600)
  })
  it('renvoie null si aucun prix', () => {
    expect(latestPrice([], 'essence', '2026-01-01')).toBeNull()
  })
})

describe('todayLocalISO', () => {
  it('renvoie la date locale au format ISO (jj/mm/aaaa, pas UTC)', () => {
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
