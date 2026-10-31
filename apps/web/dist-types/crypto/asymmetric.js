/**
 * RSA-OAEP-4096 key operations via the Web Crypto API.
 * Used to wrap/unwrap per-item DEKs (Data Encryption Keys).
 */
const RSA_PARAMS = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]), // 65537
    hash: 'SHA-256',
};
/** Generate a new RSA-OAEP-4096 key pair. Both keys are non-extractable. */
export async function generateKekPair() {
    return crypto.subtle.generateKey(RSA_PARAMS, false /* non-extractable */, [
        'encrypt',
        'decrypt',
    ]);
}
/**
 * Encrypt (wrap) a DEK with a recipient's RSA public key.
 * The DEK must be exported first since RSA-OAEP operates on raw bytes.
 */
export async function encryptDek(dek, publicKey) {
    const rawDek = await crypto.subtle.exportKey('raw', dek);
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawDek);
    return new Uint8Array(encrypted);
}
/**
 * Decrypt (unwrap) an encrypted DEK using the owner's RSA private key.
 * Returns the DEK as a non-extractable AES-256-GCM CryptoKey.
 */
export async function decryptDek(encryptedDek, privateKey) {
    // Cast to ArrayBuffer to satisfy strict WebCrypto typings
    const buf = encryptedDek.buffer;
    const rawDek = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, buf);
    return crypto.subtle.importKey('raw', rawDek, { name: 'AES-GCM', length: 256 }, false, // non-extractable
    ['encrypt', 'decrypt']);
}
/** Export a public key to SPKI format (for uploading to the server) */
export async function exportPublicKey(publicKey) {
    const spki = await crypto.subtle.exportKey('spki', publicKey);
    return new Uint8Array(spki);
}
/** Import a public key from SPKI bytes (received from the server) */
export async function importPublicKey(spkiBytes) {
    const buf = spkiBytes.buffer;
    return crypto.subtle.importKey('spki', buf, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}
