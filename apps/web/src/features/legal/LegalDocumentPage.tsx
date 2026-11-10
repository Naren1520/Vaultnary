import { ArrowLeft, ArrowUpRight, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicSiteLayout from './PublicSiteLayout'

export interface LegalSection {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
}

interface LegalDocumentPageProps {
  title: string
  eyebrow: string
  description: string
  sections: LegalSection[]
}

export const LEGAL_UPDATED = 'November 9, 2026'
export const PRIVACY_EMAIL = 'narensonu1520@gmail.com'

export default function LegalDocumentPage({
  title,
  eyebrow,
  description,
  sections,
}: LegalDocumentPageProps) {
  return (
    <PublicSiteLayout title={title} description={description}>
      <div className="legal-page">
        <div className="public-container">
          <Link className="legal-back-link" to="/">
            <ArrowLeft size={15} aria-hidden="true" /> Back to Vaultnary
          </Link>

          <header className="legal-heading">
            <span className="legal-heading__icon"><FileText size={19} aria-hidden="true" /></span>
            <p className="legal-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="legal-heading__description">{description}</p>
            <p className="legal-updated">Last updated {LEGAL_UPDATED}</p>
          </header>

          <div className="legal-review-notice" role="note">
            <strong>Publication note</strong>
            <p>
              This draft still needs the operator’s legal name and address. Have the
              final version reviewed for your business before relying on it as a legal
              agreement.
            </p>
          </div>

          <div className="legal-layout">
            <nav className="legal-toc" aria-label={`${title} contents`}>
              <p>On this page</p>
              {sections.map((section, index) => (
                <a href={`#${section.id}`} key={section.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {section.title}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              ))}
            </nav>

            <article className="legal-content">
              {sections.map((section, index) => (
                <section id={section.id} className="legal-section" key={section.id}>
                  <span className="legal-section__number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{section.title}</h2>
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    {section.bullets && (
                      <ul>
                        {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    )}
                  </div>
                </section>
              ))}
              <div className="legal-contact">
                <span>Questions about this document?</span>
                <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </div>
            </article>
          </div>
        </div>
      </div>
    </PublicSiteLayout>
  )
}
