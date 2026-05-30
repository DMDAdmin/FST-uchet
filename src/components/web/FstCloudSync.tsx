import { useEffect, useRef, useState } from 'react'
import { useFstAuth } from '@/context/FstAuthContext'
import { ensureCloudStore, saveCloudStore } from '@/lib/cloud/firestoreSync'
import type { FstCloudSyncProps } from './fstCloudTypes'

const SAVE_DEBOUNCE_MS = 1200

export function FstCloudSync({ store, replaceStore }: FstCloudSyncProps) {
  const { user, configured } = useFstAuth()
  const [cloudReady, setCloudReady] = useState(!configured)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    if (!configured || !user) {
      setCloudReady(!configured)
      return
    }

    let cancelled = false
    setCloudReady(false)
    setCloudError(null)

    void (async () => {
      try {
        const data = await ensureCloudStore(user.uid)
        if (cancelled) return
        replaceStore(data)
        skipSave.current = false
        setCloudReady(true)
      } catch {
        if (!cancelled) {
          setCloudError('Не удалось загрузить данные из облака.')
          setCloudReady(true)
          skipSave.current = false
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [configured, user, replaceStore])

  useEffect(() => {
    if (!configured || !user || !cloudReady || skipSave.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveCloudStore(user.uid, store).catch((err) => {
        console.error('FST cloud save failed', err)
        const code =
          err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : ''
        if (code.includes('permission-denied')) {
          setCloudError('Нет доступа к облаку. Выйдите и войдите снова.')
        } else if (code.includes('resource-exhausted') || code.includes('invalid-argument')) {
          setCloudError('Данные слишком большие для облака (лимит Firestore 1 MB).')
        } else {
          setCloudError('Ошибка сохранения в облако.')
        }
      })
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [store, configured, user, cloudReady])

  if (!configured) return null
  if (!cloudReady) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-100">
        <p className="text-sm text-stone-600">FST — загрузка данных…</p>
      </div>
    )
  }
  if (cloudError) {
    return (
      <div className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
        {cloudError}
      </div>
    )
  }
  return null
}
