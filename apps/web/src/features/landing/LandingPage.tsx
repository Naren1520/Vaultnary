import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  Fingerprint,
  FolderKanban,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import logoUrl from '../../assets/logo.png'
import './landing.css'

const features = [
  {
    icon: LockKeyhole,
    title: 'Private by design',
    body: 'Keep sensitive values encrypted in your vault, with control over when they are unlocked.',
    detail: 'A calmer place for sensitive work',
  },
  {
    icon: Users,
    title: 'Share with intention',
    body: 'Invite teammates to the workspace and manage who can access shared credentials.',
    detail: 'Access that follows your team',
  },
  {
    icon: FolderKanban,
    title: 'Everything in context',
    body: 'Organize credentials around workspaces, projects, and the services they support.',
    detail: 'Less hunting, more doing',
  },
  {
    icon: Eye,
    title: 'Know what happened',
    body: 'Review security activity and audit events when your team needs a clear history.',
    detail: 'Visibility when it matters',
  },
]

const steps = [
  {
    number: '01',
    title: 'Create a workspace',
    body: 'Bring the right people and projects together in one shared space.',
  },
  {
    number: '02',
    title: 'Add your credentials',
    body: 'Keep the keys and account details your team relies on organized.',
  },
  {
    number: '03',
    title: 'Share only what is needed',
    body: 'Manage membership and credential access as your team changes.',
  },
]

const workspaceLevels = [
  {
    icon: Users,
    number: '01',
    title: 'Workspace',
    body: 'Bring the people and shared information for a team into one clear home.',
  },
  {
    icon: FolderKanban,
    number: '02',
    title: 'Project',
    body: 'Group related work together so credentials stay connected to their purpose.',
  },
  {
    icon: KeyRound,
    number: '03',
    title: 'Credential',
    body: 'Keep the account details your team uses organized and easier to find.',
  },
]

