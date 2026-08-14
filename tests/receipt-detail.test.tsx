import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReceiptDetailSheet } from '@/components/history/ReceiptDetailSheet'
import type { ReceiptsListFueling } from '@/components/history/ReceiptsList'

const fueling: ReceiptsListFueling = {
  id: 'f1',
  date: '2026-08-06',
  departure_id: null,
  bus_number: 'CG 6377',
  driver_name: 'YOUSSOUF',
  fuel_type: 'diesel',
  liters: 300,
  unit_price: 618,
  amount: 185400,
  paid: false,
  paid_at: null,
  paid_by: null,
  approved: false,
  approved_at: null,
  approved_by: null,
  voided: false,
  voided_at: null,
  voided_by: null,
  receipt_photo_path: null,
  receipt_photo_paths: [],
  receipt_photo_urls: ['https://ex.test/signed/receipts/f1.jpg'],
  odometer_km: 152340,
  bl_number: 'BL-00123',
  recorded_by: null,
  created_at: '',
  axis: 'AGADEZ - NIAMEY',
}

const auditRows = [
  { id: 'a1', fueling_id: 'f1', action: 'created', actor: 'u1', details: '', created_at: '2026-08-06T08:00:00Z', profiles: { full_name: 'Amina' } },
]

const updateMock = vi.fn<(payload: Record<string, unknown>) => { eq: (...a: unknown[]) => Promise<{ error: null }> }>(
  () => ({ eq: vi.fn().mockResolvedValue({ error: null }) })
)
const insertAuditMock = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'fuelings') return { update: updateMock }
      if (table === 'fueling_audit_log') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: auditRows }) }) }),
          insert: insertAuditMock,
        }
      }
      return {}
    },
  }),
}))

describe('ReceiptDetailSheet', () => {
  beforeEach(() => {
    updateMock.mockClear()
    insertAuditMock.mockClear()
  })

  it('affiche toutes les informations et la photo du reçu', async () => {
    render(<ReceiptDetailSheet fueling={fueling} isAdmin={false} onClose={() => {}} onChanged={() => {}} />)
    expect(screen.getByText('BL-00123')).toBeInTheDocument()
    expect(screen.getByText('AGADEZ')).toBeInTheDocument()
    expect(screen.getByText('NIAMEY')).toBeInTheDocument()
    expect(screen.getByText('152340 km')).toBeInTheDocument()
    expect(screen.getByAltText('Reçu 1')).toBeInTheDocument()
    await screen.findByText(/Amina/)
  })

  it('permet de modifier le plein (non admin, non approuvé)', async () => {
    const onChanged = vi.fn()
    render(<ReceiptDetailSheet fueling={fueling} isAdmin={false} onClose={() => {}} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }))
    fireEvent.change(screen.getByLabelText(/litres/i), { target: { value: '320' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    const payload = updateMock.mock.calls[0][0]
    expect(payload).toMatchObject({ liters: 320, amount: 197760 })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('cache le bouton Annuler le plein pour un non-admin', () => {
    render(<ReceiptDetailSheet fueling={fueling} isAdmin={false} onClose={() => {}} onChanged={() => {}} />)
    expect(screen.queryByLabelText(/annuler le plein/i)).not.toBeInTheDocument()
  })

  it('annule le plein après confirmation (admin)', async () => {
    const onChanged = vi.fn()
    const onClose = vi.fn()
    render(<ReceiptDetailSheet fueling={fueling} isAdmin={true} onClose={onClose} onChanged={onChanged} />)
    const voidBtn = screen.getByLabelText(/annuler le plein/i)
    fireEvent.click(voidBtn)
    fireEvent.click(screen.getByLabelText(/confirmer.*annuler le plein/i))
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    const payload = updateMock.mock.calls[0][0]
    expect(payload).toMatchObject({ voided: true })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })
})
