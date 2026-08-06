import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PricesPanel } from '@/components/admin/PricesPanel'
import type { FuelPrice } from '@/lib/types'

const prices: FuelPrice[] = [
  { id: '1', fuel_type: 'diesel', price: 618, effective_date: '2026-08-01', created_by: null, created_at: '' },
  { id: '2', fuel_type: 'essence', price: 499, effective_date: '2026-08-01', created_by: null, created_at: '' },
]

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'fuel_prices'
        ? { insert: mockInsert, select: () => ({ order: () => Promise.resolve({ data: prices }) }) }
        : { select: () => ({ order: () => Promise.resolve({ data: [] }) }) },
  }),
}))

describe('PricesPanel', () => {
  it('affiche les prix actuels essence et diesel', () => {
    render(<PricesPanel initialPrices={prices} />)
    expect(screen.getAllByText('618 FCFA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('499 FCFA').length).toBeGreaterThan(0)
  })

  it('enregistre un nouveau prix', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<PricesPanel initialPrices={prices} />)
    fireEvent.change(screen.getByLabelText(/type de carburant/i), { target: { value: 'diesel' } })
    fireEvent.change(screen.getByLabelText(/prix du litre/i), { target: { value: '650' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le prix/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ fuel_type: 'diesel', price: 650 })
  })
})
