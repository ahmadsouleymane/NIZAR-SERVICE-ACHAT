import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FuelingForm } from '@/components/fuel/FuelingForm'
import { todayLocalISO } from '@/lib/fuel/calculations'
import type { DepartureWithFuel, FuelPrice } from '@/lib/types'

const departure: DepartureWithFuel = {
  id: 'd1',
  planning_id: 'p1',
  axis: 'AGADEZ - NIAMEY',
  bus_number: 'CG 6377',
  departure_time: '05 H 00',
  driver_name: 'YOUSSOUF',
  driver_phone: '96474717',
  backup_driver: null,
  backup_phone: null,
  fuelings: [],
}

const prices: FuelPrice[] = [
  { id: '1', fuel_type: 'diesel', price: 618, effective_date: '2026-08-01', created_by: null, created_at: '' },
  { id: '2', fuel_type: 'essence', price: 499, effective_date: '2026-08-01', created_by: null, created_at: '' },
]

const mockInsert = vi.fn()
const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'fuelings'
        ? { insert: mockInsert }
        : { select: () => ({ order: () => Promise.resolve({ data: prices }) }) },
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

describe('FuelingForm', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockUpload.mockClear()
    mockGetPublicUrl.mockClear()
  })

  it('pré-remplit bus et chauffeur depuis le départ', () => {
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    expect(screen.getByText('CG 6377')).toBeInTheDocument()
    expect(screen.getByText(/YOUSSOUF/)).toBeInTheDocument()
  })

  it('calcule le montant automatiquement (litres × prix diesel)', async () => {
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    // attendre que le prix du litre soit chargé et affiché
    await screen.findByText('618 FCFA')
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    expect(screen.getByTestId('amount')).toHaveTextContent('185 400 FCFA')
  })

  it('enregistre le reçu avec bus, chauffeur, prix et montant', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    await screen.findByText('618 FCFA')
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const arg = mockInsert.mock.calls[0][0]
    expect(arg).toMatchObject({
      date: todayLocalISO(),
      departure_id: 'd1',
      bus_number: 'CG 6377',
      driver_name: 'YOUSSOUF',
      fuel_type: 'diesel',
      liters: 300,
      unit_price: 618,
      amount: 185400,
    })
  })

  it('upload la photo du reçu et l’attache au plein enregistré', async () => {
    mockInsert.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://ex.test/receipts/x.jpg' } })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    await screen.findByText('618 FCFA')
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    const file = new File(['x'], 'recu.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('receipt-photo-input'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockUpload).toHaveBeenCalled()
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ receipt_photo_url: 'https://ex.test/receipts/x.jpg' })
  })
})
