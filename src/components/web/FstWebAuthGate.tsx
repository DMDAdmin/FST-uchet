import { useEffect } from 'react'
import { useFstAuth } from '@/context/FstAuthContext'
import { FstLoginScreen } from '@/components/web/FstLoginScreen'
import type { ReactNode } from 'react'

export function FstWebAuthGate({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, logout } = useFstAuth()

  useEffect(() => {
    if (user && !isAdmin) {
      void logout()
    }
  }, [user, isAdmin, logout])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <p className="text-sm text-stone-500">FST…</p>
      </div>
    )
  }

  if (!user || !isAdmin) return <FstLoginScreen />

  return children
}
