import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { CircleIcon, DropletIcon, CheckCircleIcon } from '@/components/ui/icons'

export type FuelingStatus = 'empty' | 'fueled' | 'approved' | 'paid'

const config: Record<FuelingStatus, { label: string; tone: 'neutral' | 'amber' | 'blue' | 'green'; icon: ReactNode }> = {
  empty: { label: 'Pas de plein', tone: 'neutral', icon: <CircleIcon size={13} /> },
  fueled: { label: 'À approuver', tone: 'amber', icon: <DropletIcon size={13} /> },
  approved: { label: 'Approuvé', tone: 'blue', icon: <CheckCircleIcon size={13} /> },
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
