import { ArrowRight, Eye, FolderKanban, KeyRound, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicSiteLayout from '../legal/PublicSiteLayout'
import './company.css'

const principles = [
  {
    icon: LockKeyhole,
    number: '01',
    title: 'Privacy comes first',
    body: 'Sensitive vault fields are encrypted in your browser before they are stored. Your secrets should stay yours—not become readable just because they’re useful.',
  },
  {
    icon: Users,
    number: '02',
    title: 'Sharing should be intentional',
    body: 'Invite people into the right workspace and grant only the access they need. Clear permissions make teamwork easier to understand and manage.',
  },
  {
    icon: FolderKanban,
    number: '03',
    title: 'Context makes work clearer',
    body: 'Connect credentials to workspaces, projects, and services, so important access details are easier to find and maintain.',
  },
  {
    icon: Eye,
    number: '04',
    title: 'Visibility builds confidence',
    body: 'Security sessions and audit activity help teams review access and understand important changes over time.',
  },
]

const steps = [
  { icon: Users, title: 'Bring the team together', body: 'Create a workspace for the people who need to coordinate access.' },
  { icon: KeyRound, title: 'Keep credentials in context', body: 'Organize account details around the projects and services they support.' },
  { icon: ShieldCheck, title: 'Share with care', body: 'Manage membership and permissions as people and projects change.' },
]

export default function AboutPage() {
  return (
    <PublicSiteLayout
      title="About"
      description="Learn how Vaultnary helps teams organize shared credentials, manage access, and protect sensitive vault fields."
    >
      <div className="company-page company-about-page">
        <section className="company-hero company-about-hero">
          <div className="public-container company-about-hero__inner">
            <div>
              <p className="legal-eyebrow">A better home for team access</p>
              <h1>Make the important things easier to find—and safer to share.</h1>
              <p>
                Vaultnary helps teams bring credentials, people, and projects together
                in one considered workspace. Less time searching. More clarity about
                who has access and why.
              </p>
              <div className="company-about-hero__actions">
                <Link className="public-button" to="/register">Create your workspace <ArrowRight size={16} aria-hidden="true" /></Link>
                <Link className="company-text-link" to="/security">Explore our security approach</Link>
              </div>
            </div>
            <div
              className="company-about-visual"
              role="img"
              aria-label="A workspace connecting people, projects, and credentials"
            >
              <div className="company-about-visual__ring company-about-visual__ring--outer" />
              <div className="company-about-visual__ring company-about-visual__ring--inner" />
              <div className="company-about-visual__center"><LockKeyhole size={27} aria-hidden="true" /><span>Vaultnary</span></div>
              <span className="company-about-visual__node company-about-visual__node--people"><Users size={18} aria-hidden="true" /><span>People</span></span>
              <span className="company-about-visual__node company-about-visual__node--projects"><FolderKanban size={18} aria-hidden="true" /><span>Projects</span></span>
              <span className="company-about-visual__node company-about-visual__node--keys"><KeyRound size={18} aria-hidden="true" /><span>Credentials</span></span>
            </div>
          </div>
        </section>

        <section className="company-about-intro public-container">
          <p className="legal-eyebrow">Why Vaultnary</p>
          <div>
            <h2>Access is part of the work. Managing it shouldn’t get in the way.</h2>
            <div>
              <p>
                Teams depend on credentials every day, but access details can end up
                scattered across chats, notes, and personal handoffs. That makes it
                harder to find the right account, onboard a teammate, or know who
                still needs access.
              </p>
              <p>
                Vaultnary gives teams a shared place to organize that work. It brings
                practical structure together with browser-side encryption for sensitive
                fields and clear controls for workspace membership and credential
                sharing.
              </p>
            </div>
          </div>
        </section>

        <section className="company-about-principles">
          <div className="public-container">
            <div className="company-section-heading">
              <p className="legal-eyebrow">What we believe</p>
              <h2>Thoughtful details make a better way to work.</h2>
            </div>
            <div className="company-about-principle-grid">
              {principles.map(({ icon: Icon, number, title, body }) => (
                <article className="company-about-principle" key={number}>
                  <div className="company-about-principle__top">
                    <span className="company-card__icon"><Icon size={20} aria-hidden="true" /></span>
                    <span>{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="company-about-how public-container">
          <div className="company-section-heading">
            <p className="legal-eyebrow">A calmer way to manage access</p>
            <h2>From scattered details to shared understanding.</h2>
          </div>
          <div className="company-about-steps">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <article className="company-about-step" key={title}>
                <span className="company-about-step__number">0{index + 1}</span>
                <span className="company-about-step__icon"><Icon size={20} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="company-about-transparency">
          <div className="public-container company-about-transparency__inner">
            <div>
              <p className="legal-eyebrow">Clear about how it works</p>
              <h2>Security deserves specifics, not slogans.</h2>
            </div>
            <div>
              <p>
                Vaultnary’s security page explains what the current design protects,
                what remains operational metadata, and the practical steps you can
                take to protect your account. We don’t claim independent certification.
              </p>
              <Link to="/security">Read the security overview <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section className="company-about-cta public-container">
          <div>
            <p className="legal-eyebrow">Get to know Vaultnary</p>
            <h2>Good access starts with a little more clarity.</h2>
            <p>Explore the product, get help, or tell us what your team needs.</p>
          </div>
          <div>
            <Link className="public-button" to="/register">Get started <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="company-text-link" to="/contact">Talk to us</Link>
            <Link className="company-text-link" to="/support">Visit support</Link>
          </div>
        </section>
      </div>
    </PublicSiteLayout>
  )
}
