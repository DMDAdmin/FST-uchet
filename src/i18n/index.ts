import {
  employeeName,
  employeeNameLines,
  employeePosition,
  employeePositionLines,
  employeeSearchText,
} from './employeeText'
import { ka } from './ka'
import { ru } from './ru'
import type { Dict, Locale } from './types'

const DICTS: Record<Locale, Dict> = { ru, ka }

export function t(locale: Locale, key: string): string {
  return DICTS[locale][key] ?? DICTS.ru[key] ?? key
}

export {
  employeeName,
  employeeNameLines,
  employeePosition,
  employeePositionLines,
  employeeSearchText,
}

export function tf(locale: Locale, key: string, vars: Record<string, string | number>): string {
  let s = t(locale, key)
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export { LOCALES, type Locale } from './types'
