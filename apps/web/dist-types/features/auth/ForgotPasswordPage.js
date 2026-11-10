import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Mail } from 'lucide-react';
import { apiPost } from '../../services/http-client';
import { isValidEmail } from '../../services/validation';
import AuthPageLayout from './AuthPageLayout';
import './auth.css';
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!isValidEmail(email)) {
            setEmailError('Enter a valid email address.');
            return;
        }
        setEmailError('');
        setLoading(true);
        try {
            await apiPost('/api/v1/auth/forgot-password', { email });
        }
        catch {
            // Always show the same message regardless of outcome (no account enumeration)
        }
        finally {
            setLoading(false);
            setSubmitted(true);
        }
    }
    return (_jsx(AuthPageLayout, { title: "Reset your password", description: "Request a secure password reset link for your Vaultnary account.", children: submitted ? (_jsxs("div", { className: "auth-login__form", "aria-labelledby": "reset-sent-title", children: [_jsx("div", { className: "auth-login__status-icon", children: _jsx(Check, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "CHECK YOUR INBOX" }), _jsx("h2", { id: "reset-sent-title", children: "If there\u2019s an account, you\u2019ll hear from us" }), _jsx("p", { children: "If an account exists for that address, a reset link has been sent." })] }), _jsxs(Link, { to: "/login", className: "auth-login__text-link", children: [_jsx(ArrowLeft, { size: 14 }), " Back to sign in"] })] })) : (_jsxs("form", { onSubmit: handleSubmit, noValidate: true, "aria-label": "Reset password", className: "auth-login__form", children: [_jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "ACCOUNT RECOVERY" }), _jsx("h2", { children: "Reset password" }), _jsx("p", { children: "Enter your account email and we\u2019ll send a secure reset link if it\u2019s registered." })] }), _jsxs("div", { className: "auth-login__field", children: [_jsx("label", { htmlFor: "email", children: "Email address" }), _jsxs("div", { className: "auth-login__input-with-icon", children: [_jsx(Mail, { size: 16, "aria-hidden": "true" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", placeholder: "you@company.com", value: email, onChange: (e) => setEmail(e.target.value), "aria-describedby": emailError ? 'email-error' : undefined, "aria-invalid": !!emailError, disabled: loading })] }), emailError && _jsx("span", { id: "email-error", role: "alert", className: "auth-login__field-error", children: emailError })] }), _jsxs("button", { type: "submit", disabled: loading, className: "auth-login__submit", children: [_jsx("span", { children: loading ? 'Sending…' : 'Send reset link' }), _jsx(ArrowRight, { size: 17, "aria-hidden": "true" })] }), _jsxs(Link, { to: "/login", className: "auth-login__text-link", children: [_jsx(ArrowLeft, { size: 14 }), " Back to sign in"] })] })) }));
}
