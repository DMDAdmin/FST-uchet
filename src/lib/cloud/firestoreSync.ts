import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createDefaultStore } from '@/lib/storage'
import type { AppStore } from '@/lib/types'
import { getFirestoreDb, isFirebaseConfigured } from './firebase'

const COLLECTION = 'fstStores'

function storeDocPath(uid: string): string {
  return `${COLLECTION}/${uid}`
}

export async function loadCloudStore(uid: string): Promise<AppStore | null> {
  if (!isFirebaseConfigured()) return null
  const ref = doc(getFirestoreDb(), storeDocPath(uid))
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  if (!data?.payload || typeof data.payload !== 'object') return null
  return data.payload as AppStore
}

export async function saveCloudStore(uid: string, store: AppStore): Promise<void> {
  if (!isFirebaseConfigured()) return
  const ref = doc(getFirestoreDb(), storeDocPath(uid))
  await setDoc(
    ref,
    {
      payload: store,
      updatedAt: serverTimestamp(),
      app: 'FST',
      version: store.version,
    },
    { merge: true },
  )
}

export async function ensureCloudStore(uid: string): Promise<AppStore> {
  const existing = await loadCloudStore(uid)
  if (existing) return existing
  const fresh = createDefaultStore()
  await saveCloudStore(uid, fresh)
  return fresh
}
