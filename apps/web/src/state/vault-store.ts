import { create } from 'zustand'

interface VaultState {
  /** Master key (AES-256-GCM CryptoKey) — in-memory only, never persisted */
  masterKey: CryptoKey | null
  /** KEK private key (RSA-OAEP CryptoKeyPair.privateKey) — in-memory only */
  privateKey: CryptoKey | null
  /** Whether the vault is currently unlocked */
  isUnlocked: boolean

  unlockVault: (masterKey: CryptoKey, privateKey: CryptoKey) => void
  /** Zero out all key references and mark vault locked */
  lockVault: () => void
}

export const useVaultStore = create<VaultState>((set) => ({
  masterKey: null,
  privateKey: null,
  isUnlocked: false,

  unlockVault: (masterKey, privateKey) =>
    set({ masterKey, privateKey, isUnlocked: true }),

  lockVault: () =>
    set({ masterKey: null, privateKey: null, isUnlocked: false }),
}))
