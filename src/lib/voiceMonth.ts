import { monthKey } from './dates'
import type { MonthSheet } from './types'

export {
  buildVoiceVocabulary,
  findBrigadeByVoice,
  findEmployeeByVoiceName,
  findEmployeesInText,
  extractBrigadeFromText,
} from './voiceNames'

export function findEmptyRowInBrigade(
  sheet: MonthSheet,
  brigade: string,
): string | undefined {
  return sheet.rows.find((r) => r.brigade === brigade && !r.employeeId)?.id
}

export function findRowByEmployeeId(
  sheet: MonthSheet,
  employeeId: string,
): string | undefined {
  return sheet.rows.find((r) => r.employeeId === employeeId)?.id
}

export function findRowByEmployeeInBrigade(
  sheet: MonthSheet,
  brigade: string,
  employeeId: string,
): string | undefined {
  return sheet.rows.find((r) => r.brigade === brigade && r.employeeId === employeeId)?.id
}

export function pickBrigadeForVoice(
  brigades: string[],
  filterBrigade: string,
): string {
  if (filterBrigade) return filterBrigade
  return brigades[0] ?? ''
}

export function currentMonthKey(): string {
  const now = new Date()
  return monthKey(now.getFullYear(), now.getMonth() + 1)
}
