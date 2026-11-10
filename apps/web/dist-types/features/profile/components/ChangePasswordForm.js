import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import { apiPost } from '../../../services/http-client';
import { getErrorMessage } from '../../../services/error-handler';
import { isValidPassword } from '../../../services/validation';
export default function ChangePasswordForm() {
    const { showToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        if (!isValidPassword(newPassword)) {
            setError('Your new password must be between 12 and 128 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('The new passwords do not match.');
            return;
        }
        if (currentPassword === newPassword) {
            setError('Your new password must be different from your current password.');
            return;
        }
        setSaving(true);
        try {
            await apiPost('/api/v1/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            showToast({ message: 'Password changed. Other active sessions have been signed out.', type: 'success' });
        }
        catch (cause) {
            setError(getErrorMessage(cause));
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("form", { className: "profile-password-form", onSubmit: handleSubmit, "aria-label": "Change password", children: [error && _jsx("p", { className: "profile-alert", role: "alert", children: error }), _jsxs("label", { className: "profile-field", children: [_jsx("span", { children: "Current password" }), _jsx("input", { type: showPasswords ? 'text' : 'password', autoComplete: "current-password", value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value), required: true, disabled: saving })] }), _jsxs("label", { className: "profile-field", children: [_jsx("span", { children: "New password" }), _jsx("input", { type: showPasswords ? 'text' : 'password', autoComplete: "new-password", minLength: 12, maxLength: 128, value: newPassword, onChange: (event) => setNewPassword(event.target.value), required: true, disabled: saving, "aria-describedby": "profile-password-hint" })] }), _jsxs("label", { className: "profile-field", children: [_jsx("span", { children: "Confirm new password" }), _jsx("input", { type: showPasswords ? 'text' : 'password', autoComplete: "new-password", minLength: 12, maxLength: 128, value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value), required: true, disabled: saving, "aria-invalid": Boolean(confirmPassword) && newPassword !== confirmPassword })] }), _jsx("p", { className: "profile-field-hint", id: "profile-password-hint", children: "Use 12\u2013128 characters. Changing your password signs out your other active sessions." }), _jsxs("div", { className: "profile-form-actions", children: [_jsxs("button", { className: "profile-secondary-button", type: "button", onClick: () => setShowPasswords((visible) => !visible), "aria-pressed": showPasswords, disabled: saving, children: [showPasswords ? _jsx(EyeOff, { size: 16, "aria-hidden": "true" }) : _jsx(Eye, { size: 16, "aria-hidden": "true" }), showPasswords ? 'Hide passwords' : 'Show passwords'] }), _jsxs("button", { className: "profile-primary-button", type: "submit", disabled: saving, children: [_jsx(KeyRound, { size: 16, "aria-hidden": "true" }), saving ? 'Updating…' : 'Update password'] })] })] }));
}
