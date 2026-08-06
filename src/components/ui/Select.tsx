import { type SelectHTMLAttributes } from 'react'
import { ChevronDownIcon } from './icons'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-slate-700" htmlFor={id}>
      {label ? <span className="mb-1.5 block font-medium">{label}</span> : null}
      <span className="relative block">
        <select
          data-testid="select"
          id={id}
          className={`h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none ${className}`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </span>
    </label>
  )
}
