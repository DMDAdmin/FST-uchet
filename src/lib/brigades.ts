import type { AppStore } from './types'

export { DEFAULT_BRIGADES, EMPTY_SLOTS_PER_BRIGADE } from './brigades.constants'

export function getBrigades(store: AppStore): string[] {
  return store.brigades.length > 0 ? [...store.brigades] : []
}
