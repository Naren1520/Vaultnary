import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fireEvent, render, screen } from '@testing-library/react';
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
import WorkspaceHomePage from './WorkspaceHomePage';
const workspace = {
    id: 'workspace-1',
    name: 'Engineering',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
};
describe('WorkspaceHomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiGet.mockResolvedValue({ data: [] });
    });
    it('shows a first-workspace empty state and creates a workspace before opening projects', async () => {
        mocks.apiPost.mockResolvedValue({ data: workspace });
        render(_jsx(MemoryRouter, { initialEntries: ['/app/workspaces'], children: _jsxs(Routes, { children: [_jsx(Route, { path: "/app/workspaces", element: _jsx(WorkspaceHomePage, {}) }), _jsx(Route, { path: "/app/workspaces/:workspaceId/projects", element: _jsx("p", { children: "Workspace projects" }) })] }) }));
        expect(await screen.findByRole('status', { name: 'Create your first workspace' }))
            .toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Workspace name'), {
            target: { value: 'Engineering' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
        expect(await screen.findByText('Workspace projects')).toBeInTheDocument();
        expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/workspaces', { name: 'Engineering' });
    });
    it('renders existing workspaces as cards that open their projects', async () => {
        mocks.apiGet.mockResolvedValue({ data: [workspace] });
        render(_jsx(MemoryRouter, { initialEntries: ['/app/workspaces'], children: _jsx(WorkspaceHomePage, {}) }));
        expect(await screen.findByRole('link', { name: /Engineering/ }))
            .toHaveAttribute('href', '/app/workspaces/workspace-1/projects');
    });
});
