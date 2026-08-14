import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RoutesPanel } from '@/components/admin/RoutesPanel'
import type { RouteSegment } from '@/lib/types'

const segments: RouteSegment[] = [
  { id: '1', city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 951, created_by: null, created_at: '' },
]

const mockInsert = vi.fn()
const mockEq = vi.fn()
const mockUpdate = vi.fn<(...args: [Record<string, unknown>]) => { eq: typeof mockUpdateEq }>(() => ({ eq: mockUpdateEq }))
const mockUpdateEq = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) =>
      table === 'route_segments'
        ? {
            insert: mockInsert,
            select: () => ({ order: () => Promise.resolve({ data: segments }) }),
            update: mockUpdate,
            delete: () => ({ eq: mockEq }),
          }
        : { upsert: mockUpsert },
  }),
}))

describe('RoutesPanel', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockEq.mockClear()
    mockUpdate.mockClear()
    mockUpdateEq.mockClear()
    mockUpsert.mockClear()
  })

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

  it('supprime un tronçon après confirmation (deux clics)', async () => {
    mockEq.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    const deleteBtn = screen.getByRole('button', { name: /supprimer/i })
    fireEvent.click(deleteBtn)
    expect(mockEq).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }))
    await waitFor(() => expect(mockEq).toHaveBeenCalledWith('id', '1'))
  })

  it('modifie un tronçon existant', async () => {
    mockUpdateEq.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }))
    // le formulaire passe en mode modification, pré-rempli avec les valeurs du tronçon
    fireEvent.change(screen.getByLabelText(/distance/i), { target: { value: '960' } })
    fireEvent.click(screen.getByRole('button', { name: /mettre à jour/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ city_a: 'NIAMEY', city_b: 'AGADEZ', distance_km: 960 })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', '1')
  })

  it("annule la modification d'un tronçon", async () => {
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }))
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    // retour en mode ajout : le bouton redevient « Ajouter »
    expect(screen.getByRole('button', { name: /^ajouter$/i })).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('enregistre le taux de consommation', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    render(<RoutesPanel initialSegments={segments} initialConsumptionRate={30} />)
    fireEvent.change(screen.getByLabelText(/litres \/ 100 km/i), { target: { value: '32' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le taux/i }))
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith({ key: 'consumption_l_per_100km', value: '32' }))
  })
})
