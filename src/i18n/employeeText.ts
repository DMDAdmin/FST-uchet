import type { Employee } from '@/lib/types'
import type { Locale } from './types'

/** Один язык по локали интерфейса; при отсутствии перевода — fallback на второй. */
function localeText(
  ru: string | undefined,
  ka: string | undefined,
  locale: Locale,
): string {
  const r = ru?.trim() ?? ''
  const k = ka?.trim() ?? ''
  if (locale === 'ka') return k || r || '—'
  return r || k || '—'
}

export type BilingualLines = { primary: string; secondary?: string }

export function employeeNameLines(emp: Employee, locale: Locale): BilingualLines {
  return { primary: localeText(emp.fullName, emp.nameKa, locale) }
}

export function employeePositionLines(emp: Employee, locale: Locale): BilingualLines {
  return { primary: localeText(emp.position, emp.positionKa, locale) }
}

export function employeeName(emp: Employee, locale: Locale): string {
  return localeText(emp.fullName, emp.nameKa, locale)
}

export function employeePosition(emp: Employee, locale: Locale): string {
  return localeText(emp.position, emp.positionKa, locale)
}

export function employeeSearchText(emp: Employee): string {
  return [emp.fullName, emp.nameKa, emp.position, emp.positionKa, emp.tabNumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
