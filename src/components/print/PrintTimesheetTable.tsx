import { Fragment } from 'react'
import { getBrigades } from '@/lib/brigades'
import { CODE_DEFS } from '@/lib/codes'
import {
  dayDateKey,
  daysInMonth,
  isWeekend,
  parseMonthKey,
  weekdayShort,
} from '@/lib/dates'
import { employeeName, t } from '@/i18n'
import { getFactMark, rowStats } from '@/lib/stats'
import type { AppStore, DayCode, Locale, MonthSheet } from '@/lib/types'

const CODE_PRINT: Record<string, string> = {
  '8': 'print-code--8',
  '11': 'print-code--11',
  'Н': 'print-code--n',
  '22': 'print-code--22',
  'В': 'print-code--v',
  'ОТ': 'print-code--ot',
  'Б': 'print-code--b',
  'X': 'print-code--x',
  'ПР': 'print-code--pr',
  '': 'print-code--empty',
}

function PrintCode({ code }: { code: DayCode }) {
  return (
    <span className={`print-day-cell ${CODE_PRINT[code] ?? CODE_PRINT['']}`}>
      {code || '·'}
    </span>
  )
}

type Props = {
  store: AppStore
  sheet: MonthSheet
  mode: 'plan' | 'fact'
  brigades: string[]
  printLocale: Locale
  showTotals?: boolean
}

export function PrintTimesheetTable({
  store,
  sheet,
  mode,
  brigades,
  printLocale,
  showTotals = true,
}: Props) {
  const brigadeSet = new Set(brigades)
  const allBrigades = getBrigades(store)
  const { year, month } = parseMonthKey(sheet.month)
  const days = daysInMonth(year, month)
  const dayNums = Array.from({ length: days }, (_, i) => i + 1)
  const totalCols = 4 + days + (showTotals ? (mode === 'fact' ? 2 : 1) : 0)

  const fixedPct = mode === 'fact' ? 34 : 30
  const dayPct = (100 - fixedPct) / days

  return (
    <table className="print-table">
      <colgroup>
        <col style={{ width: '3%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '4%' }} />
        <col style={{ width: '4%' }} />
        {dayNums.map((d) => (
          <col key={d} style={{ width: `${dayPct}%` }} />
        ))}
        {showTotals && (
          <>
            <col style={{ width: '4%' }} />
            {mode === 'fact' && <col style={{ width: '4%' }} />}
          </>
        )}
      </colgroup>
      <thead>
        <tr>
          <th className="print-th">{t(printLocale, 'print.colNo')}</th>
          <th className="print-th print-th-left">{t(printLocale, 'print.colName')}</th>
          <th className="print-th">{t(printLocale, 'print.colTab')}</th>
          <th className="print-th">{t(printLocale, 'print.colSchedule')}</th>
          {dayNums.map((d) => (
            <th
              key={d}
              className={`print-th print-th-day ${isWeekend(year, month, d) ? 'print-weekend' : ''}`}
            >
              <span className="print-day-num">{d}</span>
              <span className="print-dow">{weekdayShort(year, month, d)}</span>
            </th>
          ))}
          {showTotals && (
            <>
              <th className="print-th">{t(printLocale, 'print.colPlanH')}</th>
              {mode === 'fact' && (
                <th className="print-th">{t(printLocale, 'print.colFactH')}</th>
              )}
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {allBrigades.filter((b) => brigadeSet.has(b)).map((brigade) => {
          const rows = sheet.rows.filter((r) => r.brigade === brigade)
          if (!rows.some((r) => r.employeeId)) return null

          return (
            <Fragment key={brigade}>
              <tr className="print-brigade-row">
                <td colSpan={totalCols}>{brigade}</td>
              </tr>
              {rows.map((row, idx) => {
                const emp = row.employeeId
                  ? store.employees.find((e) => e.id === row.employeeId)
                  : null
                if (!emp) return null
                const rs = rowStats(sheet, row.id, days, year, month)
                return (
                  <tr key={row.id}>
                    <td className="print-td print-td-center">{idx + 1}</td>
                    <td className="print-td print-td-name">{employeeName(emp, printLocale)}</td>
                    <td className="print-td print-td-center">{emp.tabNumber}</td>
                    <td className="print-td print-td-center">
                      {emp.schedule === '5/2 8ч' ? '5/2' : '2/2'}
                    </td>
                    {dayNums.map((d) => {
                      const dateKey = dayDateKey(year, month, d)
                      const planCode = sheet.plan[row.id]?.[dateKey] ?? ''
                      const factCode = getFactMark(sheet, row.id, dateKey)
                      const code = mode === 'plan' ? planCode : factCode
                      const mismatch = planCode !== factCode
                      return (
                        <td
                          key={d}
                          className={`print-td print-td-day ${mismatch && mode === 'fact' ? 'print-mismatch' : ''}`}
                        >
                          <PrintCode code={code} />
                        </td>
                      )
                    })}
                    {showTotals && (
                      <>
                        <td className="print-td print-td-center print-td-bold">
                          {rs.planHours}
                        </td>
                        {mode === 'fact' && (
                          <td className="print-td print-td-center print-td-bold">
                            {rs.factHours}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                )
              })}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

export function PrintCodeLegend({ locale }: { locale: Locale }) {
  return (
    <div className="print-legend">
      <span>{t(locale, 'print.legend')}:</span>
      {CODE_DEFS.map((c) => (
        <span key={c.code}>
          <strong>{c.code}</strong>={t(locale, `code.label.${c.code}`)}
        </span>
      ))}
    </div>
  )
}
