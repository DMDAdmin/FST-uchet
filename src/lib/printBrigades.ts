import type { MonthSheet } from './types'

export type BrigadePrintInfo = {
  name: string
  employeeCount: number
  hasEmployees: boolean
}

/** Бригады с хотя бы одним назначенным сотрудником в табеле месяца */
export function getBrigadesForPrint(
  sheet: MonthSheet,
  brigades: string[],
): BrigadePrintInfo[] {
  return brigades.map((name) => {
    const employeeCount = sheet.rows.filter(
      (r) => r.brigade === name && r.employeeId,
    ).length
    return { name, employeeCount, hasEmployees: employeeCount > 0 }
  })
}

export function defaultSelectedBrigades(
  sheet: MonthSheet,
  brigades: string[],
): string[] {
  return getBrigadesForPrint(sheet, brigades)
    .filter((b) => b.hasEmployees)
    .map((b) => b.name)
}
