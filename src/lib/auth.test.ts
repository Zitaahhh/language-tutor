import { describe, expect, it } from 'vitest'
import { AUTH_COPY, isValidPassword } from './auth'

describe('auth helpers', () => {
  it('uses email/password copy instead of Google OAuth copy', () => {
    expect(AUTH_COPY.primaryAction).toBe('Sign in')
    expect(AUTH_COPY.secondaryAction).toBe('Create account')
    expect(AUTH_COPY.providerName.toLowerCase()).not.toContain('google')
  })

  it('requires production-safe passwords of at least 8 characters', () => {
    expect(isValidPassword('short')).toBe(false)
    expect(isValidPassword('long-enough')).toBe(true)
  })
})
