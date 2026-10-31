import { create } from 'zustand'

interface AuthState {
  /** CSRF token stored in memory only -never written to localStorage/sessionStorage */
  csrfToken: string | null
  setCsrfToken: (token: string) => void
  clearCsrfToken: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  csrfToken: null,
  setCsrfToken: (token) => set({ csrfToken: token }),
  clearCsrfToken: () => set({ csrfToken: null }),
}))
