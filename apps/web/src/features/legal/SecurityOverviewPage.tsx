import { ArrowRight, Check, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import PublicSiteLayout from './PublicSiteLayout'

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
]

export default function SecurityOverviewPage() {
  return (
    <PublicSiteLayout
      title="Security"
      description="Learn how Vaultnary protects sensitive credential fields with browser-side encryption and helps teams manage workspace access."
    >
      <div className="security-page">
        <section className="security-hero">
          <div className="public-container">
            <p className="legal-eyebrow">Vaultnary security</p>
            <h1>Designed to keep secrets<br />out of reach.</h1>
            <p>
              Sensitive credential fields are encrypted in your browser before they
              are stored. Learn what that means-and what remains visible to provide
              the service.
            </p>
            <span className="security-hero__note">
              <LockKeyhole size={15} aria-hidden="true" /> Security design, in plain language
            </span>
          </div>
        </section>

        <section className="security-principles" aria-labelledby="security-principles-title">
          <div className="public-container">
            <div className="security-section-heading">
              <p className="legal-eyebrow">How protection is built in</p>
              <h2 id="security-principles-title">Security across the details.</h2>
              <p>These points describe the current documented design, not an independent certification.</p>
            </div>
            <div className="security-card-grid">
              {principles.map(({ icon: Icon, title, body }, index) => (
                <article className="security-card" key={title}>
                  <span className="security-card__number">0{index + 1}</span>
                  <span className="security-card__icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="security-details">
          <div className="public-container security-details__grid">
            <div>
              <p className="legal-eyebrow">Know what is protected</p>
              <h2>Secret fields and account metadata are different.</h2>
            </div>
            <div className="security-details__copy">
              <p>
                Vault items are encrypted using AES-256-GCM in the browser. The
                documented design uses Argon2id for key derivation and RSA-OAEP
                envelopes to support key sharing. Your master password and recovery
                passphrase are not sent to the server as decryption keys.
              </p>
              <p>
                Account email, workspace and project names, membership, permissions,
                and service labels are operational metadata. Session and security
                records can include IP address, browser details, and timestamps.
                Treat these details as service data, not encrypted vault secrets.
              </p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> Never share your master password or recovery passphrase.</li>
                <li><Check size={16} aria-hidden="true" /> Grant credential access only to intended teammates.</li>
                <li><Check size={16} aria-hidden="true" /> Keep a separate, secure copy of recovery information.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="security-report">
          <div className="public-container security-report__inner">
            <div>
              <p className="legal-eyebrow">Responsible disclosure</p>
              <h2>Found a security issue?</h2>
              <p>Please report it privately so it can be reviewed without exposing users.</p>
            </div>
            <a className="public-button public-button--light" href="mailto:narensonu1520@gmail.com">
              Contact security <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </PublicSiteLayout>
  )
}
