import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BilingualText } from '@/components/employee/BilingualText'
import { useI18n } from '@/context/I18nContext'
import { employeeSearchText } from '@/i18n'
import { brigadeLabel } from '@/lib/brigadeText'
import { getBrigades } from '@/lib/brigades'
import { getCellComment } from '@/lib/bulkOps'
import {
  dayDateKey,
  daysInMonth,
  formatMonthTitle,
  isWeekend,
  parseMonthKey,
  weekdayShort,
} from '@/lib/dates'
import {
  georgiaHolidayNameBilingual,
  isGeorgiaPublicHoliday,
} from '@/lib/georgiaCalendar'
import { getFactMark, rowStats } from '@/lib/stats'
import type { AppStore, MonthSheet } from '@/lib/types'
import { DayCell } from './DayCell'

type Props = {
  store: AppStore
  sheet: MonthSheet
  mode: 'plan' | 'fact'
  metaEditable?: boolean
  embedded?: boolean
  search?: string
  filterBrigade?: string
  filterSchedule?: string
  readOnly?: boolean
  onCycle: (rowId: string, dateKey: string) => void
  onAssign: (rowId: string, employeeId: string | null) => void
  onRegenerateRow: (rowId: string) => void
  onAddRow?: (brigade: string) => void
  onRemoveRow?: (rowId: string) => void
  onRemoveEmptyRow?: (brigade: string) => void
  onCommentRequest?: (rowId: string, dateKey: string) => void
}

type FocusCell = { rowId: string; day: number }

