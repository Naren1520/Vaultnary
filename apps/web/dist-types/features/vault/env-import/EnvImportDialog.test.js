import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnvImportDialog from './EnvImportDialog';
const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    importPublicKey: vi.fn(),
    sealItem: vi.fn(),
}));
vi.mock('../../../services/http-client', () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
}));
vi.mock('../../../crypto/asymmetric', () => ({
    importPublicKey: mocks.importPublicKey,
}));
vi.mock('../../../crypto/envelope', () => ({
    sealItem: mocks.sealItem,
}));
vi.mock('../../../state/vault-store', () => ({
    useVaultStore: (selector) => selector({ privateKey: {} }),
}));
describe('EnvImportDialog', () => {
    const onClose = vi.fn();
    const onImported = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiGet.mockImplementation(async (path) => {
            if (path === '/api/v1/users/me')
                return { data: { id: 'user-id' } };
            return { data: { public_key: 'aabb' } };
        });
        mocks.importPublicKey.mockResolvedValue({});
        mocks.sealItem.mockResolvedValue({
            encryptedMetadata: new Uint8Array([1, 2, 3]),
            encryptedPayload: new Uint8Array([4, 5, 6]),
            encryptedDek: new Uint8Array([7, 8, 9]),
        });
        mocks.apiPost.mockResolvedValue({ data: { imported: 1 } });
    });
    it('encrypts variables in the browser and never sends plaintext to the API', async () => {
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Environment file contents'), {
            target: { value: 'DATABASE_URL=super-secret-value' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Encrypt and import 1' }));
        await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        const [path, request] = mocks.apiPost.mock.calls[0];
        expect(path).toBe('/api/v1/vault/import-env');
        expect(request).toEqual({
            items: [{
                    encrypted_metadata: 'AQID',
                    encrypted_payload: 'BAUG',
                    encrypted_dek: 'BwgJ',
                }],
        });
        expect(JSON.stringify(request)).not.toContain('super-secret-value');
        expect(JSON.stringify(request)).not.toContain('DATABASE_URL');
        expect(mocks.sealItem).toHaveBeenCalledWith({ value: 'super-secret-value' }, expect.objectContaining({ name: 'DATABASE_URL', credential_type: 'custom' }), {});
        expect(onImported).toHaveBeenCalledWith(1);
        expect(onClose).toHaveBeenCalled();
    });
    it('blocks import while parse issues such as duplicate keys remain', () => {
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Environment file contents'), {
            target: { value: 'API_KEY=first\nAPI_KEY=second' },
        });
        expect(screen.getByRole('alert')).toHaveTextContent('Duplicate variable "API_KEY"');
        expect(screen.getByRole('button', { name: 'Encrypt and import 1' })).toBeDisabled();
        expect(mocks.apiPost).not.toHaveBeenCalled();
    });
    it('detects CSV content and encrypts the selected values before sending', async () => {
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Environment file contents'), {
            target: { value: 'NAME,VALUE\nAPI_TOKEN,"csv-secret"' },
        });
        expect(screen.getByLabelText('Format')).toHaveValue('auto');
        expect(screen.getByLabelText('API_TOKEN')).toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'Encrypt and import 1' }));
        await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledTimes(1));
        expect(mocks.sealItem).toHaveBeenCalledWith({ value: 'csv-secret' }, expect.objectContaining({ name: 'API_TOKEN', credential_type: 'custom' }), {});
        expect(JSON.stringify(mocks.apiPost.mock.calls[0][1])).not.toContain('csv-secret');
    });
    it('selects CSV parsing for a .csv file', async () => {
        const file = new File(['NAME,VALUE\nCSV_TOKEN,csv-secret'], 'variables.csv', {
            type: 'text/csv',
        });
        Object.defineProperty(file, 'text', {
            value: async () => 'NAME,VALUE\nCSV_TOKEN,csv-secret',
        });
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Choose an environment file'), {
            target: { files: [file] },
        });
        await waitFor(() => expect(screen.getByLabelText('Format')).toHaveValue('csv'));
        expect(screen.getByLabelText('CSV_TOKEN')).toBeChecked();
    });
    it('does not send encrypted payloads that exceed the API size limit', async () => {
        mocks.sealItem.mockResolvedValueOnce({
            encryptedMetadata: new Uint8Array([1, 2, 3]),
            encryptedPayload: new Uint8Array(64 * 1024 + 1),
            encryptedDek: new Uint8Array(512),
        });
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Environment file contents'), {
            target: { value: 'LARGE=value' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Encrypt and import 1' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The encrypted value exceeds the vault item size limit');
        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(onImported).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
    it('reports a failed atomic save without claiming a partial import', async () => {
        mocks.apiPost.mockRejectedValueOnce(new Error('Request failed'));
        render(_jsx(EnvImportDialog, { onClose: onClose, onImported: onImported }));
        fireEvent.change(screen.getByLabelText('Environment file contents'), {
            target: { value: 'FIRST=one\nSECOND=two\nTHIRD=three' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Encrypt and import 3' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was imported.');
        expect(onImported).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByLabelText('FIRST')).toBeChecked();
        expect(screen.getByLabelText('SECOND')).toBeChecked();
        expect(screen.getByLabelText('THIRD')).toBeChecked();
        expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    });
});
