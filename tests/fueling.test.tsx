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
const mockBlLookup = vi.fn(() => Promise.resolve({ data: [] as { bus_number: string; date: string }[] }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from: (table: string) =>
      table === 'fuelings'
        ? { insert: mockInsert, select: () => ({ ilike: () => ({ limit: mockBlLookup }) }) }
        : { select: () => ({ order: () => Promise.resolve({ data: prices }) }) },
    storage: {
      from: () => ({ upload: mockUpload }),
    },
  }),
}))

describe('FuelingForm', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockUpload.mockClear()
    mockBlLookup.mockClear()
    mockBlLookup.mockResolvedValue({ data: [] })
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

  it('enregistre le numéro de BL quand il est saisi', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    await screen.findByText('618 FCFA')
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText(/numéro de bl/i), { target: { value: 'BL-00123' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    const arg = mockInsert.mock.calls[0][0]
    expect(arg).toMatchObject({ bl_number: 'BL-00123' })
  })

  it('avertit si le numéro de BL a déjà été utilisé', async () => {
    mockBlLookup.mockResolvedValue({ data: [{ bus_number: 'BH 8210', date: '2026-08-10' }] })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    await screen.findByText('618 FCFA')
    const blInput = screen.getByLabelText(/numéro de bl/i)
    fireEvent.change(blInput, { target: { value: 'BL-00123' } })
    fireEvent.blur(blInput)
    await screen.findByText(/déjà été utilisé/i)
    expect(screen.getByText(/BH 8210/)).toBeInTheDocument()
  })

  it('upload la photo du reçu et attache son chemin au plein enregistré', async () => {
    mockInsert.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ error: null })
    render(<FuelingForm departure={departure} onSaved={() => {}} />)
    await screen.findByText('618 FCFA')
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '300' } })
    const file = new File(['x'], 'recu.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('receipt-photo-input'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le plein/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockUpload).toHaveBeenCalled()
    const arg = mockInsert.mock.calls[0][0] as { receipt_photo_path?: string }
    expect(arg.receipt_photo_path).toMatch(new RegExp(`^${todayLocalISO()}/.+\\.jpg$`))
  })
})
