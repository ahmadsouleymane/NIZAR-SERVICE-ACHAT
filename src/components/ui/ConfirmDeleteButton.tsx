'use client'

import { useEffect, useRef, useState } from 'react'
import { TrashIcon } from './icons'

interface Props {
  onConfirm: () => void
  label: string
  className?: string
}

// Suppression à deux clics : le premier clic passe le bouton en mode
// "Confirmer ?" pendant 3 s, le second déclenche réellement l'action.
export function ConfirmDeleteButton({ onConfirm, label, className = '' }: Props) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      timer.current = setTimeout(() => setConfirming(false), 3000)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setConfirming(false)
    onConfirm()
  }

  return (
    <button
      type="button"
      aria-label={confirming ? `Confirmer : ${label}` : label}
      onClick={handleClick}
      className={
        confirming
          ? `rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white transition ${className}`
          : `text-red-600 transition hover:text-red-700 ${className}`
      }
    >
      {confirming ? 'Confirmer ?' : <TrashIcon size={16} />}
    </button>
  )
}
