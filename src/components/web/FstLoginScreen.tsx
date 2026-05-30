import { useState } from 'react'
import { useFstAuth } from '@/context/FstAuthContext'

export function FstLoginScreen() {
  const { login, register, configured } = useFstAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-lg">
          <h1 className="text-xl font-bold text-ink">FST — настройка Firebase</h1>
          <p className="mt-3 text-sm text-stone-600">
            Добавьте переменные <code className="text-xs">VITE_FIREBASE_*</code> в Vercel /{' '}
            <code className="text-xs">fst-web/.env</code>. См.{' '}
            <code className="text-xs">fst-web/.env.example</code>.
          </p>
        </div>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
      if (code.includes('invalid-credential') || code.includes('wrong-password')) {
        setError('Неверный email или пароль.')
      } else if (code.includes('email-already-in-use')) {
        setError('Этот email уже зарегистрирован.')
      } else if (code.includes('weak-password')) {
        setError('Пароль должен быть не короче 6 символов.')
      } else {
        setError('Не удалось войти. Проверьте email и пароль.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-stone-900 to-stone-950 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-teal-700">FST</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">Табель и склад</h1>
        <p className="mt-1 text-sm text-stone-500">Облачная версия · данные в Firebase</p>

        <label className="mt-6 block text-xs font-semibold text-stone-500">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2.5 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nikegeorgian@gmail.com"
          />
        </label>
        <label className="mt-3 block text-xs font-semibold text-stone-500">
          Пароль
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2.5 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>

        <button
          type="button"
          className="mt-3 w-full text-sm text-teal-700 hover:underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Нет аккаунта — зарегистрироваться' : 'Уже есть аккаунт — войти'}
        </button>
      </form>
    </div>
  )
}