export function PlanFactTable({
  store,
  sheet,
  mode,
  metaEditable = true,
  embedded = false,
  search = '',
  filterBrigade = '',
  filterSchedule = '',
  readOnly = false,
  onCycle,
  onAssign,
  onRegenerateRow,
  onAddRow,
  onRemoveRow,
  onRemoveEmptyRow,
  onCommentRequest,
}: Props) {
  const { t, locale, employeeName, employeeNameLines, employeePositionLines } = useI18n()
  const { year, month } = parseMonthKey(sheet.month)
  const days = daysInMonth(year, month)
  const dayNums = Array.from({ length: days }, (_, i) => i + 1)
  const brigades = getBrigades(store)
  const tableRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<FocusCell | null>(null)

  const q = search.trim().toLowerCase()
  const hasFilter = !!(q || filterBrigade || filterSchedule)
  const editable = metaEditable && !readOnly

  const rowVisible = useCallback(
    (_rowId: string, brigade: string, employeeId: string | null) => {
      if (filterBrigade && brigade !== filterBrigade) return false
      const emp = employeeId ? store.employees.find((e) => e.id === employeeId) : null
      if (filterSchedule && emp?.schedule !== filterSchedule) return false
      if (q) {
        if (!emp) return false
        return employeeSearchText(emp).includes(q)
      }
      return true
    },
    [filterBrigade, filterSchedule, q, store.employees],
  )

  const visibleRowCount = useMemo(() => {
    let count = 0
    for (const brigade of brigades) {
      if (filterBrigade && brigade !== filterBrigade) continue
      for (const row of sheet.rows.filter((r) => r.brigade === brigade)) {
        if (rowVisible(row.id, row.brigade, row.employeeId)) count++
      }
    }
    return count
  }, [brigades, filterBrigade, rowVisible, sheet.rows])

  const navRows = useMemo(() => {
    const list: string[] = []
    for (const brigade of brigades) {
      if (filterBrigade && brigade !== filterBrigade) continue
      for (const row of sheet.rows.filter((r) => r.brigade === brigade)) {
        if (rowVisible(row.id, row.brigade, row.employeeId)) list.push(row.id)
      }
    }
    return list
  }, [brigades, filterBrigade, rowVisible, sheet.rows])

  useEffect(() => {
    const root = tableRef.current
    if (!root) return

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if (e.key === 'Enter' && focus && !readOnly) {
        e.preventDefault()
        if (e.ctrlKey && onCommentRequest) {
          onCommentRequest(focus.rowId, dayDateKey(year, month, focus.day))
        } else {
          onCycle(focus.rowId, dayDateKey(year, month, focus.day))
        }
        return
      }

      if (!focus || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return
      }
      e.preventDefault()
      const rowIdx = navRows.indexOf(focus.rowId)
      if (rowIdx < 0) return

      let nextRow = rowIdx
      let nextDay = focus.day
      if (e.key === 'ArrowLeft') nextDay = Math.max(1, focus.day - 1)
      else if (e.key === 'ArrowRight') nextDay = Math.min(days, focus.day + 1)
      else if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIdx - 1)
      else if (e.key === 'ArrowDown') nextRow = Math.min(navRows.length - 1, rowIdx + 1)

      setFocus({ rowId: navRows[nextRow], day: nextDay })
    }

    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [days, focus, month, navRows, onCommentRequest, onCycle, readOnly, year])

  useEffect(() => {
    if (!focus) return
    const dk = dayDateKey(year, month, focus.day)
    const btn = tableRef.current?.querySelector(
      `[data-cell="${focus.rowId}|${dk}"]`,
    ) as HTMLButtonElement | null
    btn?.focus()
  }, [focus, month, year])

  if (hasFilter && visibleRowCount === 0) {
    return (
      <div
        className={`px-4 py-8 text-center text-sm text-stone-500 ${
          embedded ? '' : 'rounded-xl border border-grid bg-white/80 shadow-sm'
        }`}
      >
        {t('month.noFilterResults')}
      </div>
    )
  }

  return (
    <div
      ref={tableRef}
      tabIndex={-1}
      className={`overflow-auto bg-white/80 outline-none ${
        embedded ? '' : 'rounded-xl border border-grid shadow-sm'
      }`}
    >
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-[#faf8f4]">
          <tr>
            <th className="sticky left-0 z-30 min-w-[2rem] border-b border-r border-grid bg-[#faf8f4] px-2 py-2 text-xs">
              №
            </th>
            <th className="sticky left-[2rem] z-30 min-w-[10rem] border-b border-r border-grid bg-[#faf8f4] px-2 py-2 text-left text-xs font-semibold">
              {t('table.colName')}
            </th>
            <th className="border-b border-grid px-2 py-2 text-xs">{t('table.colTab')}</th>
            <th className="min-w-[8rem] border-b border-grid px-2 py-2 text-left text-xs">
              {t('table.colPosition')}
            </th>
            <th className="border-b border-grid px-2 py-2 text-xs">{t('table.colSchedule')}</th>
            {dayNums.map((d) => {
              const dateKey = dayDateKey(year, month, d)
              const holiday = isGeorgiaPublicHoliday(dateKey)
              const holidayName = georgiaHolidayNameBilingual(dateKey)
              return (
                <th
                  key={d}
                  title={holidayName ?? undefined}
                  className={`border-b border-grid px-0 py-1 text-center ${
                    holiday
                      ? 'bg-violet-100 text-violet-800'
                      : isWeekend(year, month, d)
                        ? 'bg-accent-soft/30 text-accent'
                        : ''
                  }`}
                >
                  <div className="font-mono text-xs font-semibold">{d}</div>
                  <div className="text-[9px] text-stone-400">
                    {weekdayShort(year, month, d, locale)}
                  </div>
                </th>
              )
            })}
            <th className="border-b border-grid px-2 text-xs">{t('table.planH')}</th>
            <th className="border-b border-grid px-2 text-xs">{t('table.factH')}</th>
            <th className="border-b border-grid px-2 text-xs">Δ</th>
          </tr>
        </thead>
        <tbody>
          {brigades.map((brigade) => {
            const rows = sheet.rows.filter((r) => r.brigade === brigade)
            const visibleRows = rows.filter((r) =>
              rowVisible(r.id, r.brigade, r.employeeId),
            )
            const brigadeRowCount = rows.length
            const emptyRowCount = rows.filter((r) => !r.employeeId).length
            const canRemoveEmpty =
              brigadeRowCount > 1 && emptyRowCount > 0
            if (!visibleRows.length && q) return null
            if (filterBrigade && brigade !== filterBrigade) return null
            return (
              <Fragment key={brigade}>
                <tr className="bg-stone-50">
                  <td
                    colSpan={5 + days + 3}
                    className="sticky left-0 border-b border-grid px-3 py-2 text-xs font-bold uppercase tracking-wide text-accent"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{brigadeLabel(brigade, store.brigadeNamesKa, locale)}</span>
                      {editable && onAddRow && (
                        <button
                          type="button"
                          className="rounded border border-accent/40 bg-white px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-accent hover:bg-accent-soft"
                          onClick={() => onAddRow(brigade)}
                        >
                          + {t('table.addSlot')}
                        </button>
                      )}
                      {editable && onRemoveEmptyRow && canRemoveEmpty && (
                        <button
                          type="button"
                          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-stone-600 hover:bg-stone-100"
                          title={t('table.removeEmptySlotHint')}
                          onClick={() => onRemoveEmptyRow(brigade)}
                        >
                          − {t('table.addSlot')}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
                {visibleRows.map((row, idx) => {
                  const emp = row.employeeId
                    ? store.employees.find((e) => e.id === row.employeeId)
                    : null
                  const rs = rowStats(sheet, row.id, days, year, month)
                  return (
                    <tr key={row.id} className="group hover:bg-paper/60">
                      <td className="sticky left-0 border-b border-r border-grid bg-white px-1 py-1 font-mono text-xs group-hover:bg-paper/60">
                        <span className="flex items-center gap-1">
                          <span>{idx + 1}</span>
                          {editable && onRemoveRow && brigadeRowCount > 1 && (
                            <button
                              type="button"
                              className="rounded px-0.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                              title={t('table.removeSlot')}
                              onClick={() => onRemoveRow(row.id)}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="sticky left-[2rem] border-b border-r border-grid bg-white px-1 py-1 group-hover:bg-paper/60">
                        {editable ? (
                          <select
                            className="w-full max-w-[12rem] truncate rounded border-0 bg-transparent text-sm focus:ring-1 focus:ring-accent"
                            value={row.employeeId ?? ''}
                            onChange={(e) =>
                              onAssign(row.id, e.target.value || null)
                            }
                          >
                            <option value="">{t('table.freeSlot')}</option>
                            {store.employees
                              .filter((e) => e.active)
                              .sort((a, b) =>
                                a.fullName.localeCompare(b.fullName, 'ru'),
                              )
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {employeeName(e)}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="block max-w-[12rem] truncate px-1 text-sm font-medium">
                            {emp ? (
                              <BilingualText lines={employeeNameLines(emp)} />
                            ) : (
                              '—'
                            )}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-grid px-2 font-mono text-xs text-stone-500">
                        {emp?.tabNumber ?? '—'}
                      </td>
                      <td className="max-w-[10rem] border-b border-grid px-2 text-xs text-stone-600">
                        {emp ? (
                          <BilingualText lines={employeePositionLines(emp)} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="border-b border-grid px-2 text-xs whitespace-nowrap">
                        {emp ? (
                          readOnly ? (
                            <span>{emp.schedule}</span>
                          ) : (
                          <button
                            type="button"
                            className="text-accent hover:underline"
                            title={t('table.regenerateTitle')}
                            onClick={() => onRegenerateRow(row.id)}
                          >
                            {emp.schedule}
                          </button>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      {dayNums.map((d) => {
                        const dateKey = dayDateKey(year, month, d)
                        const planCode = sheet.plan[row.id]?.[dateKey] ?? ''
                        const factCode = getFactMark(sheet, row.id, dateKey)
                        const code = mode === 'plan' ? planCode : factCode
                        const mismatch = planCode !== factCode && !!emp
                        const comment = getCellComment(sheet, row.id, dateKey)
                        return (
                          <td key={d} className="border-b border-grid p-0">
                            <DayCell
                              code={code}
                              mismatch={mismatch}
                              dimmed={mode === 'plan' && mismatch}
                              hasComment={!!comment}
                              dataCell={`${row.id}|${dateKey}`}
                              onClick={() => {
                                if (emp && !readOnly) {
                                  setFocus({ rowId: row.id, day: d })
                                  onCycle(row.id, dateKey)
                                }
                              }}
                              onContextMenu={(e) => {
                                if (!emp || !onCommentRequest || readOnly) return
                                e.preventDefault()
                                setFocus({ rowId: row.id, day: d })
                                onCommentRequest(row.id, dateKey)
                              }}
                              title={
                                comment
                                  ? `${comment}${mismatch ? ' · ' : ''}${mismatch ? `${t('month.plan')} «${planCode || '·'}» → ${t('month.fact')} «${factCode || '·'}»` : `${dateKey} ${mode}`}`
                                  : mismatch
                                    ? `${dateKey}: ${t('month.plan')} «${planCode || '·'}» → ${t('month.fact')} «${factCode || '·'}»`
                                    : `${dateKey} ${mode}`
                              }
                            />
                          </td>
                        )
                      })}
                      <td className="border-b border-grid px-2 text-center font-mono text-xs">
                        {emp ? rs.planHours : '—'}
                      </td>
                      <td className="border-b border-grid px-2 text-center font-mono text-xs">
                        {emp ? rs.factHours : '—'}
                      </td>
                      <td
                        className={`border-b border-grid px-2 text-center font-mono text-xs ${
                          rs.mismatches ? 'font-semibold text-amber-700' : ''
                        }`}
                      >
                        {emp ? rs.mismatches : '—'}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {!embedded && (
        <p className="border-t border-grid px-3 py-2 text-xs text-stone-400">
          {formatMonthTitle(sheet.month, locale)} ·{' '}
          <strong>{mode === 'plan' ? t('table.planUpper') : t('table.factUpper')}</strong>
          {' · '}
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-400 align-middle" />{' '}
          {t('table.mismatch')}
        </p>
      )}
    </div>
  )
}
