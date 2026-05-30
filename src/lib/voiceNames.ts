import type { AppStore, Employee } from './types'

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function surnameVariants(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/)
  const surname = parts[0] ?? ''
  if (!surname) return []
  const n = norm(surname)
  const out = new Set([n])
  if (n.length > 3 && /[аяуюиы]$/.test(n)) out.add(n.slice(0, -1))
  if (n.length > 4 && n.endsWith('ова')) out.add(n.slice(0, -1))
  if (n.length > 4 && n.endsWith('ева')) out.add(n.slice(0, -1))
  if (n.length > 4 && n.endsWith('ина')) out.add(n.slice(0, -1))
  return [...out]
}

export function buildVoiceVocabulary(store: AppStore): string[] {
  const words = new Set<string>()
  for (const e of store.employees) {
    if (!e.active) continue
    for (const v of surnameVariants(e.fullName)) words.add(v)
    if (e.nameKa) {
      const ka = e.nameKa.split(/\s+/)[0]
      if (ka) words.add(norm(ka))
    }
    words.add(norm(e.fullName))
  }
  for (const b of store.brigades) {
    words.add(norm(b))
    const short = norm(b)
      .replace(/бригада\s*/g, '')
      .replace(/номер|№/g, '')
      .trim()
    if (short) words.add(short)
  }
  words.add('замени')
  words.add('назначить')
  words.add('график')
  words.add('пропитки')
  words.add('навсегда')
  words.add('ночная')
  words.add('группа')
  words.add('подтверждаю')
  words.add('отмени')
  return [...words].filter((w) => w.length > 1)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cur =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : Math.min(row[j - 1], row[j], prev) + 1
      row[j - 1] = prev
      prev = cur
    }
    row[b.length] = prev
  }
  return row[b.length]
}

export function findEmployeeByVoiceName(
  employees: Employee[],
  query: string,
): Employee | undefined {
  const q = norm(query)
  if (!q) return undefined

  const active = employees.filter((e) => e.active)

  const exact = active.find(
    (e) => norm(e.fullName) === q || norm(e.nameKa ?? '') === q,
  )
  if (exact) return exact

  const qParts = q.split(/\s+/).filter(Boolean)
  const scored = active
    .map((e) => {
      const hay = `${e.fullName} ${e.nameKa ?? ''} ${e.tabNumber}`.toLowerCase()
      const allParts = qParts.every((p) => hay.includes(p))
      if (!allParts) return null
      const score = qParts.reduce((s, p) => s + (hay.indexOf(p) === 0 ? 3 : 1), 0)
      return { e, score }
    })
    .filter(Boolean) as { e: Employee; score: number }[]

  if (scored.length) {
    scored.sort((a, b) => b.score - a.score)
    return scored[0].e
  }

  const qStem = qParts[0] ?? q
  const bySurname = active
    .map((e) => {
      const variants = [
        ...surnameVariants(e.fullName),
        ...(e.nameKa ? surnameVariants(e.nameKa) : []),
      ]
      let best = Infinity
      for (const v of variants) {
        if (qStem.startsWith(v) || v.startsWith(qStem)) best = Math.min(best, 0)
        else best = Math.min(best, levenshtein(qStem, v))
      }
      return { e, dist: best }
    })
    .filter((x) => x.dist <= 2)
    .sort((a, b) => a.dist - b.dist)

  return bySurname[0]?.e
}

export function findEmployeesInText(
  text: string,
  employees: Employee[],
): Employee[] {
  const t = norm(text)
  const active = employees.filter((e) => e.active)
  const hits: { e: Employee; pos: number; len: number }[] = []

  for (const e of active) {
    const candidates = [
      ...surnameVariants(e.fullName),
      ...(e.nameKa ? surnameVariants(e.nameKa) : []),
      norm(e.fullName),
    ]
    for (const c of candidates) {
      if (c.length < 3) continue
      const idx = t.indexOf(c)
      if (idx >= 0) {
        hits.push({ e, pos: idx, len: c.length })
        break
      }
    }
  }

  hits.sort((a, b) => a.pos - b.pos || b.len - a.len)
  const seen = new Set<string>()
  const out: Employee[] = []
  for (const h of hits) {
    if (seen.has(h.e.id)) continue
    seen.add(h.e.id)
    out.push(h.e)
  }
  return out
}

export function normalizeBrigadeQuery(q: string): string {
  return norm(q)
    .replace(/\bномер\b/g, '')
    .replace(/№/g, '')
    .replace(/\bточка\b/g, '.')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findBrigadeByVoice(brigades: string[], query: string): string | undefined {
  const q = normalizeBrigadeQuery(query)
  if (!q) return undefined

  const exact = brigades.find((b) => norm(b) === q || normalizeBrigadeQuery(b) === q)
  if (exact) return exact

  let best: { b: string; score: number } | undefined
  for (const b of brigades) {
    const n = normalizeBrigadeQuery(b)
    const compact = n.replace(/\s/g, '')
    const qCompact = q.replace(/\s/g, '')
    if (n.includes(q) || q.includes(n) || compact.includes(qCompact) || qCompact.includes(compact)) {
      const score = q.length / n.length
      if (!best || score > best.score) best = { b, score }
    }
  }
  return best?.b
}

export function extractBrigadeFromText(text: string, brigades: string[]): string | undefined {
  const t = norm(text)
  const patterns = [
    /(?:бригад[аеу]|отдел[ае]?)\s+(.+?)(?:\s+замени|\s+вместо|\s+назнач|$)/,
    /(?:в|на)\s+(?:бригад[еу]|отдел[е]?)\s+(.+)/,
    /(?:пропитк\w*)\s*([12][.\s]?\s*[12])/,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const br = findBrigadeByVoice(brigades, m[1].trim())
      if (br) return br
    }
  }
  if (/пропитк/.test(t)) {
    const num = t.match(/([12])\s*[.\s]*([12])/)
    if (num) {
      const br = findBrigadeByVoice(brigades, `пропитки ${num[1]}.${num[2]}`)
      if (br) return br
    }
  }
  return findBrigadeByVoice(brigades, t)
}
