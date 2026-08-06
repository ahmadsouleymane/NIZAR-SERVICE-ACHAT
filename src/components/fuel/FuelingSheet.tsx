'use client'

import type { DepartureWithFuel } from '@/lib/types'
import { FuelingForm } from './FuelingForm'

interface Props {
  departure: DepartureWithFuel
  onClose: () => void
  onSaved: () => void
}

export function FuelingSheet({ departure, onClose, onSaved }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        data-testid="fueling-sheet"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Plein de carburant</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Fermer">
            ✕
          </button>
        </div>
        <FuelingForm departure={departure} onSaved={onSaved} />
      </div>
    </div>
  )
}
