import type { FuelPrice, FuelType } from '@/lib/types'

export function computeAmount(liters: number, unitPrice: number): number {
  return Math.round(liters * unitPrice)
}

export function sumAmounts(fuelings: { amount: number }[]): number {
  return fuelings.reduce((sum, f) => sum + f.amount, 0)
}

export function formatFcfa(amount: number): string {
  const s = Math.round(amount).toString()
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${grouped} FCFA`
}

export function latestPrice(prices: FuelPrice[], type: FuelType, onDate: string): number | null {
  const candidates = prices.filter(
    (p) => p.fuel_type === type && p.effective_date <= onDate
  )
  if (candidates.length === 0) return null
  const best = candidates.reduce((a, b) =>
    a.effective_date > b.effective_date ? a : b
  )
  return best.price
}

export function todayLocalISO(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}
