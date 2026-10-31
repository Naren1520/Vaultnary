import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    csrfToken: null,
    setCsrfToken: (token) => set({ csrfToken: token }),
    clearCsrfToken: () => set({ csrfToken: null }),
}));
