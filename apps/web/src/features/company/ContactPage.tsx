import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Mail, MessageSquareText, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiPost } from '../../services/http-client'
import PublicSiteLayout from '../legal/PublicSiteLayout'
import { CONTACT_EMAIL } from './constants'
import './company.css'

interface ContactForm {
  name: string
  email: string
  topic: string
  message: string
}

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setIsSubmitting(true)
    setSubmitted(false)
    setError('')

    const formData = new FormData(event.currentTarget)
    const contactForm: ContactForm = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      topic: String(formData.get('topic') ?? ''),
      message: String(formData.get('message') ?? ''),
    }

    try {
      await apiPost<{ message: string }>('/api/v1/contact', contactForm)
      setSubmitted(true)
      form.reset()
    } catch {
      setError('We couldn’t send your message. Please try again or email us directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicSiteLayout>
      <div className="company-page">
        <section className="company-hero">
          <div className="public-container company-contact-hero">
            <div>
              <p className="legal-eyebrow">Talk to a real person</p>
              <h1>Tell us what’s on your mind.</h1>
              <p>
                Questions, feedback, or a hand getting started—we’d love to hear
                from you. Send a note and we’ll point you in the right direction.
              </p>
              <div className="company-contact-promise">
                <span><Clock3 size={16} aria-hidden="true" /> We aim to reply within two business days.</span>
                <span><ShieldAlert size={16} aria-hidden="true" /> Never include passwords or secret values.</span>
              </div>
            </div>

            <div className="company-contact-card">
              <div className="company-contact-card__heading">
                <span className="company-card__icon"><MessageSquareText size={20} aria-hidden="true" /></span>
                <div>
                  <p className="legal-eyebrow">Send an enquiry</p>
                  <h2>How can we help?</h2>
                </div>
              </div>

              {submitted ? (
                <div className="company-form-success" role="status">
                  <CheckCircle2 size={26} aria-hidden="true" />
                  <div>
                    <h3>Your message is on its way.</h3>
                    <p>Thanks for reaching out. We’ll get back to you as soon as we can.</p>
                  </div>
                </div>
              ) : (
                <form className="company-contact-form" onSubmit={handleSubmit}>
                  <div className="company-form-row">
                    <label>
                      Your name
                      <input name="name" type="text" autoComplete="name" minLength={1} maxLength={100} required />
                    </label>
                    <label>
                      Email address
                      <input name="email" type="email" autoComplete="email" maxLength={254} required />
                    </label>
                  </div>
                  <label>
                    What can we help with?
                    <select name="topic" defaultValue="" required>
                      <option value="" disabled>Select a topic</option>
                      <option>General question</option>
                      <option>Account help</option>
                      <option>Product feedback</option>
                      <option>Partnership</option>
                    </select>
                  </label>
                  <label>
                    Your message
                    <textarea
                      name="message"
                      rows={5}
                      minLength={10}
                      maxLength={5000}
                      aria-describedby="contact-message-hint"
                      placeholder="Share a little context so we can help."
                      required
                    />
                    <span className="company-field-hint" id="contact-message-hint">
                      Please don’t include passwords, recovery phrases, or credential values.
                    </span>
                  </label>
                  {error && <p className="company-form-error" role="alert">{error}</p>}
                  <button className="public-button company-form-submit" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending…' : 'Send message'}
                    {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="company-contact-alternatives public-container">
          <div>
            <span className="company-contact-alternatives__icon"><Mail size={18} aria-hidden="true" /></span>
            <div>
              <h2>Prefer email?</h2>
              <p>Reach us directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            </div>
          </div>
          <p>Need an answer to a common question? Browse <Link to="/support">Support and FAQs <ArrowRight size={14} aria-hidden="true" /></Link>.</p>
        </section>
      </div>
    </PublicSiteLayout>
  )
}
