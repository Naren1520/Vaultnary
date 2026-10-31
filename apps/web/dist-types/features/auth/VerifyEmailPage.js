import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiGet } from '../../services/http-client';
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
    return (_jsx("div", { style: pageStyle, children: _jsxs("div", { style: cardStyle, children: [state === 'loading' && (_jsx("p", { style: mutedStyle, role: "status", children: "Verifying your email\u2026" })), state === 'success' && (_jsxs(_Fragment, { children: [_jsx("h1", { style: headingStyle, children: "Email verified" }), _jsx("p", { style: mutedStyle, children: "Your account is now active." }), _jsx(Link, { to: "/login", style: linkStyle, children: "Sign in" })] })), state === 'error' && (_jsxs(_Fragment, { children: [_jsx("h1", { style: headingStyle, children: "Verification failed" }), _jsx("p", { style: mutedStyle, children: "The link may be expired or already used. Request a new one below." }), _jsx(Link, { to: "/login", style: linkStyle, children: "Back to sign in" })] }))] }) }));
}
const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)' };
const cardStyle = { width: '100%', maxWidth: '24rem', backgroundColor: 'var(--color-bg)', border: 'var(--border-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', textAlign: 'center' };
const headingStyle = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)' };
const mutedStyle = { fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' };
const linkStyle = { color: 'var(--color-accent)', fontSize: 'var(--text-sm)' };
