import { useState } from 'react'
import { useI18n } from '@/context/I18nContext'

type Props = {
  onLogin: (password: string) => boolean
  onClose: () => void
}

export function AccountantLoginModal({ onLogin, onClose }: Props) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (onLogin(password)) {
      onClose()
      return
    }
    setError(t('auth.wrongPassword'))
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-ink">{t('auth.title')}</h3>
        <p className="mt-1 text-sm text-stone-500">{t('auth.subtitle')}</p>
        <label className="mt-4 block text-xs font-medium text-stone-500">
          {t('auth.password')}
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-grid px-3 py-2 text-sm"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-grid px-4 py-2 text-sm"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {t('common.login')}
          </button>
        </div>
      </form>
    </div>
  )
}
