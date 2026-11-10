import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, LoaderCircle, ShieldAlert } from 'lucide-react';
import { apiGet } from '../../services/http-client';
import AuthPageLayout from './AuthPageLayout';
import './auth.css';
export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const [state, setState] = useState('loading');
    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setState('error');
            return;
        }
        apiGet(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
            .then(() => setState('success'))
            .catch(() => setState('error'));
    }, [searchParams]);
    return (_jsx(AuthPageLayout, { title: "Verify your email", description: "Verify the email address for your Vaultnary account.", children: _jsxs("div", { className: "auth-login__form", "aria-live": "polite", children: [state === 'loading' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "auth-login__status-icon auth-login__status-icon--loading", children: _jsx(LoaderCircle, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "SECURE ACCOUNT SETUP" }), _jsx("h2", { children: "Verifying your email" }), _jsx("p", { role: "status", children: "We\u2019re confirming your address and activating your account." })] })] })), state === 'success' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "auth-login__status-icon", children: _jsx(Check, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "VERIFICATION COMPLETE" }), _jsx("h2", { children: "Email verified" }), _jsx("p", { children: "Your account is active. Sign in to continue to your secure workspace." })] }), _jsxs(Link, { to: "/login", className: "auth-login__submit auth-login__submit--link", children: [_jsx("span", { children: "Sign in securely" }), _jsx(ArrowRight, { size: 17 })] })] })), state === 'error' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "auth-login__status-icon auth-login__status-icon--error", children: _jsx(ShieldAlert, { size: 23 }) }), _jsxs("div", { className: "auth-login__form-heading", children: [_jsx("span", { className: "auth-login__form-kicker", children: "VERIFICATION NEEDED" }), _jsx("h2", { children: "Couldn\u2019t verify this link" }), _jsx("p", { children: "The link may be expired or already used. Sign in or request a new verification email." })] }), _jsxs(Link, { to: "/login", className: "auth-login__submit auth-login__submit--link", children: [_jsx("span", { children: "Back to sign in" }), _jsx(ArrowRight, { size: 17 })] })] }))] }) }));
}
