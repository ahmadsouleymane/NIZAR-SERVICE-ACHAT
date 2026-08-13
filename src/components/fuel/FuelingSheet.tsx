'use client'

import type { Bus, DepartureWithFuel, RouteSegment } from '@/lib/types'
import { XIcon } from '@/components/ui/icons'
import { FuelingForm } from './FuelingForm'

interface Props {
  departure: DepartureWithFuel
  onClose: () => void
  onSaved: () => void
  segments?: RouteSegment[]
  buses?: Bus[]
  consumptionRate?: number | null
}

export function FuelingSheet({ departure, onClose, onSaved, segments = [], buses = [], consumptionRate = null }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        data-testid="fueling-sheet"
        role="dialog"
        aria-label={`Plein du bus ${departure.bus_number}`}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Plein de carburant</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="Fermer"
          >
            <XIcon size={20} />
          </button>
        </div>
        <FuelingForm
          departure={departure}
          onSaved={onSaved}
          segments={segments}
          buses={buses}
          consumptionRate={consumptionRate}
        />
      </div>
    </div>
  )
}
