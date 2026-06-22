export const AUTH_COPY = {
  providerName: 'email and password',
  primaryAction: 'Sign in',
  secondaryAction: 'Create account',
}

export function isValidPassword(password: string) {
  return password.length >= 8
}
