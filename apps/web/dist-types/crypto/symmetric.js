import { generateNonce } from './nonce';
/**
 * Encrypt plaintext using AES-256-GCM via the Web Crypto API.
 *
 * Output layout: [ nonce (12 bytes) | ciphertext | auth_tag (16 bytes) ]
 * The nonce is prepended so it travels with the ciphertext.
 */
export async function encrypt(key, plaintext) {
    const nonce = generateNonce(12);
    const ciphertextWithTag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce.buffer }, key, plaintext.buffer);
    // Concatenate nonce + ciphertext+tag
    const result = new Uint8Array(nonce.byteLength + ciphertextWithTag.byteLength);
    result.set(nonce, 0);
    result.set(new Uint8Array(ciphertextWithTag), nonce.byteLength);
    return result;
}
/**
 * Decrypt data produced by `encrypt`.
 * Splits the leading 12-byte nonce then calls AES-GCM decrypt.
 * Throws if the auth tag is invalid (tampered ciphertext).
 */
export async function decrypt(key, data) {
    const NONCE_BYTES = 12;
    if (data.byteLength <= NONCE_BYTES)
        throw new Error('Data too short to contain nonce');
    const nonce = data.slice(0, NONCE_BYTES);
    const ciphertextWithTag = data.slice(NONCE_BYTES);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce.buffer }, key, ciphertextWithTag.buffer);
    return new Uint8Array(plaintext);
}
