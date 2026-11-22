import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManualPage from './ManualPage'

describe('ManualPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('explains the user flow with a visual hierarchy and practical steps', () => {
    render(<MemoryRouter><ManualPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: /A clear path from your team to each credential/i }))
      .toBeInTheDocument()
    expect(screen.getByRole('figure', { name: /How Vaultnary is organized/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Set up your space in five steps.' }))
      .toBeInTheDocument()
    expect(screen.getByText('Created using eg1@gmail.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your account' }))
      .toHaveAttribute('href', '/register')
  })
})
