const SESSION_KEY = 'fibercell-accountant-session'

export function isAccountantSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function loginAccountant(password: string, expectedPassword: string): boolean {
  if (!password || password !== expectedPassword) return false
  sessionStorage.setItem(SESSION_KEY, '1')
  return true
}

export function logoutAccountant(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export const DEFAULT_ACCOUNTANT_PASSWORD = 'Lizi2026'
