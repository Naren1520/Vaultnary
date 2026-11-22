import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));
vi.mock('../../services/http-client', () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
}));
import ServiceDetail from './ServiceDetail';
const service = {
    id: 'service-1',
    name: 'Payments API',
    environment: 'production',
    description: null,
    project_id: 'project-1',
};
describe('ServiceDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiGet.mockImplementation((path) => {
            if (path === '/api/v1/services/service-1') {
                return Promise.resolve({ data: service });
            }
            if (path === '/api/v1/services/service-1/vaults') {
                return Promise.resolve({ data: [] });
            }
            return Promise.reject(new Error(`Unexpected GET ${path}`));
        });
    });
    function renderService() {
        return render(_jsx(MemoryRouter, { initialEntries: ['/app/services/service-1'], children: _jsx(Routes, { children: _jsx(Route, { path: "/app/services/:serviceId", element: _jsx(ServiceDetail, {}) }) }) }));
    }
    it('creates a vault within the service and links to its credentials', async () => {
        mocks.apiPost.mockResolvedValue({
            data: { id: 'vault-1', name: 'Production credentials', created_at: '2025-01-01' },
        });
        renderService();
        expect(await screen.findByRole('heading', { name: 'Payments API' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Create a vault'), {
            target: { value: 'Production credentials' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create vault' }));
        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/services/service-1/vaults', { name: 'Production credentials' });
        });
        expect(await screen.findByRole('link', { name: /Production credentials/ }))
            .toHaveAttribute('href', '/app/vaults/vault-1');
    });
    it('shows vault-load failures and supports retry', async () => {
        let shouldFail = true;
        mocks.apiGet.mockImplementation((path) => {
            if (path === '/api/v1/services/service-1') {
                return Promise.resolve({ data: service });
            }
            if (path === '/api/v1/services/service-1/vaults' && shouldFail) {
                shouldFail = false;
                return Promise.reject(new Error('Vault service unavailable'));
            }
            return Promise.resolve({ data: [] });
        });
        renderService();
        expect(await screen.findByRole('alert')).toHaveTextContent('Vault service unavailable');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByRole('heading', { name: 'Payments API' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
