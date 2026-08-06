import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from '@/components/auth/LoginForm'

const mockSignIn = vi.fn()
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignIn },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    mockSignIn.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
  })

  it('affiche une erreur si la connexion échoue', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Identifiants invalides' } })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(screen.getByText('Identifiants invalides')).toBeInTheDocument())
  })

  it('redirige vers la racine après succès', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })
})
