import type { ReactNode } from 'react'
import { FiberCellBrand } from '@/components/brand/FiberCellBrand'
import { useI18n } from '@/context/I18nContext'
import type { ViewId } from '@/lib/types'
import { exportToJson } from '@/lib/storage'
import type { AppStore } from '@/lib/types'

const NAV: { id: ViewId; labelKey: string; hintKey: string; accountantOnly?: boolean }[] = [
  { id: 'month', labelKey: 'nav.month', hintKey: 'nav.monthHint' },
  { id: 'employees', labelKey: 'nav.employees', hintKey: 'nav.employeesHint' },
  { id: 'summary', labelKey: 'nav.summary', hintKey: 'nav.summaryHint' },
  { id: 'pay', labelKey: 'nav.pay', hintKey: 'nav.payHint', accountantOnly: true },
  { id: 'codes', labelKey: 'nav.codes', hintKey: 'nav.codesHint' },
  { id: 'warehouse', labelKey: 'nav.warehouse', hintKey: 'nav.warehouseHint' },
  { id: 'settings', labelKey: 'nav.settings', hintKey: 'nav.settingsHint' },
]

type Props = {
  store: AppStore
  view: ViewId
  isAccountant: boolean
  onViewChange: (v: ViewId) => void
  onAccountantLogout: () => void
  onImport: () => void
  onReset: () => void
  children: ReactNode
}

export function AppShell({
  store,
  view,
  isAccountant,
  onViewChange,
  onAccountantLogout,
  onImport,
  onReset,
  children,
}: Props) {
  const { t, locale, setLocale } = useI18n()

  return (
    <div className="flex min-h-screen">
      <aside className="app-sidebar flex w-56 shrink-0 flex-col border-r border-stone-300/80 bg-[#faf8f4] print:hidden">
        <div className="border-b border-stone-300/80 px-4 py-4">
          <FiberCellBrand variant="sidebar" className="mb-3" />
          <h1 className="text-lg font-bold leading-tight text-ink">{t('app.title')}</h1>
          <p className="mt-1 text-xs text-ink-muted">{t('app.subtitle')}</p>
          <div className="mt-3 flex gap-1 rounded-lg border border-grid bg-white p-0.5 text-xs">
            {(['ru', 'ka'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`flex-1 rounded-md px-2 py-1 font-medium ${
                  locale === l ? 'bg-accent text-white' : 'text-stone-600 hover:bg-paper-dark'
                }`}
                onClick={() => setLocale(l)}
              >
                {l === 'ru' ? 'RU' : 'GE'}
              </button>
            ))}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`rounded-lg px-3 py-2.5 text-left transition-colors ${
                view === item.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-ink hover:bg-paper-dark'
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {t(item.labelKey)}
                {item.accountantOnly && !isAccountant && (
                  <span className="text-[10px] opacity-70" title={t('auth.lockHint')}>
                    🔒
                  </span>
                )}
              </div>
              <div
                className={`text-xs ${view === item.id ? 'text-orange-100' : 'text-stone-400'}`}
              >
                {t(item.hintKey)}
              </div>
            </button>
          ))}
        </nav>
        {isAccountant && (
          <div className="border-t border-stone-300/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {t('common.accountant')}
            </p>
            <button
              type="button"
              className="mt-1 text-xs text-stone-500 hover:text-ink"
              onClick={onAccountantLogout}
            >
              {t('common.logout')}
            </button>
          </div>
        )}
        <div className="space-y-2 border-t border-stone-300/80 p-3">
          <button
            type="button"
            className="w-full rounded-lg border border-grid bg-white px-3 py-2 text-xs font-medium hover:bg-paper-dark"
            onClick={() => exportToJson(store)}
          >
            {t('common.export')}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-grid bg-white px-3 py-2 text-xs font-medium hover:bg-paper-dark"
            onClick={onImport}
          >
            {t('common.import')}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
            onClick={() => {
              if (confirm(t('common.resetConfirm'))) onReset()
            }}
          >
            {t('common.reset')}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
