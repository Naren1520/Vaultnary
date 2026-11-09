import { jsx as _jsx } from "react/jsx-runtime";
import LegalDocumentPage, { PRIVACY_EMAIL } from './LegalDocumentPage';
const sections = [
    {
        id: 'scope',
        title: 'Who operates Vaultnary',
        paragraphs: [
            'Vaultnary is operated by [Vaultnary operator legal name and address - to be completed]. This Privacy Notice explains what information the current service processes, why it is used, and how to contact us about it.',
            'This notice describes the current application and deployment as of the date above. It should be reviewed and updated whenever the service, its providers, or its data practices change.',
        ],
    },
    {
        id: 'information',
        title: 'Information the service processes',
        paragraphs: [
            'When you create and use an account, Vaultnary processes your email address, a password hash (not your account password in plain text), and account verification or password-reset token hashes.',
            'Vaultnary stores encrypted credential payloads and encrypted key material. Workspace, project, service, credential labels, membership, permission, and sharing information are operational metadata and may be readable by the service. Do not assume that names or organizational metadata are encrypted just because secret fields are.',
            'For sign-in, session management, and security activity, the service may process IP address, browser user-agent, an optional device fingerprint, session timestamps, audit-event type, and related resource identifiers.',
        ],
    },
    {
        id: 'use',
        title: 'How information is used',
        paragraphs: ['Information is used to:'],
        bullets: [
            'Create and authenticate accounts, maintain sessions, verify email addresses, and process password recovery.',
            'Provide vault, workspace, project, service, membership, sharing, and audit features that users request.',
            'Send essential account emails, protect the service, detect misuse, troubleshoot failures, and respond to privacy or security requests.',
            'Meet legal obligations and establish, exercise, or defend legal claims where necessary.',
        ],
    },
    {
        id: 'encryption',
        title: 'Vault encryption',
        paragraphs: [
            'The documented design encrypts vault secret fields in the browser using AES-GCM before upload. Key derivation and secret decryption run in the browser. The backend stores encrypted payloads, encrypted key material, password hashes, and metadata; it is not intended to receive plaintext vault secrets or private keys.',
            'This design does not encrypt every piece of account or workspace metadata. It also cannot protect information after it is decrypted on a device you control. Keep your browser, device, account password, and recovery information secure.',
        ],
    },
    {
        id: 'cookies',
        title: 'Cookies and session data',
        paragraphs: [
            'Vaultnary uses a session cookie to keep you signed in. In production the cookie is configured as HttpOnly and Secure with cross-site SameSite settings needed by the deployed frontend and API. A CSRF token is held in application memory to protect authenticated requests.',
            'The service also keeps session and audit records for account security and activity views. Browser settings can block cookies, but signing in may then stop working.',
        ],
    },
    {
        id: 'providers',
        title: 'Service providers',
        paragraphs: [
            'Vaultnary relies on service providers to operate the application. The current deployment uses Vercel for the web frontend, Render for the API and PostgreSQL database, Upstash for Redis, and Resend to deliver account emails. These providers process information as needed to provide their infrastructure or delivery services.',
            'Provider arrangements may change. Each provider’s own privacy and security terms also apply to its services. The operator should keep this list current and review applicable data-processing terms.',
        ],
    },
    {
        id: 'sharing',
        title: 'When information is shared',
        paragraphs: [
            'Vaultnary does not make your workspace private from people you invite. Workspace members and credential recipients may see metadata or decrypted credential content according to the permissions and sharing choices made in the product.',
            'Information may also be processed by the providers described above, or disclosed when required by law or reasonably necessary to protect users, the service, or legal rights. We do not publish personal information for advertising purposes.',
        ],
    },
    {
        id: 'retention',
        title: 'Retention and deletion',
        paragraphs: [
            'The current application has no self-service account deletion feature and does not publish a fixed deletion or backup-purge period. Account, workspace, encrypted vault, session, and audit records may remain in operational storage while an account is in use and for a period afterward for security, recovery, legal, or service-continuity needs.',
            `To request access, correction, or deletion of personal information, email ${PRIVACY_EMAIL}. We may need to verify your identity and clarify which account is yours. We will review requests under applicable law and explain any information we cannot delete or the reason for continued retention. The operator must define and publish actual retention periods before treating this draft as final.`,
            'Deleting an account or requesting deletion cannot recover encrypted secrets. Make sure you have any information you need before requesting removal.',
        ],
    },
    {
        id: 'india',
        title: 'Your choices and Indian privacy law',
        paragraphs: [
            'You can keep your account details accurate, manage workspace sharing, revoke sessions where the product provides that control, and contact us about personal-data requests. Requests will be handled in accordance with applicable Indian privacy and data-protection law, including the Digital Personal Data Protection Act, 2023, to the extent it applies.',
            'The operator’s legal identity, address, and any legally required grievance contact must be completed and verified before publication. This draft does not promise a specific response deadline or override statutory rights.',
        ],
    },
    {
        id: 'updates-contact',
        title: 'Updates and contact',
        paragraphs: [
            `For privacy questions or requests, contact ${PRIVACY_EMAIL}. We will update the date at the top when this notice changes. Please revisit this page to review the current notice.`,
        ],
    },
];
export default function PrivacyPage() {
    return (_jsx(LegalDocumentPage, { title: "Privacy Notice", eyebrow: "Your information, explained", description: "A clear account of the data Vaultnary processes to provide the service and protect accounts.", sections: sections }));
}
