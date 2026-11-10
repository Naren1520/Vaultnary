import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowDown, ArrowRight, KeyRound, LifeBuoy, LockKeyhole, Search, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../legal/PublicSiteLayout';
import { CONTACT_EMAIL } from './constants';
import './company.css';
const faqGroups = [
    {
        title: 'Getting started',
        icon: Users,
        questions: [
            {
                question: 'How do I create a Vaultnary account?',
                answer: 'Choose Get started, enter your email and a strong password, then follow the verification link we send you. Once verified, sign in and create a workspace for your team.',
            },
            {
                question: 'I didn’t receive my verification email. What should I do?',
                answer: 'Check your spam or promotions folder and confirm the email address you entered. You can use the verification page to request another email. If it still doesn’t arrive, contact support with the address you used—never send us your password.',
            },
            {
                question: 'How should I organize credentials?',
                answer: 'Create a workspace for a team, use projects to group related work, and add credentials where they make sense for your setup. Clear names make it easier for teammates to find the right item.',
            },
        ],
    },
    {
        title: 'Sign-in and recovery',
        icon: KeyRound,
        questions: [
            {
                question: 'I forgot my account password. Can I reset it?',
                answer: 'Yes. Use Forgot password on the sign-in page and follow the link sent to your account email. If you no longer have access to that inbox, contact us for help with your account.',
            },
            {
                question: 'I forgot my vault master password. Can support recover it?',
                answer: 'No. Vaultnary is designed so your vault is encrypted in your browser and support cannot decrypt it for you. If you configured recovery, follow the in-product recovery flow. Without the required password or recovery information, encrypted vault contents may be permanently inaccessible.',
            },
            {
                question: 'What should I do if I think my account is compromised?',
                answer: 'Change your account password as soon as possible, review and revoke sessions in the Security area, and ask a workspace administrator to review membership and sharing. Contact us promptly if you need help securing access.',
            },
        ],
    },
    {
        title: 'Vault security and sharing',
        icon: LockKeyhole,
        questions: [
            {
                question: 'What information is encrypted?',
                answer: 'Sensitive vault fields are encrypted in your browser before they are stored. Account, workspace, project, service, and credential labels and other operational metadata are not all encrypted. See the Security page for more detail about the current design.',
            },
            {
                question: 'How can I give a teammate access?',
                answer: 'Invite them to the relevant workspace and grant only the membership role and credential permissions they need. Check access when someone changes teams or no longer needs it.',
            },
            {
                question: 'Can I send a password or recovery phrase to support?',
                answer: 'No. Never send passwords, recovery phrases, private keys, or live credential values by email or through the contact form. We don’t need them to help troubleshoot the application.',
            },
        ],
    },
    {
        title: 'Account and data',
        icon: ShieldCheck,
        questions: [
            {
                question: 'How do I request account or personal-data deletion?',
                answer: 'Send a request using the contact form or email us from the address associated with your account. We may ask you to verify ownership before handling it. Read the Privacy Notice for information about data retention and encrypted backups.',
            },
            {
                question: 'Can I export my vault?',
                answer: 'Vaultnary provides a vault export flow in the application. Treat any exported archive as sensitive: store it securely, share it carefully, and remove temporary copies when you no longer need them.',
            },
            {
                question: 'Where can I report a security issue?',
                answer: 'Please report suspected security issues privately through the contact page or directly by email. Include steps to reproduce the issue, but do not include real credentials or information belonging to another person.',
            },
        ],
    },
];
export default function SupportPage() {
    const [query, setQuery] = useState('');
    const normalizedQuery = query.trim().toLowerCase();
    const filteredGroups = faqGroups
        .map((group) => ({
        ...group,
        questions: group.questions.filter(({ question, answer }) => `${question} ${answer}`.toLowerCase().includes(normalizedQuery)),
    }))
        .filter((group) => group.questions.length > 0);
    return (_jsx(PublicSiteLayout, { children: _jsxs("div", { className: "company-page company-support-page", children: [_jsx("section", { className: "company-hero company-support-hero", children: _jsxs("div", { className: "public-container", children: [_jsx("p", { className: "legal-eyebrow", children: "Help center" }), _jsx("h1", { children: "Answers for the moments that matter." }), _jsx("p", { children: "Find guidance on getting started, account access, recovery, and sharing. Still stuck? Our team is one message away." }), _jsxs("a", { className: "company-support-hero__jump", href: "#support-faqs", children: ["Browse common questions ", _jsx(ArrowDown, { size: 15, "aria-hidden": "true" })] })] }) }), _jsxs("section", { className: "company-content public-container", id: "support-faqs", children: [_jsxs("div", { className: "company-support-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "Frequently asked questions" }), _jsx("h2", { children: "Let\u2019s find your answer." })] }), _jsxs("label", { className: "company-faq-search", children: [_jsx(Search, { size: 17, "aria-hidden": "true" }), _jsx("span", { className: "visually-hidden", children: "Search help articles" }), _jsx("input", { type: "search", placeholder: "Search common questions", value: query, onChange: (event) => setQuery(event.target.value) })] })] }), filteredGroups.length > 0 ? (_jsx("div", { className: "company-faq-groups", children: filteredGroups.map(({ title, icon: Icon, questions }) => (_jsxs("section", { className: "company-faq-group", children: [_jsxs("div", { className: "company-faq-group__heading", children: [_jsx("span", { children: _jsx(Icon, { size: 18, "aria-hidden": "true" }) }), _jsx("h3", { children: title })] }), _jsx("div", { className: "company-faq-list", children: questions.map(({ question, answer }) => (_jsxs("details", { className: "company-faq", children: [_jsxs("summary", { children: [question, _jsx("span", { "aria-hidden": "true" })] }), _jsx("p", { children: answer })] }, question))) })] }, title))) })) : (_jsxs("div", { className: "company-faq-empty", role: "status", children: [_jsxs("p", { children: ["No answers matched \u201C", query, "\u201D. Try a different search or ask us directly."] }), _jsxs(Link, { to: "/contact", children: ["Contact support ", _jsx(ArrowRight, { size: 15, "aria-hidden": "true" })] })] })), _jsxs("div", { className: "company-support-callout", children: [_jsx("div", { className: "company-support-callout__icon", children: _jsx(LifeBuoy, { size: 21, "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("p", { className: "legal-eyebrow", children: "A person can help" }), _jsx("h2", { children: "Didn\u2019t find what you need?" }), _jsx("p", { children: "Tell us what you\u2019re trying to do and what happened. Please leave passwords and secret values out of your message." })] }), _jsxs(Link, { className: "public-button", to: "/contact", children: ["Contact support ", _jsx(ArrowRight, { size: 16, "aria-hidden": "true" })] })] }), _jsxs("p", { className: "company-support-email", children: ["Or email us directly at ", _jsx("a", { href: `mailto:${CONTACT_EMAIL}`, children: CONTACT_EMAIL }), "."] })] })] }) }));
}
