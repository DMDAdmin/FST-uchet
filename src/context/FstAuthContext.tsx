import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/cloud/firebase'

type FstAuthContextValue = {
  user: User | null
  loading: boolean
  configured: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const FstAuthContext = createContext<FstAuthContextValue | null>(null)

export function FstAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isFirebaseConfigured()

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [configured])

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
  }, [])

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth())
  }, [])

  const value = useMemo(
    () => ({ user, loading, configured, login, register, logout }),
    [user, loading, configured, login, register, logout],
  )

  return <FstAuthContext.Provider value={value}>{children}</FstAuthContext.Provider>
}

export function useFstAuth(): FstAuthContextValue {
  const ctx = useContext(FstAuthContext)
  if (!ctx) throw new Error('useFstAuth outside provider')
  return ctx
}
