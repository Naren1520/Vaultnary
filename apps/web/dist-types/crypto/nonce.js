/**
 * Generate a cryptographically random nonce via `crypto.getRandomValues`.
 * @param bytes - 12 for AES-256-GCM, 24 for XChaCha20
 */
export function generateNonce(bytes) {
    const nonce = new Uint8Array(bytes);
    crypto.getRandomValues(nonce);
    return nonce;
}
