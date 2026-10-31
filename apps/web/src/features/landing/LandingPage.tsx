import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Shield, Users, Eye, Share2, KeyRound, ArrowRight } from 'lucide-react'
import './landing.css'

export default function LandingPage() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target) }
        })
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="lp">
      <LPNav />
      <LPHero />
      <LPLogos />
      <LPFeatures />
      <LPSteps />
      <LPQuote />
      <LPCta />
      <LPFooter />
    </div>
  )
}

function LPNav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 32)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header className={`lp-nav ${solid ? 'lp-nav--solid' : ''}`}>
      <div className="lp-wrap lp-nav__row">
        <Link to="/" className="lp-nav__brand">
          <Lock size={18} strokeWidth={2} aria-hidden="true" />
          Vaultnary
        </Link>
        <nav aria-label="Site navigation" className="lp-nav__links">
          <a href="#features" className="lp-nav__link">Features</a>
          <a href="#steps" className="lp-nav__link">How it works</a>
          <Link to="/login" className="lp-nav__link">Sign in</Link>
          <Link to="/register" className="lp-btn-outline">Get started</Link>
        </nav>
      </div>
    </header>
  )
}

function LPHero() {
  const bgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = () => {
      if (bgRef.current) bgRef.current.style.transform = `translateY(${window.scrollY * 0.28}px)`
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <section className="lp-hero" aria-label="Introduction">
      <div className="lp-hero__bg" ref={bgRef} />
      <div className="lp-hero__scrim" aria-hidden="true" />
      <div className="lp-wrap lp-hero__body">
        <p className="lp-hero__eyebrow reveal">Credential management, done right</p>
        <h1 className="lp-hero__h1 reveal">
          Every password.<br />Every key.<br />Always secure.
        </h1>
        <p className="lp-hero__sub reveal">
          The one place your team stores, organises, and safely shares credentials -without ever putting anyone at risk.
        </p>
        <div className="lp-hero__actions reveal">
          <Link to="/register" className="lp-btn-primary">
            Start for free <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
          </Link>
          <Link to="/login" className="lp-btn-ghost">Sign in to vault</Link>
        </div>
      </div>
    </section>
  )
}

const logoNames = ['Acme Corp', 'Horizon Labs', 'Stackflow', 'Relay Inc', 'Northgate']

function LPLogos() {
  return (
    <div className="lp-logos" aria-label="Trusted by teams like">
      <div className="lp-wrap lp-logos__row">
        <span className="lp-logos__label">Trusted by engineering teams at</span>
        {logoNames.map((n) => (
          <span key={n} className="lp-logos__name">{n}</span>
        ))}
      </div>
    </div>
  )
}

const features = [
  {
    icon: Lock,
    title: 'Yours and only yours',
    body: 'Everything you save is locked before it leaves your device. Nobody else -including us -can read your secrets.',
    img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=720&q=80&auto=format&fit=crop',
    alt: 'A single key on a clean surface',
  },
  {
    icon: Users,
    title: 'Share access, not passwords',
    body: 'Give a teammate access to exactly one credential. Control who sees what, and take it back in a single click.',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=720&q=80&auto=format&fit=crop',
    alt: 'Two colleagues reviewing work together',
  },
  {
    icon: KeyRound,
    title: 'Every type of credential',
    body: 'Passwords, API tokens, SSH keys, two-factor codes, database logins -all in one organised, searchable vault.',
    img: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=720&q=80&auto=format&fit=crop',
    alt: 'Organised key rack',
  },
  {
    icon: Eye,
    title: 'A record of everything',
    body: 'See exactly who accessed what and when. A permanent log your team can rely on for accountability and audit.',
    img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=720&q=80&auto=format&fit=crop',
    alt: 'Clean data dashboard',
  },
  {
    icon: Share2,
    title: 'Organised around your projects',
    body: 'Tag credentials to the projects and environments they belong to. Find the right key the moment you need it.',
    img: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=720&q=80&auto=format&fit=crop',
    alt: 'Neatly organised folders on a desk',
  },
  {
    icon: Shield,
    title: 'Never locked out again',
    body: 'Set a recovery phrase once. If you ever lose access, your vault is still yours to get back -no support ticket needed.',
    img: 'https://images.unsplash.com/photo-1433888104895-5b54e9988929?w=720&q=80&auto=format&fit=crop',
    alt: 'Spare key on a hook',
  },
]

