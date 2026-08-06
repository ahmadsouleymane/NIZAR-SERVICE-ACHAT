'use client'

import type { ParsedPlanning } from '@/lib/planning/parse'
import { Button } from '@/components/ui/Button'

interface Props {
  planning: ParsedPlanning
  onChange: (p: ParsedPlanning) => void
}

export function PreviewTable({ planning, onChange }: Props) {
  function updateRow(sectionIdx: number, rowIdx: number, field: keyof ParsedPlanning['sections'][number]['departures'][number], value: string) {
    const next = structuredClone(planning)
    next.sections[sectionIdx].departures[rowIdx][field] = value
    onChange(next)
  }

  function removeRow(sectionIdx: number, rowIdx: number) {
    const next = structuredClone(planning)
    next.sections[sectionIdx].departures.splice(rowIdx, 1)
    onChange(next)
  }

  return (
    <div className="space-y-6">
      {planning.sections.map((section, si) => (
        <div key={si} className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-2 text-sm font-bold text-gray-700">
            Départ {section.originCity || '—'}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-3 py-2">Axe</th>
                <th className="px-3 py-2">N° Bus</th>
                <th className="px-3 py-2">Heure</th>
                <th className="px-3 py-2">Chauffeur</th>
                <th className="px-3 py-2">Téléphone</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {section.departures.map((d, ri) => (
                <tr key={ri} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-1">
                    <input className="w-full min-w-40 rounded border border-gray-200 px-2 py-1" value={d.axis} onChange={(e) => updateRow(si, ri, 'axis', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-24 rounded border border-gray-200 px-2 py-1" value={d.busNumber} onChange={(e) => updateRow(si, ri, 'busNumber', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-20 rounded border border-gray-200 px-2 py-1" value={d.departureTime} onChange={(e) => updateRow(si, ri, 'departureTime', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-full min-w-36 rounded border border-gray-200 px-2 py-1" value={d.driverName} onChange={(e) => updateRow(si, ri, 'driverName', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <input className="w-28 rounded border border-gray-200 px-2 py-1" value={d.driverPhone} onChange={(e) => updateRow(si, ri, 'driverPhone', e.target.value)} />
                  </td>
                  <td className="px-3 py-1">
                    <Button variant="ghost" type="button" onClick={() => removeRow(si, ri)}>Supprimer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
