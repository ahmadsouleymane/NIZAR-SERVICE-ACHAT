import { Badge } from '@/components/ui/Badge'

export type FuelingStatus = 'empty' | 'fueled' | 'paid'

const config: Record<FuelingStatus, { label: string; tone: 'neutral' | 'amber' | 'green' }> = {
  empty: { label: 'Pas de plein', tone: 'neutral' },
  fueled: { label: 'Plein fait', tone: 'amber' },
  paid: { label: 'Payé', tone: 'green' },
}

export function StatusBadge({ status }: { status: FuelingStatus }) {
  const c = config[status]
  return <Badge tone={c.tone}>{c.label}</Badge>
}
