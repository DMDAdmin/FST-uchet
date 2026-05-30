import * as XLSX from 'xlsx'
import { formatMonthTitle } from './dates'
import { calculateRowPay } from './payroll'
import type { AppStore, Locale } from './types'

export function exportPayrollExcel(store: AppStore, month: string, locale: Locale): void {
  const sheet = store.months[month]
  if (!sheet) return
  const [y, m] = month.split('-').map(Number)

  const rows: (string | number)[][] = [
    ['ФИО RU', 'ФИО GE', 'Бригада', 'График', 'Факт ч', 'К начислению ₾'],
  ]

  for (const row of sheet.rows) {
    if (!row.employeeId) continue
    const emp = store.employees.find((e) => e.id === row.employeeId)
    if (!emp?.active) continue
    const pay = calculateRowPay(emp, sheet, row.id, y, m)
    rows.push([
      emp.fullName,
      emp.nameKa ?? '',
      emp.brigade,
      emp.schedule,
      pay.factHours,
      Math.round(pay.amount * 100) / 100,
    ])
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, formatMonthTitle(month, locale).slice(0, 31))
  XLSX.writeFile(wb, `fibercell-pay-${month}.xlsx`)
}

export function exportBrigadeReportExcel(store: AppStore, month: string): void {
  const sheet = store.months[month]
  if (!sheet) return
  const [y, m] = month.split('-').map(Number)

  const byBrigade = new Map<string, { hours: number; amount: number }>()

  for (const row of sheet.rows) {
    if (!row.employeeId) continue
    const emp = store.employees.find((e) => e.id === row.employeeId)
    if (!emp?.active) continue
    const pay = calculateRowPay(emp, sheet, row.id, y, m)
    const b = emp.brigade || '—'
    const cur = byBrigade.get(b) ?? { hours: 0, amount: 0 }
    byBrigade.set(b, {
      hours: cur.hours + pay.factHours,
      amount: cur.amount + pay.amount,
    })
  }

  const rows: (string | number)[][] = [['Бригада', 'Факт ч', 'Сумма ₾']]
  for (const [b, v] of byBrigade) {
    rows.push([b, v.hours, Math.round(v.amount * 100) / 100])
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'brigades')
  XLSX.writeFile(wb, `fibercell-brigades-${month}.xlsx`)
}
