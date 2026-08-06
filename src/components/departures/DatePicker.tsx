import { CalendarIcon } from '@/components/ui/icons'

export function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
      <CalendarIcon size={18} className="shrink-0 text-slate-400" />
      <input
        type="date"
        aria-label="Date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-36 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
      />
    </label>
  )
}
