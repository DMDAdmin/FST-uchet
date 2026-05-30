import { useCallback, useState } from 'react'
import {
  DEFAULT_ACCOUNTANT_PASSWORD,
  isAccountantSession,
  loginAccountant,
  logoutAccountant,
} from '@/lib/auth'

export function useAccountant(expectedPassword: string) {
  const [isAccountant, setIsAccountant] = useState(isAccountantSession)

  const login = useCallback(
    (password: string) => {
      const ok = loginAccountant(password, expectedPassword || DEFAULT_ACCOUNTANT_PASSWORD)
      if (ok) setIsAccountant(true)
      return ok
    },
    [expectedPassword],
  )

  const logout = useCallback(() => {
    logoutAccountant()
    setIsAccountant(false)
  }, [])

  return { isAccountant, login, logout }
}
