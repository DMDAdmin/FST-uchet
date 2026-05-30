import { useVoiceHandlers } from '@/context/VoiceControlContext'
import { exportToJson } from '@/lib/storage'
import { currentMonthKey } from '@/lib/voiceMonth'
import type { AppStore } from '@/lib/types'

type Props = {
  store: AppStore
  onLocale: (locale: AppStore['settings']['locale']) => void
  onCurrentMonth: (month: string) => void
  onGoMonth: (month: string) => void
}

export function AppVoiceBridge({ store, onLocale, onCurrentMonth, onGoMonth }: Props) {
  useVoiceHandlers({
    onLocale: (locale) => onLocale(locale),
    onExport: () => exportToJson(store),
    onCurrentMonth: () => onCurrentMonth(currentMonthKey()),
    onGoMonth: (month) => onGoMonth(month),
  })
  return null
}
