'use client'

import type { ParsedPlanning } from '@/lib/planning/parse'
import { Button } from '@/components/ui/Button'
import { TrashIcon } from '@/components/ui/icons'

interface Props {
  planning: ParsedPlanning
  onChange: (p: ParsedPlanning) => void
}

// Les inputs s'ajustent à la taille de leur contenu (field-sizing: content) :
// on voit l'ensemble des données et on peut les corriger. min-w fixe un minimum.
const cellClass = 'h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none [field-sizing:content] min-w-24'

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
        <div key={si} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-bold text-slate-700">Départ {section.originCity || '—'}</span>
            <span className="text-xs text-slate-400">{section.departures.length} ligne{section.departures.length > 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Axe</th>
                  <th className="px-3 py-2 font-semibold">N° Bus</th>
                  <th className="px-3 py-2 font-semibold">Heure</th>
                  <th className="px-3 py-2 font-semibold">Chauffeur</th>
                  <th className="px-3 py-2 font-semibold">Téléphone</th>
                  <th className="px-3 py-2 font-semibold">Suppléant</th>
                  <th className="px-3 py-2 font-semibold">Tél. suppl.</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {section.departures.map((d, ri) => (
                  <tr key={ri} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-60`} value={d.axis} onChange={(e) => updateRow(si, ri, 'axis', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-28`} value={d.busNumber} onChange={(e) => updateRow(si, ri, 'busNumber', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-24`} value={d.departureTime} onChange={(e) => updateRow(si, ri, 'departureTime', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-44`} value={d.driverName} onChange={(e) => updateRow(si, ri, 'driverName', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-28`} value={d.driverPhone} onChange={(e) => updateRow(si, ri, 'driverPhone', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-40`} value={d.backupDriver || '—'} onChange={(e) => updateRow(si, ri, 'backupDriver', e.target.value === '—' ? '' : e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={`${cellClass} min-w-28`} value={d.backupPhone || '—'} onChange={(e) => updateRow(si, ri, 'backupPhone', e.target.value === '—' ? '' : e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Button variant="ghost" type="button" onClick={() => removeRow(si, ri)} aria-label={`Supprimer la ligne ${ri + 1}`}>
                        <TrashIcon size={16} />
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
