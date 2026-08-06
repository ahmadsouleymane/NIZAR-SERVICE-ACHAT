import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { CircleIcon, DropletIcon, CheckCircleIcon } from '@/components/ui/icons'

export type FuelingStatus = 'empty' | 'fueled' | 'paid'

const config: Record<FuelingStatus, { label: string; tone: 'neutral' | 'amber' | 'green'; icon: ReactNode }> = {
  empty: { label: 'Pas de plein', tone: 'neutral', icon: <CircleIcon size={13} /> },
  fueled: { label: 'Plein fait', tone: 'amber', icon: <DropletIcon size={13} /> },
  paid: { label: 'Payé', tone: 'green', icon: <CheckCircleIcon size={13} /> },
}

export function StatusBadge({ status }: { status: FuelingStatus }) {
  const c = config[status]
  return (
    <Badge tone={c.tone} icon={c.icon}>
      {c.label}
    </Badge>
  )
}
