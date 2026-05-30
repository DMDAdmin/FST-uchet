import { useI18n } from '@/context/I18nContext'

type Props = { onClose: () => void }

const KEYS = [
  'hotkeys.click',
  'hotkeys.enter',
  'hotkeys.arrows',
  'hotkeys.comment',
  'hotkeys.esc',
  'hotkeys.help',
] as const

export function HotkeysHelp({ onClose }: Props) {
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold">{t('hotkeys.title')}</h3>
        <ul className="mt-4 space-y-2 text-sm text-stone-700">
          {KEYS.map((k) => (
            <li key={k} className="border-b border-grid pb-2">
              {t(k)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          onClick={onClose}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
