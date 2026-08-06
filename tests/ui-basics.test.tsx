import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFcfa } from '@/lib/fuel/calculations'

describe('UI de base', () => {
  it('rend un bouton avec son libellé', () => {
    render(<Button>Enregistrer</Button>)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
  })
  it('rend un badge avec du texte', () => {
    render(<Badge tone="green">Payé</Badge>)
    expect(screen.getByText('Payé')).toBeInTheDocument()
  })
  it('rend un état vide', () => {
    render(<EmptyState message="Aucun départ" />)
    expect(screen.getByText('Aucun départ')).toBeInTheDocument()
  })
  it('formate les montants', () => {
    expect(formatFcfa(12000)).toBe('12 000 FCFA')
  })
})
