import { jsx as _jsx } from "react/jsx-runtime";
import LegalDocumentPage from './LegalDocumentPage';
const sections = [
    {
        id: 'agreement',
        title: 'Agreement and the service',
        paragraphs: [
            'These terms apply when you access or use Vaultnary. The service is operated by [Vaultnary operator legal name and address - to be completed] (“Vaultnary”, “we”, “us”). By creating an account or using the service, you agree to these terms.',
            'If you use Vaultnary for an organization, you confirm that you are authorized to accept these terms for that organization. “You” then includes both you and the organization.',
        ],
    },
    {
        id: 'accounts',
        title: 'Accounts and security',
        paragraphs: [
            'You must provide a valid email address, keep your account information current, and protect your sign-in credentials and recovery information. You are responsible for activity performed through your account, except where applicable law says otherwise.',
            'Use a unique, strong password and notify us promptly if you believe your account or a device has been compromised. We may require email verification and may limit access to protect accounts or the service.',
        ],
    },
    {
        id: 'vault-encryption',
        title: 'Vault encryption and recovery',
        paragraphs: [
            'Vaultnary is designed so sensitive credential fields are encrypted in your browser before they are stored. The service stores encrypted vault payloads and encrypted key material alongside account, workspace, project, and other operational metadata.',
            'The service cannot decrypt vault content without the required keys. If you lose your master password and any recovery method you configured, your encrypted credentials may become permanently inaccessible. Keep recovery information secure and separate from your account password.',
        ],
    },
    {
        id: 'workspaces',
        title: 'Workspaces and sharing',
        paragraphs: [
            'You control who you invite and what access you grant through the workspace and credential permission features. Before sharing an item, confirm that each recipient is authorized to receive it. Changes to membership or permissions may affect access to shared information.',
            'You are responsible for the content you add and for having the rights and authority needed to store or share it. Do not use Vaultnary to store or distribute information unlawfully or without authorization.',
        ],
    },
    {
        id: 'acceptable-use',
        title: 'Acceptable use',
        paragraphs: ['You agree not to misuse, disrupt, or attempt to compromise Vaultnary or other users. In particular, do not:'],
        bullets: [
            'Access an account, workspace, or credential without permission.',
            'Probe, scan, or test systems in a way that could harm service availability or expose other users’ data.',
            'Upload malicious code, abuse the service, or use it to violate another person’s rights or applicable law.',
            'Circumvent security controls, rate limits, or access restrictions.',
        ],
    },
    {
        id: 'your-content',
        title: 'Your content and our service',
        paragraphs: [
            'You retain your rights to information you submit. You grant Vaultnary only the limited permission needed to host, transmit, back up, and display that information to provide the service and the features you choose to use.',
            'Vaultnary and its underlying software, branding, and design remain the property of their respective owners. These terms do not transfer ownership of either party’s intellectual property.',
        ],
    },
    {
        id: 'availability',
        title: 'Availability and changes',
        paragraphs: [
            'We work to keep Vaultnary useful and available, but the service may change, be interrupted, or become unavailable for maintenance, security, or operational reasons. We do not promise a particular uptime or that every feature will remain available indefinitely.',
            'We may update these terms as the service or applicable requirements change. We will update the date above when we publish revisions. Continued use after an updated version takes effect is subject to applicable law and any notice or consent it requires.',
        ],
    },
    {
        id: 'warranties',
        title: 'Disclaimers and liability',
        paragraphs: [
            'To the extent permitted by applicable law, Vaultnary is provided “as is” and “as available”. We do not make a warranty that the service will be uninterrupted, error-free, or suitable for every use. You should keep independent, secure records of recovery information and maintain appropriate access controls.',
            'Nothing in these terms limits a right or remedy that cannot lawfully be limited. To the extent permitted by law, neither party is liable for indirect or consequential loss arising from use of the service. Any other liability limits must be interpreted only as permitted by applicable law.',
        ],
    },
    {
        id: 'suspension',
        title: 'Suspension and ending use',
        paragraphs: [
            'You may stop using Vaultnary at any time. The current application does not provide a self-service account deletion control; contact us to request account or personal-data deletion. We may temporarily restrict access when reasonably necessary to protect users, investigate misuse, or comply with law.',
            'Because vault content is encrypted, ending access to an account does not itself guarantee that every encrypted record or backup is immediately erased. See the Privacy Notice for the current deletion and retention limitations.',
        ],
    },
    {
        id: 'law',
        title: 'Governing law and contact',
        paragraphs: [
            'These terms are governed by the laws of India, subject to mandatory protections and rules that apply to you. Courts with competent jurisdiction in India will hear disputes, subject to applicable law. The operator’s legal identity and address must be completed before these terms are treated as final.',
            'For questions about these terms, contact Vaultnary at the address listed in the Privacy Notice.',
        ],
    },
];
export default function TermsPage() {
    return (_jsx(LegalDocumentPage, { title: "Terms of Service", eyebrow: "The details that matter", description: "The ground rules for using Vaultnary to organize and share team credentials.", sections: sections }));
}
