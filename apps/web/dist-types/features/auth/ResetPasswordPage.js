import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { apiPost } from '../../services/http-client';
import { getErrorMessage } from '../../services/error-handler';
import { isValidPassword } from '../../services/validation';
import AuthPageLayout from './AuthPageLayout';
import './auth.css';
export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token')?.trim() ?? '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        if (!token) {
            setError('This reset link is missing its token. Request a new reset email and use the latest link.');
            return;
        }
        if (!isValidPassword(password)) {
            setError('Your password must be between 12 and 128 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('The passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await apiPost('/api/v1/auth/reset-password', {
                token,
                new_password: password,
            });
            setSubmitted(true);
        }
        catch (requestError) {
            setError(getErrorMessage(requestError));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(AuthPageLayout, { title: "Choose a new password", description: "Set a new password for your Vaultnary account using your password reset link.", children: submitted ? (_jsxs("div", { className: "auth-login__form", "aria-live": "polite", children: [_jsx("div", { className: "auth-login__status-icon", children: _jsx(Check, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "PASSWORD UPDATED" }), _jsx("h2", { children: "Password reset complete" }), _jsx("p", { children: "Your password has been changed. Sign in with your new password to continue." })] }), _jsxs(Link, { to: "/login", className: "auth-login__submit auth-login__submit--link", children: [_jsx("span", { children: "Go to sign in" }), _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] })] })) : (_jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Choose a new password", className: "auth-login__form", children: [_jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "ACCOUNT RECOVERY" }), _jsx("h2", { children: "Choose a new password" }), _jsx("p", { children: "Use at least 12 characters. Your new password will replace your current sign-in password." })] }), !token && (_jsxs("div", { className: "auth-login__alert", role: "alert", children: [_jsx(ShieldAlert, { size: 16, "aria-hidden": "true" }), "This reset link is missing its token. Request a new reset email."] })), error && token && _jsx("p", { id: "reset-error", className: "auth-login__alert", role: "alert", children: error }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "new-password", children: "New password" }), _jsxs("div", { className: "auth-login__password-wrap", children: [_jsx("input", { id: "new-password", type: showPassword ? 'text' : 'password', autoComplete: "new-password", minLength: 12, maxLength: 128, value: password, onChange: (event) => setPassword(event.target.value), disabled: loading || !token, "aria-describedby": error ? 'reset-error' : undefined }), _jsx("button", { className: "auth-login__password-toggle", type: "button", onClick: () => setShowPassword((visible) => !visible), "aria-label": showPassword ? 'Hide password' : 'Show password', "aria-pressed": showPassword, disabled: loading || !token, children: showPassword ? _jsx(EyeOff, { size: 17 }) : _jsx(Eye, { size: 17 }) })] })] }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "confirm-password", children: "Confirm new password" }), _jsxs("div", { className: "auth-login__input-with-icon", children: [_jsx(KeyRound, { size: 16, "aria-hidden": "true" }), _jsx("input", { id: "confirm-password", type: showPassword ? 'text' : 'password', autoComplete: "new-password", minLength: 12, maxLength: 128, value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value), disabled: loading || !token, "aria-invalid": Boolean(confirmPassword) && password !== confirmPassword })] })] }), _jsxs("button", { type: "submit", disabled: loading || !token, className: "auth-login__submit", children: [_jsx("span", { children: loading ? 'Updating password…' : 'Update password' }), _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] }), _jsxs(Link, { to: "/forgot-password", className: "auth-login__text-link", children: [_jsx(ArrowLeft, { size: 14, "aria-hidden": "true" }), " Request a new reset link"] })] })) }));
}
