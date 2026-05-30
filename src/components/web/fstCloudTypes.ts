import type { AppStore } from '@/lib/types'

export type FstCloudSyncProps = {
  store: AppStore
  replaceStore: (next: AppStore) => void
}
