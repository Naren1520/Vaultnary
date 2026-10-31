import { create } from 'zustand';
export const useVaultStore = create((set) => ({
    masterKey: null,
    privateKey: null,
    isUnlocked: false,
    unlockVault: (masterKey, privateKey) => set({ masterKey, privateKey, isUnlocked: true }),
    lockVault: () => set({ masterKey: null, privateKey: null, isUnlocked: false }),
}));
