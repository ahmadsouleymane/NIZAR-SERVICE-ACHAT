import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/components/departures/StatusBadge'
import { DepartureList } from '@/components/departures/DepartureList'
import type { DepartureWithFuel, RouteSegment } from '@/lib/types'

const departure = (overrides: Partial<DepartureWithFuel> = {}): DepartureWithFuel => ({
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
  ...overrides,
})

describe('StatusBadge', () => {
  it('affiche « Pas de plein » sans reçu', () => {
    render(<StatusBadge status="empty" />)
    expect(screen.getByText('Pas de plein')).toBeInTheDocument()
  })
  it('affiche « À approuver » quand ni payé ni approuvé', () => {
    render(<StatusBadge status="fueled" />)
    expect(screen.getByText('À approuver')).toBeInTheDocument()
  })
  it('affiche « Approuvé » quand approuvé non payé', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Approuvé')).toBeInTheDocument()
  })
  it('affiche « Payé » quand payé', () => {
    render(<StatusBadge status="paid" />)
    expect(screen.getByText('Payé')).toBeInTheDocument()
  })
})

describe('DepartureList', () => {
  it('groupe les départs par ville d’origine', () => {
    const rows: DepartureWithFuel[] = [
      departure({ id: '1', axis: 'AGADEZ - NIAMEY' }),
      departure({ id: '2', axis: 'AGADEZ - ARLIT' }),
      departure({ id: '3', axis: 'INGAL - AGADEZ' }),
    ]
    render(<DepartureList departures={rows} />)
    expect(screen.getByRole('heading', { name: 'AGADEZ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'INGAL' })).toBeInTheDocument()
    expect(screen.getAllByTestId('departure-row')).toHaveLength(3)
  })
  it('affiche le montant total des reçus d’un départ', () => {
    const rows: DepartureWithFuel[] = [
      departure({
        id: '1',
        fuelings: [
          { id: 'f1', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 100, unit_price: 618, amount: 61800, paid: false, paid_at: null, approved: false, approved_at: null, receipt_photo_path: null, receipt_photo_paths: [], odometer_km: null, recorded_by: null, created_at: '' },
          { id: 'f2', date: '2026-08-06', departure_id: 'd1', bus_number: 'CG 6377', driver_name: 'YOUSSOUF', fuel_type: 'diesel', liters: 50, unit_price: 618, amount: 30900, paid: false, paid_at: null, approved: false, approved_at: null, receipt_photo_path: null, receipt_photo_paths: [], odometer_km: null, recorded_by: null, created_at: '' },
        ],
      }),
    ]
    render(<DepartureList departures={rows} />)
    expect(screen.getByText('92 700 FCFA')).toBeInTheDocument()
  })
})

describe('DepartureList — distance et consommation prévisionnelle', () => {
  const segments: RouteSegment[] = [
    { id: 's1', city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 951, created_by: null, created_at: '' },
  ]

  it('affiche la distance et la consommation prévues quand l’itinéraire est connu', () => {
    const rows = [departure({ id: '1', axis: 'NIAMEY - AGADEZ' })]
    render(<DepartureList departures={rows} segments={segments} consumptionRate={30} />)
    expect(screen.getByText(/≈ 951 km/)).toBeInTheDocument()
    expect(screen.getByText(/≈ 285 L prévus/)).toBeInTheDocument()
  })

  it('n’affiche rien quand un tronçon de l’itinéraire est inconnu', () => {
    const rows = [departure({ id: '1', axis: 'NIAMEY - LOGA - AGADEZ' })]
    render(<DepartureList departures={rows} segments={segments} consumptionRate={30} />)
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
  })
})
