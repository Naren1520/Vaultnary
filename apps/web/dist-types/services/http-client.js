/**
 * Typed HTTP client wrappers around fetch.
 *
 * - CSRF token is read from the Zustand auth-store (in-memory only)
 *   and injected as X-CSRF-Token on all POST/PUT/PATCH/DELETE calls.
 * - 401 → clear CSRF token, lock vault, redirect to /login
 * - 422 → parse field errors, throw ValidationError
 * - 429 → parse Retry-After, throw RateLimitError
 * - 5xx → throw ServerError (generic message, no stack trace)
 */
import { useAuthStore } from '../state/auth-store';
import { useVaultStore } from '../state/vault-store';
import { ValidationError, RateLimitError, ServerError } from './error-handler';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// In production this is set to the Render API URL (e.g. https://vaultnary-api.onrender.com)
// In development it is empty and Vite's dev proxy handles /api/v1/* -> localhost:8080
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
/** Low-level fetch wrapper that handles auth, CSRF, and error mapping */
async function request(method, path, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...opts.headers,
    };
    // Inject CSRF token on mutating requests
    if (MUTATING_METHODS.has(method.toUpperCase())) {
        const csrfToken = useAuthStore.getState().csrfToken;
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
    }
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: 'include', // include vault_session cookie
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
    });
    // 401 -session expired/invalid: clear state and redirect
    if (response.status === 401) {
        useAuthStore.getState().clearCsrfToken();
        useVaultStore.getState().lockVault();
        window.location.replace('/login');
        // Return a promise that never resolves (we're redirecting)
        return new Promise(() => { });
    }
    // 422 -validation errors
    if (response.status === 422) {
        const body = await response.json().catch(() => ({}));
        const details = body?.details ?? [];
        throw new ValidationError(body?.error ?? 'Validation failed', details);
    }
    // 429 -rate limited
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
        throw new RateLimitError(isNaN(seconds) ? null : seconds);
    }
    // 5xx -server error
    if (response.status >= 500) {
        throw new ServerError(response.status);
    }
    // Non-2xx (other)
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed with status ${response.status}`);
    }
    // 204 No Content
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
/** GET /path */
export function apiGet(path, opts) {
    return request('GET', path, opts);
}
/** POST /path with JSON body */
export function apiPost(path, body, opts) {
    return request('POST', path, { ...opts, body });
}
/** PUT /path with JSON body */
export function apiPut(path, body, opts) {
    return request('PUT', path, { ...opts, body });
}
/** PATCH /path with JSON body */
export function apiPatch(path, body, opts) {
    return request('PATCH', path, { ...opts, body });
}
/** DELETE /path with optional JSON body */
export function apiDelete(path, body, opts) {
    return request('DELETE', path, { ...opts, body });
}
