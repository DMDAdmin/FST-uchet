/** Firestore rejects `undefined` anywhere in the document tree. */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T
  }
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (child !== undefined) {
      out[key] = stripUndefinedDeep(child)
    }
  }
  return out as T
}
