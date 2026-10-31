/**
 * Key derivation using Argon2id via the argon2-browser wasm module.
 *
 * Derives a 256-bit AES-256-GCM CryptoKey from a master password and salt.
 * Parameters match the backend: m=65536, t=3, p=4.
 *
 * Vite handles the argon2-browser wasm import natively — no configuration
 * workarounds needed.
 */
import argon2 from 'argon2-browser';
const DEFAULT_PARAMS = {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    outputLen: 32,
};
/**
 * Derive a non-extractable AES-256-GCM CryptoKey from a password and salt.
 * @param password - user's master password (plaintext)
 * @param salt     - per-user random salt (16+ bytes recommended)
 */
export async function deriveKey(password, salt) {
    const result = await argon2.hash({
        pass: password,
        salt,
        type: argon2.ArgonType.Argon2id,
        mem: DEFAULT_PARAMS.memoryCost,
        time: DEFAULT_PARAMS.timeCost,
        parallelism: DEFAULT_PARAMS.parallelism,
        hashLen: DEFAULT_PARAMS.outputLen,
    });
    // Import the raw 32-byte output as a non-extractable AES-256-GCM key
    return crypto.subtle.importKey('raw', result.hash.buffer, { name: 'AES-GCM', length: 256 }, false, // non-extractable
    ['encrypt', 'decrypt']);
}
