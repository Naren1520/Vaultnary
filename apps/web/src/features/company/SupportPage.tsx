import { useState } from 'react'
import { ArrowDown, ArrowRight, KeyRound, LifeBuoy, LockKeyhole, Search, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicSiteLayout from '../legal/PublicSiteLayout'
import { CONTACT_EMAIL } from './constants'
import './company.css'

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
]

export default function SupportPage() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredGroups = faqGroups
    .map((group) => ({
      ...group,
      questions: group.questions.filter(({ question, answer }) =>
        `${question} ${answer}`.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.questions.length > 0)

  return (
    <PublicSiteLayout>
      <div className="company-page company-support-page">
        <section className="company-hero company-support-hero">
          <div className="public-container">
            <p className="legal-eyebrow">Help center</p>
            <h1>Answers for the moments that matter.</h1>
            <p>
              Find guidance on getting started, account access, recovery, and sharing.
              Still stuck? Our team is one message away.
            </p>
            <a className="company-support-hero__jump" href="#support-faqs">
              Browse common questions <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="company-content public-container" id="support-faqs">
          <div className="company-support-heading">
            <div>
              <p className="legal-eyebrow">Frequently asked questions</p>
              <h2>Let’s find your answer.</h2>
            </div>
            <label className="company-faq-search">
              <Search size={17} aria-hidden="true" />
              <span className="visually-hidden">Search help articles</span>
              <input
                type="search"
                placeholder="Search common questions"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          {filteredGroups.length > 0 ? (
            <div className="company-faq-groups">
              {filteredGroups.map(({ title, icon: Icon, questions }) => (
                <section className="company-faq-group" key={title}>
                  <div className="company-faq-group__heading">
                    <span><Icon size={18} aria-hidden="true" /></span>
                    <h3>{title}</h3>
                  </div>
                  <div className="company-faq-list">
                    {questions.map(({ question, answer }) => (
                      <details className="company-faq" key={question}>
                        <summary>{question}<span aria-hidden="true" /></summary>
                        <p>{answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="company-faq-empty" role="status">
              <p>No answers matched “{query}”. Try a different search or ask us directly.</p>
              <Link to="/contact">Contact support <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          )}

          <div className="company-support-callout">
            <div className="company-support-callout__icon"><LifeBuoy size={21} aria-hidden="true" /></div>
            <div>
              <p className="legal-eyebrow">A person can help</p>
              <h2>Didn’t find what you need?</h2>
              <p>
                Tell us what you’re trying to do and what happened. Please leave
                passwords and secret values out of your message.
              </p>
            </div>
            <Link className="public-button" to="/contact">
              Contact support <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className="company-support-email">Or email us directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>
      </div>
    </PublicSiteLayout>
  )
}
