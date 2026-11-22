import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
}));
vi.mock('../../services/http-client', () => ({
    apiPost: mocks.apiPost,
}));
import LoginPage from './LoginPage';
describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiPost.mockResolvedValue({ csrf_token: 'csrf-token' });
    });
    it('takes users to workspace management after signing in', async () => {
        render(_jsx(MemoryRouter, { initialEntries: ['/login'], children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/app/workspaces", element: _jsx("p", { children: "Workspace management" }) }), _jsx(Route, { path: "/app/vault", element: _jsx("p", { children: "Vaults landing" }) })] }) }));
        fireEvent.change(screen.getByLabelText('Email address'), {
            target: { value: 'user@example.com' },
        });
        fireEvent.change(screen.getByLabelText('Password'), {
            target: { value: 'correct horse battery staple' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in securely/i }));
        expect(await screen.findByText('Workspace management')).toBeInTheDocument();
        expect(screen.queryByText('Vaults landing')).not.toBeInTheDocument();
    });
});
