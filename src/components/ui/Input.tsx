import { type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-gray-700" htmlFor={id}>
      {label ? <span className="mb-1 block font-medium">{label}</span> : null}
      <input
        data-testid="input"
        id={id}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
