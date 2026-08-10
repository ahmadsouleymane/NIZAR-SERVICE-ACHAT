import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RoutesPanel } from '@/components/admin/RoutesPanel'
import type { RouteSegment } from '@/lib/types'

const segments: RouteSegment[] = [
  { id: '1', city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 951, created_by: null, created_at: '' },
]

const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'route_segments'
        ? {
            insert: mockInsert,
            select: () => ({ order: () => Promise.resolve({ data: segments }) }),
            delete: () => ({ eq: mockEq }),
          }
        : { upsert: mockUpsert },
  }),
}))

describe('RoutesPanel', () => {
  it('affiche les tronçons existants', () => {
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    expect(screen.getByText(/NIAMEY ↔ AGADEZ/)).toBeInTheDocument()
    expect(screen.getByText('951 km')).toBeInTheDocument()
  })

  it('ajoute un nouveau tronçon', async () => {
    mockInsert.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.change(screen.getByLabelText(/ville a/i), { target: { value: 'loga' } })
    fireEvent.change(screen.getByLabelText(/ville b/i), { target: { value: 'agadez' } })
    fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: '850' } })
    fireEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))
    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ city_a: 'LOGA', city_b: 'AGADEZ', distance_km: 850 })
  })

  it('supprime un tronçon', async () => {
    mockEq.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    await waitFor(() => expect(mockEq).toHaveBeenCalledWith('id', '1'))
  })

  it('enregistre le taux de consommation', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.change(screen.getByLabelText(/litres \/ 100 km/i), { target: { value: '32' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le taux/i }))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith({ key: 'consumption_l_per_100km', value: '32' }))
  })
})
