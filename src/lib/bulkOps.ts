import { dayDateKey, daysInMonth, parseMonthKey } from './dates'
import { isGeorgiaPublicHoliday } from './georgiaCalendar'
import type { AppStore, MonthSheet } from './types'

/** Проставить «В» в плане (и факте без override) на все праздники месяца */
export function applyHolidayVForAll(sheet: MonthSheet): MonthSheet {
  const { year, month } = parseMonthKey(sheet.month)
  const days = daysInMonth(year, month)
  let next = { ...sheet, plan: { ...sheet.plan }, fact: { ...sheet.fact } }

  for (const row of sheet.rows) {
    if (!row.employeeId) continue
    const planRow = { ...(next.plan[row.id] ?? {}) }
    const factRow = { ...(next.fact[row.id] ?? {}) }

    for (let d = 1; d <= days; d++) {
      const dk = dayDateKey(year, month, d)
      if (!isGeorgiaPublicHoliday(dk)) continue
      planRow[dk] = 'В'
      const oKey = `${row.id}|${dk}`
      if (!sheet.factOverrides.includes(oKey)) {
        factRow[dk] = 'В'
      }
    }
    next.plan[row.id] = planRow
    next.fact[row.id] = factRow
  }
  return next
}

/** Скопировать план → факт для сотрудников 5/2 (сброс ручных правок факта по строке) */
export function copyPlanToFactFor52(
  sheet: MonthSheet,
  employees: AppStore['employees'],
): MonthSheet {
  let next: MonthSheet = {
    ...sheet,
    fact: { ...sheet.fact },
    factOverrides: [...sheet.factOverrides],
  }

  for (const row of sheet.rows) {
    if (!row.employeeId) continue
    const emp = employees.find((e) => e.id === row.employeeId)
    if (!emp || emp.schedule !== '5/2 8ч') continue

    const planRow = sheet.plan[row.id] ?? {}
    next.fact[row.id] = { ...planRow }
    next.factOverrides = next.factOverrides.filter((k) => !k.startsWith(`${row.id}|`))
  }
  return next
}

export function setCellComment(
  sheet: MonthSheet,
  rowId: string,
  dateKey: string,
  text: string,
): MonthSheet {
  const key = `${rowId}|${dateKey}`
  const comments = { ...sheet.comments }
  if (text.trim()) comments[key] = text.trim()
  else delete comments[key]
  return { ...sheet, comments }
}

export function getCellComment(
  sheet: MonthSheet,
  rowId: string,
  dateKey: string,
): string {
  return sheet.comments[`${rowId}|${dateKey}`] ?? ''
}
