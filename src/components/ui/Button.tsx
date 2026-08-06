import { type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent'

const styles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-blue-600 hover:bg-blue-50',
  accent: 'bg-emerald-600 text-white hover:bg-emerald-700',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'primary', children, className = '', ...rest }: Props) {
  return (
    <button
      data-testid="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
