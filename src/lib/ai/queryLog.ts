const AI_QUERY_LOG_KEY = 'fibercell-ai-query-log'
const MAX_ENTRIES = 300

export type AiQueryLogEntry = {
  text: string
  reason: 'unparsed' | 'clarify' | 'partial_batch' | 'error'
  detail?: string
  at: number
}

export function logAiQuery(
  text: string,
  reason: AiQueryLogEntry['reason'],
  detail?: string,
): void {
  try {
    const raw = localStorage.getItem(AI_QUERY_LOG_KEY)
    const list: AiQueryLogEntry[] = raw ? (JSON.parse(raw) as AiQueryLogEntry[]) : []
    list.push({
      text: text.trim().slice(0, 500),
      reason,
      detail: detail?.slice(0, 500),
      at: Date.now(),
    })
    localStorage.setItem(AI_QUERY_LOG_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)))
  } catch {
    /* ignore */
  }
}

export function getAiQueryLog(): AiQueryLogEntry[] {
  try {
    const raw = localStorage.getItem(AI_QUERY_LOG_KEY)
    return raw ? (JSON.parse(raw) as AiQueryLogEntry[]) : []
  } catch {
    return []
  }
}

export function clearAiQueryLog(): void {
  try {
    localStorage.removeItem(AI_QUERY_LOG_KEY)
  } catch {
    /* ignore */
  }
}

export function exportAiQueryLog(): void {
  const blob = new Blob([JSON.stringify(getAiQueryLog(), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fibercell-ai-queries-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
