import { openMetadata } from '../../crypto/envelope';
const CREDENTIAL_TYPES = new Set([
    'email',
    'website',
    'database',
    'api_key',
    'token',
    'ssh',
    'service_account',
    'totp',
    'recovery_code',
    'custom',
]);
export function decodeHex(value) {
    if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
        throw new Error('Encrypted credential data is invalid.');
    }
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
    }
    return bytes;
}
export async function decryptVaultMetadata(item, privateKey) {
    if (!item.encrypted_metadata || !item.encrypted_dek) {
        return {
            ...item,
            last_accessed_at: item.last_accessed_at ?? null,
            created_at: item.created_at ?? '',
            updated_at: item.updated_at ?? '',
            name: 'Legacy credential',
            credential_type: 'custom',
            tags: [],
            notes: null,
            payload_metadata: null,
            legacy: true,
        };
    }
    const metadata = await openMetadata(decodeHex(item.encrypted_metadata), decodeHex(item.encrypted_dek), privateKey);
    const { name, credential_type: credentialType, tags, notes, payload_metadata: payloadMetadata } = metadata;
    if (typeof name !== 'string' ||
        !name.trim() ||
        typeof credentialType !== 'string' ||
        !CREDENTIAL_TYPES.has(credentialType) ||
        !Array.isArray(tags) ||
        !tags.every((tag) => typeof tag === 'string') ||
        (notes !== null && notes !== undefined && typeof notes !== 'string') ||
        (payloadMetadata !== null &&
            payloadMetadata !== undefined &&
            (typeof payloadMetadata !== 'object' ||
                Array.isArray(payloadMetadata)))) {
        throw new Error('Decrypted credential metadata is invalid.');
    }
    return {
        ...item,
        last_accessed_at: item.last_accessed_at ?? null,
        created_at: item.created_at ?? '',
        updated_at: item.updated_at ?? '',
        name,
        credential_type: credentialType,
        tags,
        notes: typeof notes === 'string' ? notes : null,
        payload_metadata: payloadMetadata && typeof payloadMetadata === 'object'
            ? payloadMetadata
            : null,
        legacy: false,
    };
}
