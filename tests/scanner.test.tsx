import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewTable } from '@/components/scanner/PreviewTable'
import type { ParsedPlanning } from '@/lib/planning/parse'

const planning: ParsedPlanning = {
  date: '2026-08-06',
  sections: [
    {
      originCity: 'AGADEZ',
      departures: [
        { axis: 'AGADEZ - NIAMEY', busNumber: 'CG 6377', departureTime: '05 H 00', driverName: 'YOUSSOUF', driverPhone: '96474717', backupDriver: '', backupPhone: '' },
      ],
    },
  ],
}

describe('PreviewTable', () => {
  it('affiche les lignes extraites', () => {
    render(<PreviewTable planning={planning} onChange={() => {}} />)
    expect(screen.getByDisplayValue('CG 6377')).toBeInTheDocument()
    expect(screen.getByDisplayValue('YOUSSOUF')).toBeInTheDocument()
  })

  it('permet de corriger le numéro de bus', () => {
    let updated: ParsedPlanning | null = null
    render(<PreviewTable planning={planning} onChange={(p) => (updated = p)} />)
    const input = screen.getByDisplayValue('CG 6377')
    fireEvent.change(input, { target: { value: 'CG 6388' } })
    expect(updated!.sections[0].departures[0].busNumber).toBe('CG 6388')
  })

  it('permet de supprimer une ligne parasite', () => {
    let updated: ParsedPlanning | null = null
    render(<PreviewTable planning={planning} onChange={(p) => (updated = p)} />)
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }))
    expect(updated!.sections[0].departures).toHaveLength(0)
  })
})
