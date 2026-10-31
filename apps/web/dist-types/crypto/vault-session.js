/**
 * Vault session management -integrates the crypto module with the Zustand
 * vault-store for in-memory key lifecycle.
 *
 * Keys are ONLY held in the Zustand store (JavaScript heap memory).
 * They are never written to localStorage, sessionStorage, IndexedDB, or
 * any URL. `lockVault()` replaces the store references with null.
 */
import { useVaultStore } from '../state/vault-store';
/**
 * Store unlocked key material in the in-memory vault store.
 * Called after successful Argon2id derivation and KEK pair load.
 */
export function unlockVault(masterKey, privateKey) {
    useVaultStore.getState().unlockVault(masterKey, privateKey);
}
/**
 * Clear all key references from the vault store.
 * Called on logout, 401 response, or explicit user lock action.
 */
export function lockVault() {
    useVaultStore.getState().lockVault();
}
/** Returns true when the vault is currently unlocked */
export function isVaultUnlocked() {
    return useVaultStore.getState().isUnlocked;
}
/** Returns the in-memory private KEK, or null if vault is locked */
export function getPrivateKey() {
    return useVaultStore.getState().privateKey;
}
/** Returns the in-memory master key, or null if vault is locked */
export function getMasterKey() {
    return useVaultStore.getState().masterKey;
}