function LPFeatures() {
  return (
    <section id="features" className="lp-features" aria-label="Features">
      <div className="lp-wrap">
        <div className="lp-section-hd reveal">
          <p className="lp-eyebrow">What you get</p>
          <h2 className="lp-h2">Built for teams who can't afford a breach</h2>
          <p className="lp-lead">Stop emailing passwords. Stop using shared accounts. Start doing it properly.</p>
        </div>
        <div className="lp-features__list">
          {features.map((f, i) => <FeatureRow key={f.title} f={f} flip={i % 2 !== 0} />)}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({ f, flip }: { f: typeof features[0]; flip: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.15 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={`lp-frow ${flip ? 'lp-frow--flip' : ''} ${vis ? 'lp-frow--vis' : ''}`}>
      <div className="lp-frow__img-wrap">
        <img src={f.img} alt={f.alt} className="lp-frow__img" loading="lazy" />
      </div>
      <div className="lp-frow__copy">
        <f.icon size={28} strokeWidth={1.5} className="lp-frow__icon" aria-hidden="true" />
        <h3 className="lp-frow__title">{f.title}</h3>
        <p className="lp-frow__body">{f.body}</p>
      </div>
    </div>
  )
}

const steps = [
  { n: '01', title: 'Create your vault', body: 'Sign up with your email address. Your private vault is ready in under a minute.' },
  { n: '02', title: 'Add your credentials', body: 'Type in a password, paste an API key, or store an SSH key -any kind of secret.' },
  { n: '03', title: 'Unlock only when you need to', body: 'Your vault stays closed until you open it. Like a physical safe, but in your browser.' },
  { n: '04', title: 'Share just what you choose', body: 'Give one teammate access to one secret. Take it back any time. Nothing more leaks.' },
]

function LPSteps() {
  return (
    <section id="steps" className="lp-steps" aria-label="How it works">
      <div className="lp-steps__bg" aria-hidden="true" />
      <div className="lp-wrap lp-steps__inner">
        <div className="lp-section-hd reveal">
          <p className="lp-eyebrow">Simple by design</p>
          <h2 className="lp-h2">Ready in four steps</h2>
        </div>
        <ol className="lp-steps__list" aria-label="Steps to get started">
          {steps.map((s, i) => <StepCard key={s.n} s={s} delay={i * 100} />)}
        </ol>
      </div>
    </section>
  )
}

function StepCard({ s, delay }: { s: typeof steps[0]; delay: number }) {
  const ref = useRef<HTMLLIElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <li ref={ref} className={`lp-step ${vis ? 'lp-step--vis' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <span className="lp-step__n" aria-hidden="true">{s.n}</span>
      <strong className="lp-step__title">{s.title}</strong>
      <p className="lp-step__body">{s.body}</p>
    </li>
  )
}

function LPQuote() {
  return (
    <section className="lp-quote" aria-label="Customer quote">
      <div className="lp-wrap lp-quote__inner reveal">
        <blockquote className="lp-quote__text">
          "We spent years sharing credentials over Slack and hoping nothing leaked. Vaultnary fixed that in an afternoon."
        </blockquote>
        <cite className="lp-quote__attr">Head of Engineering, a 40-person product team</cite>
      </div>
    </section>
  )
}

function LPCta() {
  return (
    <section className="lp-cta" aria-label="Get started">
      <div className="lp-cta__bg" aria-hidden="true" />
      <div className="lp-cta__scrim" aria-hidden="true" />
      <div className="lp-wrap lp-cta__inner reveal">
        <h2 className="lp-cta__h2">Stop sharing passwords.<br />Start sharing access.</h2>
        <p className="lp-cta__sub">Free to start. No credit card. Works immediately.</p>
        <Link to="/register" className="lp-btn-primary lp-btn-primary--lg">
          Create your free vault <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

function LPFooter() {
  return (
    <footer className="lp-footer" role="contentinfo">
      <div className="lp-wrap lp-footer__row">
        <span className="lp-footer__brand">
          <Lock size={15} strokeWidth={2} aria-hidden="true" /> Vaultnary
        </span>
        <p className="lp-footer__copy">Your credentials, always under your control.</p>
        <nav aria-label="Footer links" className="lp-footer__links">
          <Link to="/register">Get started</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
    </footer>
  )
}
