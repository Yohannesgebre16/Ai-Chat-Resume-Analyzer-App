/**
 * Auth state (Zustand). Holds the current user + token, exposed via useAuth.
 * The token is also kept in localStorage by api-client for fetch headers.
 */
import { create } from 'zustand'
import { apiFetch, setToken, getToken } from './api-client'
import type { SafeUser } from './types'

interface AuthState {
  user: SafeUser | null
  token: string | null
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'idle',

  hydrate: async () => {
    const token = getToken()
    if (!token) {
      set({ status: 'unauthenticated' })
      return
    }
    set({ status: 'loading' })
    try {
      const user = await apiFetch<SafeUser>('/api/auth/me')
      set({ user, token, status: 'authenticated' })
    } catch {
      setToken(null)
      set({ user: null, token: null, status: 'unauthenticated' })
    }
  },

  login: async (email, password) => {
    const data = await apiFetch<{ user: SafeUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setToken(data.token)
    set({ user: data.user, token: data.token, status: 'authenticated' })
  },

  register: async (name, email, password) => {
    const data = await apiFetch<{ user: SafeUser; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: { name, email, password } }
    )
    setToken(data.token)
    set({ user: data.user, token: data.token, status: 'authenticated' })
  },

  logout: () => {
    setToken(null)
    set({ user: null, token: null, status: 'unauthenticated' })
  },
}))
