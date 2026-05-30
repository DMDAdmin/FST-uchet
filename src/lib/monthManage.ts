import { ensureMonth, defaultMonths } from './monthSheet'
import type { AppStore } from './types'

export function isMonthArchived(store: AppStore, month: string): boolean {
  return store.archivedMonths.includes(month)
}

export function listMonthKeys(store: AppStore): string[] {
  return Object.keys(store.months).sort()
}

export function addMonthToStore(store: AppStore, month: string): AppStore {
  if (store.months[month]) throw new Error('exists')
  return ensureMonth(store, month)
}

export function removeMonthFromStore(store: AppStore, month: string): AppStore {
  if (isMonthArchived(store, month)) throw new Error('archived')
  if (!store.months[month]) throw new Error('missing')
  const { [month]: _, ...months } = store.months
  return { ...store, months }
}

export function setMonthArchived(
  store: AppStore,
  month: string,
  archived: boolean,
): AppStore {
  if (!store.months[month]) throw new Error('missing')
  const has = store.archivedMonths.includes(month)
  if (archived && !has) {
    return { ...store, archivedMonths: [...store.archivedMonths, month].sort() }
  }
  if (!archived && has) {
    return {
      ...store,
      archivedMonths: store.archivedMonths.filter((m) => m !== month),
    }
  }
  return store
}

export function defaultArchivedMonths(): string[] {
  return defaultMonths()
}
