import { Input } from '@/components/ui/Input'

export function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input id="date" label="Date" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}
