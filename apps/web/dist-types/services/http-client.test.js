import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../state/auth-store';
import { useVaultStore } from '../state/vault-store';
import { ValidationError, RateLimitError, ServerError } from './error-handler';
// We test the module's behaviour by mocking fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
// Mock window.location.replace
const mockReplace = vi.fn();
Object.defineProperty(window, 'location', {
    value: { replace: mockReplace },
    writable: true,
});
async function importClient() {
    const mod = await import('./http-client');
    return mod;
}
function makeResponse(status, body, headers = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: {
            get: (key) => headers[key.toLowerCase()] ?? null,
        },
        json: () => Promise.resolve(body),
    };
}
describe('HTTP client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.setState({ csrfToken: 'test-csrf-token' });
        useVaultStore.setState({ masterKey: null, privateKey: null, isUnlocked: false });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('injects X-CSRF-Token on POST', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, { data: 'ok' }));
        const { apiPost } = await importClient();
        await apiPost('/api/v1/test');
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf-token' });
    });
    it('injects X-CSRF-Token on PUT', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
        const { apiPut } = await importClient();
        await apiPut('/api/v1/test', { name: 'x' });
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf-token' });
    });
    it('injects X-CSRF-Token on PATCH', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
        const { apiPatch } = await importClient();
        await apiPatch('/api/v1/test', {});
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf-token' });
    });
    it('injects X-CSRF-Token on DELETE', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
        const { apiDelete } = await importClient();
        await apiDelete('/api/v1/test');
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf-token' });
    });
    it('does NOT inject X-CSRF-Token on GET', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
        const { apiGet } = await importClient();
        await apiGet('/api/v1/test');
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers?.['X-CSRF-Token']).toBeUndefined();
    });
    it('401 clears CSRF token, locks vault, and redirects to /login', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(401, { error: 'Unauthorized' }));
        useAuthStore.setState({ csrfToken: 'active-csrf' });
        const { apiGet } = await importClient();
        // Don't await — it never resolves after redirect
        apiGet('/api/v1/protected').catch(() => { });
        await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
        expect(useAuthStore.getState().csrfToken).toBeNull();
        expect(useVaultStore.getState().isUnlocked).toBe(false);
    });
    it('422 parses field errors and throws ValidationError', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(422, {
            error: 'Validation failed',
            details: [
                { field: 'email', rule: 'format' },
                { field: 'password', rule: 'min_length' },
            ],
        }));
        const { apiPost } = await importClient();
        await expect(apiPost('/api/v1/auth/register', {})).rejects.toBeInstanceOf(ValidationError);
        try {
            await apiPost('/api/v1/auth/register', {});
        }
        catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
    });
    it('422 includes field errors on the thrown error', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(422, {
            error: 'Validation failed',
            details: [{ field: 'email', rule: 'format' }],
        }));
        const { apiPost } = await importClient();
        let caught;
        try {
            await apiPost('/api/v1/test', {});
        }
        catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(ValidationError);
        expect(caught.fieldErrors).toEqual([{ field: 'email', rule: 'format' }]);
    });
    it('429 throws RateLimitError with retryAfterSeconds', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(429, { error: 'Rate limited' }, { 'retry-after': '30' }));
        const { apiPost } = await importClient();
        let caught;
        try {
            await apiPost('/api/v1/test', {});
        }
        catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(RateLimitError);
        expect(caught.retryAfterSeconds).toBe(30);
    });
    it('5xx throws ServerError', async () => {
        mockFetch.mockResolvedValueOnce(makeResponse(500, { error: 'Internal error' }));
        const { apiGet } = await importClient();
        await expect(apiGet('/api/v1/test')).rejects.toBeInstanceOf(ServerError);
    });
});
