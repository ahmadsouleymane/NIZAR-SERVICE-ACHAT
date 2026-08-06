import { type SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-gray-700" htmlFor={id}>
      {label ? <span className="mb-1 block font-medium">{label}</span> : null}
      <select
        data-testid="select"
        id={id}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
