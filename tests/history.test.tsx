import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanningsList } from '@/components/history/PlanningsList'
import { ReceiptsList } from '@/components/history/ReceiptsList'
import type { Planning, Fueling } from '@/lib/types'

const plannings: Planning[] = [
  { id: 'p1', date: '2026-08-06', source_label: 'Agadez', image_urls: [], created_by: null, created_at: '' },
  { id: 'p2', date: '2026-08-05', source_label: 'Niamey', image_urls: [], created_by: null, created_at: '' },
]

const fuelings: Fueling[] = [
  { id: 'f1', date: '2026-08-06', departure_id: null, bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 300, unit_price: 618, amount: 185400, paid: false, paid_at: null, receipt_photo_url: null, recorded_by: null, created_at: '' },
  { id: 'f2', date: '2026-08-06', departure_id: null, bus_number: 'BH 8210', driver_name: 'MANSOUR', fuel_type: 'essence', liters: 200, unit_price: 499, amount: 99800, paid: true, paid_at: '2026-08-06T18:00:00Z', receipt_photo_url: null, recorded_by: null, created_at: '' },
]

describe('PlanningsList', () => {
  it('liste les plannings par date décroissante', () => {
    render(<PlanningsList plannings={plannings} />)
    const rows = screen.getAllByTestId('planning-row')
    expect(rows[0]).toHaveTextContent('2026-08-06')
    expect(rows[1]).toHaveTextContent('2026-08-05')
  })
})

describe('ReceiptsList', () => {
  it('affiche les reçus et le grand total', () => {
    render(<ReceiptsList fuelings={fuelings} />)
    expect(screen.getByText('CG 6377')).toBeInTheDocument()
    expect(screen.getByText('BH 8210')).toBeInTheDocument()
    expect(screen.getByText('285 200 FCFA')).toBeInTheDocument() // 185400 + 99800
  })
  it('filtre par statut payé', () => {
    render(<ReceiptsList fuelings={fuelings} />)
    fireEvent.change(screen.getByLabelText(/statut/i), { target: { value: 'paid' } })
    expect(screen.queryByText('CG 6377')).not.toBeInTheDocument()
    expect(screen.getByText('BH 8210')).toBeInTheDocument()
  })
})
