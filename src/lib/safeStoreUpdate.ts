import type { Dispatch, SetStateAction } from 'react'
import type { AppStore } from '@/lib/types'

/** Применяет изменение store; ошибки из updater пробрасываются наружу (для try/catch в UI). */
export function applyStoreUpdate(
  setStore: Dispatch<SetStateAction<AppStore>>,
  updater: (s: AppStore) => AppStore,
): void {
  let err: Error | null = null
  setStore((s) => {
    try {
      return updater(s)
    } catch (e) {
      err = e instanceof Error ? e : new Error(String(e))
      return s
    }
  })
  if (err) throw err
}
