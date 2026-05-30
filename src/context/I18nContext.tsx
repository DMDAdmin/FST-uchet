import { createContext, useContext, type ReactNode } from 'react'
import {
  employeeName,
  employeeNameLines,
  employeePosition,
  employeePositionLines,
  employeeSearchText,
  t,
  tf,
  type Locale,
} from '@/i18n'
import type { MonthStats } from '@/lib/stats'

type I18nContextValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
  tf: (key: string, vars: Record<string, string | number>) => string
  employeeName: (emp: import('@/lib/types').Employee) => string
  employeeNameLines: (emp: import('@/lib/types').Employee) => import('@/i18n/employeeText').BilingualLines
  employeePosition: (emp: import('@/lib/types').Employee) => string
  employeePositionLines: (emp: import('@/lib/types').Employee) => import('@/i18n/employeeText').BilingualLines
  employeeSearchText: (emp: import('@/lib/types').Employee) => string
  statsReadiness: (v: MonthStats['readiness']) => string
  statsControl: (v: MonthStats['control']) => string
  codeLabel: (code: import('@/lib/types').DayCode) => string
  codeCategory: (categoryKey: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

type Props = {
  locale: Locale
  setLocale: (l: Locale) => void
  children: ReactNode
}

export function I18nProvider({ locale, setLocale, children }: Props) {
  const value: I18nContextValue = {
    locale,
    setLocale,
    t: (key) => t(locale, key),
    tf: (key, vars) => tf(locale, key, vars),
    employeeName: (emp) => employeeName(emp, locale),
    employeeNameLines: (emp) => employeeNameLines(emp, locale),
    employeePosition: (emp) => employeePosition(emp, locale),
    employeePositionLines: (emp) => employeePositionLines(emp, locale),
    employeeSearchText: (emp) => employeeSearchText(emp),
    statsReadiness: (v) => t(locale, `stats.${v}`),
    statsControl: (v) => t(locale, v === 'ok' ? 'stats.ok' : 'stats.mismatch'),
    codeLabel: (code) => t(locale, `code.label.${code}`),
    codeCategory: (categoryKey) => t(locale, categoryKey),
  }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside provider')
  return ctx
}
