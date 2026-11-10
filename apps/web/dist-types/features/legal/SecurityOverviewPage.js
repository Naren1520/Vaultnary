import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, Check, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import PublicSiteLayout from './PublicSiteLayout';
const principles = [
    {
        icon: LockKeyhole,
        title: 'Encrypt before storage',
        body: 'Vault secret fields are encrypted in the browser before they are sent to the API. Stored payloads and key envelopes remain encrypted.',
    },
    {
        icon: KeyRound,
        title: 'Keep keys on your side',
        body: 'The documented key flow derives encryption keys in the browser. The backend is not designed to receive plaintext vault secrets or private keys.',
    },
    {
        icon: Fingerprint,
        title: 'Protect account access',
        body: 'Account passwords are stored as Argon2id password hashes. Session tokens are random, stored server-side as hashes, and delivered in protected session cookies.',
    },
    {
        icon: ShieldCheck,
        title: 'Make access visible',
        body: 'Workspace membership, explicit credential permissions, session management, and audit activity help teams review and manage access.',
    },
];
export default function SecurityOverviewPage() {
    return (_jsx(PublicSiteLayout, { title: "Security", description: "Learn how Vaultnary protects sensitive credential fields with browser-side encryption and helps teams manage workspace access.", children: _jsxs("div", { className: "security-page", children: [_jsx("section", { className: "security-hero", children: _jsxs("div", { className: "public-container", children: [_jsx("p", { className: "legal-eyebrow", children: "Vaultnary security" }), _jsxs("h1", { children: ["Designed to keep secrets", _jsx("br", {}), "out of reach."] }), _jsx("p", { children: "Sensitive credential fields are encrypted in your browser before they are stored. Learn what that means-and what remains visible to provide the service." }), _jsxs("span", { className: "security-hero__note", children: [_jsx(LockKeyhole, { size: 15, "aria-hidden": "true" }), " Security design, in plain language"] })] }) }), _jsx("section", { className: "security-principles", "aria-labelledby": "security-principles-title", children: _jsxs("div", { className: "public-container", children: [_jsxs("div", { className: "security-section-heading", children: [_jsx("p", { className: "legal-eyebrow", children: "How protection is built in" }), _jsx("h2", { id: "security-principles-title", children: "Security across the details." }), _jsx("p", { children: "These points describe the current documented design, not an independent certification." })] }), _jsx("div", { className: "security-card-grid", children: principles.map(({ icon: Icon, title, body }, index) => (_jsxs("article", { className: "security-card", children: [_jsxs("span", { className: "security-card__number", children: ["0", index + 1] }), _jsx("span", { className: "security-card__icon", children: _jsx(Icon, { size: 20, "aria-hidden": "true" }) }), _jsx("h3", { children: title }), _jsx("p", { children: body })] }, title))) })] }) }), _jsx("section", { className: "security-details", children: _jsxs("div", { className: "public-container security-details__grid", children: [_jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "Know what is protected" }), _jsx("h2", { children: "Secret fields and account metadata are different." })] }), _jsxs("div", { className: "security-details__copy", children: [_jsx("p", { children: "Vault items are encrypted using AES-256-GCM in the browser. The documented design uses Argon2id for key derivation and RSA-OAEP envelopes to support key sharing. Your master password and recovery passphrase are not sent to the server as decryption keys." }), _jsx("p", { children: "Account email, workspace and project names, membership, permissions, and service labels are operational metadata. Session and security records can include IP address, browser details, and timestamps. Treat these details as service data, not encrypted vault secrets." }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx(Check, { size: 16, "aria-hidden": "true" }), " Never share your master password or recovery passphrase."] }), _jsxs("li", { children: [_jsx(Check, { size: 16, "aria-hidden": "true" }), " Grant credential access only to intended teammates."] }), _jsxs("li", { children: [_jsx(Check, { size: 16, "aria-hidden": "true" }), " Keep a separate, secure copy of recovery information."] })] })] })] }) }), _jsx("section", { className: "security-report", children: _jsxs("div", { className: "public-container security-report__inner", children: [_jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "Responsible disclosure" }), _jsx("h2", { children: "Found a security issue?" }), _jsx("p", { children: "Please report it privately so it can be reviewed without exposing users." })] }), _jsxs("a", { className: "public-button public-button--light", href: "mailto:narensonu1520@gmail.com", children: ["Contact security ", _jsx(ArrowRight, { size: 16, "aria-hidden": "true" })] })] }) })] }) }));
}
