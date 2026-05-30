import { dayDateKey, parseMonthKey } from './dates'
import { autoCodeForDay, isEmployeeAvailableOnDay } from './schedule'
import type { DayCode, Employee, Group2x2, MonthSheet, ScheduleType, ShiftMode } from './types'

function unavailableCode(emp: Employee): DayCode {
  const st = emp.employmentStatus ?? 'active'
  if (st === 'vacation' || st === 'maternity') return 'ОТ'
  return ''
}

export function rebuildPlanFromDay(
  sheet: MonthSheet,
  rowId: string,
  employee: Employee,
  fromDay: number,
): MonthSheet {
  const { year, month } = parseMonthKey(sheet.month)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDay = Math.max(1, Math.min(fromDay, daysInMonth))

  const existingPlan = sheet.plan[rowId] ?? {}
  const nextPlan = { ...existingPlan }
  const nextFact = { ...sheet.fact }
  const factRow = { ...(nextFact[rowId] ?? {}) }

  for (let d = startDay; d <= daysInMonth; d++) {
    const key = dayDateKey(year, month, d)
    let code: DayCode
    if (!isEmployeeAvailableOnDay(employee, key)) {
      code = unavailableCode(employee)
    } else {
      code = autoCodeForDay(
        employee.schedule,
        employee.cycleStart,
        year,
        month,
        d,
        employee.shiftMode ?? 'day',
      )
    }
    nextPlan[key] = code
    const oKey = `${rowId}|${key}`
    if (!sheet.factOverrides.includes(oKey)) {
      factRow[key] = code
    }
  }

  nextFact[rowId] = factRow
  return { ...sheet, plan: { ...sheet.plan, [rowId]: nextPlan }, fact: nextFact }
}

export function employeeWithScheduleFromDay(
  emp: Employee,
  schedule: ScheduleType,
  fromDay: number,
  monthKeyStr: string,
): Employee {
  return employeeWithAttributesFromDay(emp, { schedule }, fromDay, monthKeyStr)
}

export function employeeWithAttributesFromDay(
  emp: Employee,
  attrs: Partial<Pick<Employee, 'schedule' | 'group2x2' | 'shiftMode'>>,
  fromDay: number,
  monthKeyStr: string,
): Employee {
  const { year, month } = parseMonthKey(monthKeyStr)
  const next: Employee = { ...emp, ...attrs }
  const schedule = attrs.schedule ?? emp.schedule
  const needsCycle =
    schedule === '2/2 11ч' &&
    (attrs.schedule === '2/2 11ч' || attrs.group2x2 !== undefined || attrs.shiftMode !== undefined)
  if (needsCycle) {
    next.cycleStart = dayDateKey(year, month, fromDay)
  }
  return next
}

export type EmployeeShiftPatch = {
  schedule?: ScheduleType
  group2x2?: Group2x2
  shiftMode?: ShiftMode
}
