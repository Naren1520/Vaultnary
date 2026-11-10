import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../../state/auth-store';
import { useVaultStore } from '../../../state/vault-store';
const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiDelete: vi.fn(),
}));
vi.mock('../../../services/http-client', () => ({
    apiGet: mocks.apiGet,
    apiDelete: mocks.apiDelete,
}));
import AccountDeletionSection from './AccountDeletionSection';
const emptyPreview = {
    email: 'person@example.com',
    deletion_scope: {
        workspace_count: 0,
        personal_credentials_to_delete: 2,
        shared_credentials_to_transfer: 0,
        shared_credentials_you_access: 1,
        projects_to_remove_or_transfer: 1,
        services_to_remove_or_transfer: 0,
        collaborators_to_notify: 0,
    },
    workspaces: [],
    owned_credentials: [
        {
            id: 'secret-1',
            name: 'Private credential',
            workspace_id: 'workspace-1',
            shared_with: 0,
            will_be_deleted: true,
            requires_transfer: false,
            transfer_candidates: [],
        },
    ],
};
function renderDeletionSection() {
    return render(_jsx(MemoryRouter, { initialEntries: ['/app/profile'], children: _jsxs(Routes, { children: [_jsx(Route, { path: "/app/profile", element: _jsx(AccountDeletionSection, {}) }), _jsx(Route, { path: "/login", element: _jsx("h1", { children: "Login page" }) })] }) }));
}
describe('AccountDeletionSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.getState().setCsrfToken('csrf-token');
        useVaultStore.getState().lockVault();
        mocks.apiGet.mockResolvedValue({ data: emptyPreview });
        mocks.apiDelete.mockResolvedValue({ data: { deleted: true } });
    });
    it('reviews affected data and requires both confirmation steps before deletion', async () => {
        renderDeletionSection();
        expect(await screen.findByText('Private credential')).toBeInTheDocument();
        expect(screen.getByText('Shared credentials you can access')).toBeInTheDocument();
        expect(mocks.apiGet).toHaveBeenCalledWith('/api/v1/users/me/deletion-preview', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue to confirmation' }));
        fireEvent.change(screen.getByLabelText('Current password'), {
            target: { value: 'current-password' },
        });
        fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
            target: { value: 'DELETE' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }));
        expect(mocks.apiDelete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByLabelText('I understand that account deletion is permanent and cannot be undone.'));
        fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }));
        await waitFor(() => {
            expect(mocks.apiDelete).toHaveBeenCalledWith('/api/v1/users/me', {
                current_password: 'current-password',
                confirmation: 'DELETE',
                workspace_transfers: [],
                item_transfers: [],
            });
        });
        expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
        expect(useAuthStore.getState().csrfToken).toBeNull();
        expect(useVaultStore.getState().isUnlocked).toBe(false);
    });
    it('requires a workspace owner to be chosen before the final confirmation step', async () => {
        mocks.apiGet.mockResolvedValue({
            data: {
                ...emptyPreview,
                workspaces: [{
                        id: 'workspace-1',
                        name: 'Team workspace',
                        role: 'owner',
                        owned_by_you: true,
                        remaining_members: 1,
                        remaining_admins: 1,
                        shared_credentials: 0,
                        will_be_preserved: true,
                        requires_owner_transfer: true,
                        transfer_candidates: [{
                                user_id: 'member-1',
                                email: 'member@example.com',
                                role: 'admin',
                                is_workspace_member: true,
                                has_public_key: true,
                                public_key_fingerprint: 'fingerprint',
                            }],
                    }],
            },
        });
        renderDeletionSection();
        const continueButton = await screen.findByRole('button', { name: 'Continue to confirmation' });
        expect(continueButton).toBeDisabled();
        fireEvent.change(screen.getByLabelText('New owner for Team workspace'), {
            target: { value: 'member-1' },
        });
        expect(continueButton).toBeEnabled();
    });
});
