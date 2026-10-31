import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
export default function NotAuthorizedPage() {
    return (_jsxs("div", { role: "main", style: {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-8)',
            textAlign: 'center',
        }, children: [_jsx("h1", { style: { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)' }, children: "Not signed in" }), _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', maxWidth: '20rem' }, children: "You need to sign in to access this page." }), _jsx(Link, { to: "/login", style: {
                    padding: 'var(--space-2) var(--space-6)',
                    backgroundColor: 'var(--color-accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    textDecoration: 'none',
                }, children: "Sign in" })] }));
}
