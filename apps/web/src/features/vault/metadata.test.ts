import { describe, expect, it } from 'vitest'
import { formatVaultDate } from './metadata'

describe('formatVaultDate', () => {
  it('formats RFC 3339 timestamps', () => {
    expect(formatVaultDate('2026-11-22T11:09:14.684Z')).toBeTruthy()
  })

  it('accepts legacy timestamps with a space-separated UTC offset', () => {
    expect(formatVaultDate('2026-11-22 11:09:14.684 +00:00:00')).toBeTruthy()
  })

  it('does not expose invalid dates to the UI', () => {
    expect(formatVaultDate('not-a-date')).toBeNull()
  })
})
