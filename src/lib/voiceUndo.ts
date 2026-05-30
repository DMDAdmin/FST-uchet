import type { AppStore } from './types'

export type VoiceUndoEntry = {
  label: string
  snapshot: AppStore
  at: string
}

const MAX_UNDO = 5

export function cloneStoreForUndo(store: AppStore): AppStore {
  return structuredClone(store)
}

export function pushVoiceUndo(
  stack: VoiceUndoEntry[],
  store: AppStore,
  label: string,
): VoiceUndoEntry[] {
  const entry: VoiceUndoEntry = {
    label,
    snapshot: cloneStoreForUndo(store),
    at: new Date().toISOString(),
  }
  return [...stack.slice(-(MAX_UNDO - 1)), entry]
}

export function popVoiceUndo(stack: VoiceUndoEntry[]): {
  nextStack: VoiceUndoEntry[]
  entry?: VoiceUndoEntry
} {
  if (!stack.length) return { nextStack: stack }
  const entry = stack[stack.length - 1]
  return { nextStack: stack.slice(0, -1), entry }
}
