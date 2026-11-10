import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
}));
vi.mock('../../services/http-client', () => ({
    apiPost: mocks.apiPost,
}));
import ResetPasswordPage from './ResetPasswordPage';
function renderResetPage(path = '/reset-password?token=valid-reset-token') {
    return render(_jsx(MemoryRouter, { initialEntries: [path], children: _jsx(ResetPasswordPage, {}) }));
}
describe('ResetPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiPost.mockResolvedValue(undefined);
    });
    it('submits the token and matching new password', async () => {
        renderResetPage();
        const newPassword = 'correct-horse-battery';
        fireEvent.change(screen.getByLabelText('New password'), {
            target: { value: newPassword },
        });
        fireEvent.change(screen.getByLabelText('Confirm new password'), {
            target: { value: newPassword },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
                token: 'valid-reset-token',
                new_password: newPassword,
            });
        });
        expect(await screen.findByRole('heading', { name: 'Password reset complete' })).toBeInTheDocument();
    });
    it('does not submit when passwords do not match', async () => {
        renderResetPage();
        fireEvent.change(screen.getByLabelText('New password'), {
            target: { value: 'correct-horse-battery' },
        });
        fireEvent.change(screen.getByLabelText('Confirm new password'), {
            target: { value: 'different-password-value' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The passwords do not match.');
        expect(mocks.apiPost).not.toHaveBeenCalled();
    });
    it('explains an expired or invalid reset link', async () => {
        mocks.apiPost.mockRejectedValueOnce(new Error('Invalid or expired reset token'));
        renderResetPage();
        fireEvent.change(screen.getByLabelText('New password'), {
            target: { value: 'correct-horse-battery' },
        });
        fireEvent.change(screen.getByLabelText('Confirm new password'), {
            target: { value: 'correct-horse-battery' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired reset token');
        expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeInTheDocument();
    });
    it('requires a reset token before enabling the form', () => {
        renderResetPage('/reset-password');
        expect(screen.getByRole('alert')).toHaveTextContent('missing its token');
        expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled();
    });
});
