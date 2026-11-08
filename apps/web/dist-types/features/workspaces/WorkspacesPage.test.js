import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    apiDelete: vi.fn(),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    showToast: vi.fn(),
}));
vi.mock('../../services/http-client', () => ({
    apiDelete: mocks.apiDelete,
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiPut: mocks.apiPut,
}));
vi.mock('../../components/ui/Toast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}));
import WorkspacesPage from './WorkspacesPage';
const workspace = {
    id: 'workspace-1',
    name: 'Personal Workspace',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
};
const owner = {
    user_id: 'owner-1',
    email: 'owner@example.com',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
};
const editor = {
    user_id: 'editor-1',
    email: 'editor@example.com',
    role: 'editor',
    created_at: '2026-01-02T00:00:00Z',
};
describe('WorkspacesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiGet.mockImplementation((path) => {
            if (path === '/api/v1/workspaces') {
                return Promise.resolve({ data: [workspace] });
            }
            if (path.endsWith('/members')) {
                return Promise.resolve({ data: [owner, editor] });
            }
            return Promise.reject(new Error(`Unexpected GET ${path}`));
        });
        mocks.apiPost.mockResolvedValue({ data: {} });
        mocks.apiPut.mockResolvedValue(undefined);
        mocks.apiDelete.mockResolvedValue(undefined);
    });
    it('lists workspace members and lets an owner add a member', async () => {
        render(_jsx(MemoryRouter, { children: _jsx(WorkspacesPage, {}) }));
        expect(await screen.findByRole('heading', { name: 'Personal Workspace' })).toBeInTheDocument();
        expect(await screen.findByText('editor@example.com')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Member email'), {
            target: { value: 'new-member@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/workspaces/workspace-1/members', { email: 'new-member@example.com', role: 'editor' });
        });
        expect(mocks.showToast).toHaveBeenCalledWith({
            message: 'Workspace member added',
            type: 'success',
        });
    });
    it('allows an owner to update and remove a member', async () => {
        render(_jsx(MemoryRouter, { children: _jsx(WorkspacesPage, {}) }));
        await screen.findByText('editor@example.com');
        fireEvent.change(screen.getByRole('combobox', { name: 'Role for editor@example.com' }), {
            target: { value: 'viewer' },
        });
        await waitFor(() => {
            expect(mocks.apiPut).toHaveBeenCalledWith('/api/v1/workspaces/workspace-1/members/editor-1', { role: 'viewer' });
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(screen.getByRole('button', { name: 'Remove editor@example.com' }));
        await waitFor(() => {
            expect(mocks.apiDelete).toHaveBeenCalledWith('/api/v1/workspaces/workspace-1/members/editor-1');
        });
    });
    it('shows a server error when the requested member cannot be added', async () => {
        mocks.apiPost.mockRejectedValueOnce(new Error('User not found'));
        render(_jsx(MemoryRouter, { children: _jsx(WorkspacesPage, {}) }));
        await screen.findByRole('heading', { name: 'Personal Workspace' });
        fireEvent.change(screen.getByLabelText('Member email'), {
            target: { value: 'missing@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('User not found');
    });
});
