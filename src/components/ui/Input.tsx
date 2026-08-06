import { type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...rest }: Props) {
  return (
    <label className="block text-sm text-slate-700" htmlFor={id}>
      {label ? <span className="mb-1.5 block font-medium">{label}</span> : null}
      <input
        data-testid="input"
        id={id}
        className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
