import {
  ArrowRight,
  FolderKanban,
  KeyRound,
  LockKeyhole,
  Server,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicSiteLayout from '../legal/PublicSiteLayout'
import './manual.css'

const flow = [
  {
    name: 'Workspace',
    example: 'Engineering team',
    description: 'A shared home for your team.',
    icon: Users,
  },
  {
    name: 'Project',
    example: 'Payments',
    description: 'A group of related work.',
    icon: FolderKanban,
  },
  {
    name: 'Service',
    example: 'Redis API',
    description: 'An app or system in a project.',
    icon: Server,
  },
  {
    name: 'Vault',
    example: 'Production',
    description: 'Credentials for a service.',
    icon: LockKeyhole,
  },
  {
    name: 'Credential',
    example: 'REDIS_URL',
    description: 'One account or secret.',
    icon: KeyRound,
  },
]

const setupSteps = [
  {
    number: '01',
    title: 'Start with a workspace',
    body: 'After signing in, open Workspaces and create one for the team or work you want to organize.',
    icon: Users,
  },
  {
    number: '02',
    title: 'Create a project',
    body: 'Open your workspace and add a project for a product, client, or initiative.',
    icon: FolderKanban,
  },
  {
    number: '03',
    title: 'Add a service',
    body: 'Inside the project, create a service such as an API, website, or database.',
    icon: Server,
  },
  {
    number: '04',
    title: 'Create a vault',
    body: 'Open the service and create a vault for the credentials it needs. You can use separate vaults for different environments or purposes.',
    icon: LockKeyhole,
  },
  {
    number: '05',
    title: 'Add credentials',
    body: 'Open the vault, choose New credential, and enter a clear name and type. Add an account / usage note so teammates know what the credential is for.',
    icon: KeyRound,
  },
]

export default function ManualPage() {
  return (
    <PublicSiteLayout
      title="Vaultnary Manual"
      description="A practical guide to organizing your work in Vaultnary, from workspaces and projects to services, vaults, and credentials."
    >
      <div className="manual-page">
        <section className="manual-hero">
          <div className="public-container manual-hero__inner">
            <div className="manual-hero__copy">
              <p className="legal-eyebrow">Vaultnary manual</p>
              <h1>A clear path from your team to each credential.</h1>
              <p>
                Follow this guide to set up your workspace, organize your projects,
                and keep each credential with the service that uses it.
              </p>
              <div className="manual-hero__actions">
                <Link to="/register" className="public-button">
                  Create your account <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a href="#setup" className="manual-text-link">See the steps</a>
              </div>
            </div>

            <figure className="manual-flow" aria-labelledby="manual-flow-title">
              <figcaption id="manual-flow-title">
                <span>How Vaultnary is organized</span>
                <p>Each level lives inside the one before it.</p>
              </figcaption>
              <ol className="manual-flow__steps">
                {flow.map(({ name, example, description, icon: Icon }, index) => (
                  <li className="manual-flow__item" key={name}>
                    <div className="manual-flow__card">
                      <span className="manual-flow__icon" aria-hidden="true">
                        <Icon size={19} />
                      </span>
                      <span className="manual-flow__level">0{index + 1} · {name}</span>
                      <strong>{example}</strong>
                      <span className="manual-flow__description">{description}</span>
                    </div>
                    {index < flow.length - 1 && (
                      <span className="manual-flow__connector" aria-hidden="true">
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </figure>
          </div>
        </section>

        <div className="public-container manual-content">
          <section className="manual-steps" id="setup" aria-labelledby="manual-steps-title">
            <div className="manual-section-heading">
              <p className="legal-eyebrow">Getting started</p>
              <h2 id="manual-steps-title">Set up your space in five steps.</h2>
              <p>Follow the levels in order so everything has a clear place.</p>
            </div>
            <ol className="manual-step-list">
              {setupSteps.map(({ number, title, body, icon: Icon }) => (
                <li className="manual-step" key={number}>
                  <span className="manual-step__number">{number}</span>
                  <span className="manual-step__icon" aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <div className="manual-step__copy">
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="manual-note-section" aria-labelledby="manual-note-title">
            <div className="manual-note-section__visual" aria-hidden="true">
              <span className="manual-note-section__credential">
                <KeyRound size={17} />
                Redis API key
              </span>
              <span className="manual-note-section__note">
                Account / usage note
                <strong>Created using eg1@gmail.com</strong>
              </span>
            </div>
            <div>
              <p className="legal-eyebrow">Make it easy to recognize</p>
              <h2 id="manual-note-title">Leave a note for the next person.</h2>
              <p>
                When you add a credential, use the account / usage note to say which
                account it belongs to or what it is used for. For example:
                “Created using eg1@gmail.com for the production Redis instance.”
              </p>
            </div>
          </section>

          <section className="manual-hierarchy" aria-labelledby="manual-hierarchy-title">
            <div className="manual-section-heading">
              <p className="legal-eyebrow">Optional organization</p>
              <h2 id="manual-hierarchy-title">Related credentials can be viewed together.</h2>
              <p>
                Credential hierarchy is an optional way to show parent and child
                relationships inside a vault. It does not change the main workspace flow.
              </p>
            </div>
            <div className="manual-hierarchy__diagram" role="img" aria-label="A Production database credential with Read-only account and Migration account beneath it">
              <div className="manual-hierarchy__parent">
                <KeyRound size={18} aria-hidden="true" />
                <span><small>Parent credential</small><strong>Production database</strong></span>
              </div>
              <div className="manual-hierarchy__children">
                <div><KeyRound size={16} aria-hidden="true" /><span>Read-only account</span></div>
                <div><KeyRound size={16} aria-hidden="true" /><span>Migration account</span></div>
              </div>
            </div>
          </section>

          <section className="manual-next-step">
            <div>
              <p className="legal-eyebrow">Ready to begin?</p>
              <h2>Start with your workspace.</h2>
              <p>You can add projects, services, and vaults as your work grows.</p>
            </div>
            <Link to="/register" className="public-button">
              Create an account <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </PublicSiteLayout>
  )
}
