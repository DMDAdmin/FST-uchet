import { useState } from 'react'
import { useI18n } from '@/context/I18nContext'

type Props = {
  dateKey: string
  initial: string
  onSave: (text: string) => void
  onClose: () => void
}

export function CellCommentModal({ dateKey, initial, onSave, onClose }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState(initial)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-sm font-bold">{t('comment.title')}</h3>
        <p className="mt-1 text-xs text-stone-500">{dateKey}</p>
        <textarea
          className="mt-3 w-full rounded-md border border-grid p-2 text-sm"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('comment.placeholder')}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-grid px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
            onClick={() => {
              onSave(text)
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