export default function LandingPage() {
  const [navSolid, setNavSolid] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('lp-hide-scrollbar')
    document.body.classList.add('lp-hide-scrollbar')

    const revealElements = document.querySelectorAll<HTMLElement>('.lp-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-reveal--visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    revealElements.forEach((element) => observer.observe(element))

    const updateNavigation = () => setNavSolid(window.scrollY > 16)
    updateNavigation()
    window.addEventListener('scroll', updateNavigation, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateNavigation)
      document.documentElement.classList.remove('lp-hide-scrollbar')
      document.body.classList.remove('lp-hide-scrollbar')
    }
  }, [])

  return (
    <div className="lp">
      <header className={`lp-nav ${navSolid ? 'lp-nav--solid' : ''}`}>
        <div className="lp-container lp-nav__inner">
          <Link to="/" className="lp-brand" aria-label="Vaultnary home">
            <img src={logoUrl} alt="Vaultnary" />
          </Link>
          <nav className="lp-nav__links" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#workspaces">Workspaces</a>
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
          </nav>
          <div className="lp-nav__actions">
            <Link to="/login" className="lp-nav__login">Log in</Link>
            <Link to="/register" className="lp-button lp-button--small">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-container lp-hero__inner">
            <div className="lp-hero__copy">
              <p className="lp-kicker"><span /> A better home for team credentials</p>
              <h1>Keep your team’s keys <span>in good hands.</span></h1>
              <p className="lp-hero__description">
                Vaultnary brings credentials, people, and projects together—so your team
                can share access with clarity and confidence.
              </p>
              <div className="lp-hero__actions">
                <Link to="/register" className="lp-button">
                  Create your workspace <ArrowRight size={17} />
                </Link>
                <a href="#product" className="lp-text-link">
                  Explore the product <ChevronRight size={16} />
                </a>
              </div>
              <div className="lp-hero__note">
                <ShieldCheck size={17} />
                <span>Organized access. Clear ownership. One secure workspace.</span>
              </div>
            </div>

            <ProductPreview />
          </div>
          <a className="lp-scroll-cue" href="#product">
            <ArrowDown size={14} /> Scroll to explore
          </a>
        </section>

        <section className="lp-principles" aria-label="Product principles">
          <div className="lp-container lp-principles__inner">
            <span>Built around the way teams work</span>
            <div><LockKeyhole size={16} /> Private vault</div>
            <div><Users size={16} /> Team workspaces</div>
            <div><Clock3 size={16} /> Activity history</div>
          </div>
        </section>

        <section id="product" className="lp-section lp-product">
          <div className="lp-container">
            <div className="lp-section-heading lp-reveal">
              <p className="lp-eyebrow">One connected workspace</p>
              <h2>Less scattered access.<br /><span>More intentional teamwork.</span></h2>
              <p>
                Give every credential a place, every teammate a role, and every project
                the context it needs.
              </p>
            </div>

            <div className="lp-feature-grid">
              {features.map(({ icon: Icon, title, body, detail }, index) => (
                <article className="lp-feature-card lp-reveal" key={title}>
                  <span className="lp-feature-card__icon"><Icon size={20} strokeWidth={1.8} /></span>
                  <span className="lp-feature-card__number">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="lp-feature-card__detail"><Check size={14} /> {detail}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workspaces" className="lp-section lp-structure">
          <div className="lp-container">
            <div className="lp-section-heading lp-structure__heading lp-reveal">
              <p className="lp-eyebrow">A place for every part of the work</p>
              <h2>Everything has a home.<br /><span>Nothing feels out of context.</span></h2>
              <p>
                Move from the bigger picture to the details your team needs, with a
                simple structure that keeps related work together.
              </p>
            </div>

            <div className="lp-structure__grid">
              {workspaceLevels.map(({ icon: Icon, number, title, body }) => (
                <article className="lp-structure-card lp-reveal" key={title}>
                  <div className="lp-structure-card__top">
                    <span className="lp-structure-card__icon"><Icon size={20} strokeWidth={1.8} /></span>
                    <span>{number}</span>
                  </div>
                  <p className="lp-structure-card__label">YOUR VAULTNARY STRUCTURE</p>
                  <h3>{title}</h3>
                  <p className="lp-structure-card__body">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="lp-section lp-workflow">
          <div className="lp-container lp-workflow__layout">
            <div className="lp-workflow__intro lp-reveal">
              <p className="lp-eyebrow">A clear path from day one</p>
              <h2>Good security should fit into the work you already do.</h2>
              <p>
                Start with a workspace, build a useful structure, and invite the people
                who need access. No shared spreadsheets or mystery accounts.
              </p>
              <Link to="/register" className="lp-text-link">
                Set up your workspace <ArrowRight size={16} />
              </Link>
            </div>

            <ol className="lp-steps">
              {steps.map((step) => (
                <li className="lp-step lp-reveal" key={step.number}>
                  <span className="lp-step__number">{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <ChevronRight size={18} className="lp-step__arrow" />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="security" className="lp-security">
          <div className="lp-container lp-security__inner">
            <div className="lp-security__visual lp-reveal" aria-hidden="true">
              <div className="lp-security__halo"><Fingerprint size={54} strokeWidth={1.2} /></div>
              <span className="lp-security__orbit lp-security__orbit--one" />
              <span className="lp-security__orbit lp-security__orbit--two" />
              <span className="lp-security__badge"><ShieldCheck size={17} /> Control stays with you</span>
            </div>
            <div className="lp-security__copy lp-reveal">
              <p className="lp-eyebrow">Security with clarity</p>
              <h2>Your credentials are important. Their access should be deliberate.</h2>
              <p>
                Keep your team’s sensitive information organized, share it with the
                right people, and review activity from one place.
              </p>
              <ul>
                <li><Check size={16} /> Workspace roles and member management</li>
                <li><Check size={16} /> Credential sharing with access controls</li>
                <li><Check size={16} /> Audit and security activity views</li>
              </ul>
              <Link to="/register" className="lp-text-link">
                Take a closer look <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-final-cta">
          <div className="lp-container lp-final-cta__inner lp-reveal">
            <div>
              <p className="lp-eyebrow">Make access easier to manage</p>
              <h2>Give your team a better way to work with secrets.</h2>
              <p>Start organizing credentials and team access in Vaultnary.</p>
            </div>
            <Link to="/register" className="lp-button lp-button--light">
              Get started <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__top">
            <div className="lp-footer__brand-block">
              <Link to="/" className="lp-brand" aria-label="Vaultnary home">
                <img src={logoUrl} alt="Vaultnary" />
              </Link>
              <p>
                A thoughtful home for the credentials, projects, and people your team
                relies on.
              </p>
            </div>
            <nav className="lp-footer__column" aria-label="Explore Vaultnary">
              <h2>Explore</h2>
              <a href="#product">Product</a>
              <a href="#workspaces">Workspaces</a>
              <a href="#how-it-works">How it works</a>
              <a href="#security">Security</a>
            </nav>
            <nav className="lp-footer__column" aria-label="Your account">
              <h2>Account</h2>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create an account</Link>
            </nav>
          </div>
          <div className="lp-footer__bottom">
            <span>© {new Date().getFullYear()} Vaultnary</span>
            <span>Keep team access clear and in context.</span>
            <Link to="/register">Create your workspace <ArrowRight size={14} /></Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ProductPreview() {
  return (
    <div className="lp-preview-wrap lp-reveal" aria-label="Preview of the Vaultnary workspace">
      <div className="lp-preview__backplate" />
      <div className="lp-preview">
        <div className="lp-preview__topbar">
          <div className="lp-preview__dots"><i /><i /><i /></div>
          <span>Vaultnary <span>/</span> Workspace</span>
          <span className="lp-preview__avatar">N</span>
        </div>
        <div className="lp-preview__body">
          <aside className="lp-preview__sidebar">
            <div className="lp-preview__workspace-mark"><LockKeyhole size={14} /></div>
            <span className="lp-preview__workspace-name">Acme Studio <ChevronRight size={12} /></span>
            <span className="lp-preview__nav-label">WORKSPACE</span>
            <span className="lp-preview__nav-item lp-preview__nav-item--active"><KeyRound size={14} /> Vault</span>
            <span className="lp-preview__nav-item"><FolderKanban size={14} /> Projects</span>
            <span className="lp-preview__nav-item"><Users size={14} /> Members</span>
            <div className="lp-preview__sidebar-bottom"><ShieldCheck size={14} /> Security</div>
          </aside>
          <div className="lp-preview__content">
            <div className="lp-preview__heading">
              <div><span className="lp-preview__overline">YOUR WORKSPACE</span><h3>Credential vault</h3></div>
              <span className="lp-preview__add">+ Add credential</span>
            </div>
            <div className="lp-preview__search"><Search size={13} /><span>Search credentials...</span><kbd>⌘ K</kbd></div>
            <div className="lp-preview__summary">
              <div><span>Credentials</span><strong>12</strong></div>
              <div><span>Projects</span><strong>04</strong></div>
              <div><span>Members</span><strong>06</strong></div>
            </div>
            <div className="lp-preview__list-header"><span>NAME</span><span>PROJECT</span><span>UPDATED</span></div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--neutral">S</i><span><b>Production API</b><small>API credential</small></span></span>
              <span className="lp-preview__project">Platform</span><span className="lp-preview__updated">Just now</span>
            </div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--green">D</i><span><b>Database access</b><small>Database credential</small></span></span>
              <span className="lp-preview__project">Platform</span><span className="lp-preview__updated">2 hours ago</span>
            </div>
            <div className="lp-preview__row">
              <span className="lp-preview__credential"><i className="lp-preview__service-icon lp-preview__service-icon--amber">G</i><span><b>Analytics account</b><small>Account credential</small></span></span>
              <span className="lp-preview__project">Growth</span><span className="lp-preview__updated">Yesterday</span>
            </div>
          </div>
        </div>
        <div className="lp-preview__status"><span><i /> Workspace protected</span><span>Changes saved</span></div>
      </div>
      <div className="lp-preview-note"><span className="lp-preview-note__icon"><ShieldCheck size={17} /></span><span><b>One place to stay organized</b><small>People, projects, and credentials</small></span></div>
    </div>
  )
}
