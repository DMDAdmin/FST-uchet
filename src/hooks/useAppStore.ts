import { useCallback, useEffect, useRef, useState } from 'react'
import { auditFactChange, appendAudit } from '@/lib/audit'
import {
  addBrigadeToStore,
  removeBrigadeFromStore,
  renameBrigadeInStore,
} from '@/lib/brigadeManage'
import {
  applyHolidayVForAll,
  copyPlanToFactFor52,
  setCellComment,
} from '@/lib/bulkOps'
import { runDailyBackup } from '@/lib/backup'
import { ensureMonth, syncPlanRow } from '@/lib/monthSheet'
import { employeeWithAttributesFromDay, employeeWithScheduleFromDay, rebuildPlanFromDay } from '@/lib/planFromDay'
import type { EmployeeShiftPatch } from '@/lib/planFromDay'
import { appendWarehouseAudit } from '@/lib/warehouse/audit'
import { postWarehouseDocument, runInventoryCount } from '@/lib/warehouse/documents'
import { mergeInvoiceRegistry } from '@/lib/warehouse/georgianInvoice'
import { importWarehouseFromExcel } from '@/lib/warehouse/importExport'
import { toBaseQty } from '@/lib/warehouse/stock'
import { applyStoreUpdate } from '@/lib/safeStoreUpdate'
import { dayDateKey, parseMonthKey } from '@/lib/dates'
import { addBrigadeRow, removeBrigadeRow, removeEmptyBrigadeRow } from '@/lib/brigadeRows'
import {
  addMonthToStore,
  isMonthArchived,
  setMonthArchived,
} from '@/lib/monthManage'
import { nextCode } from '@/lib/codes'
import { applyTemplateToBrigade, applyTemplateToEmployees } from '@/lib/shiftTemplates'
import {
  createDefaultStore,
  loadStore,
  saveStore,
  type LoadStoreResult,
  type SaveStoreResult,
} from '@/lib/storage'
import {
  permanentlyDeleteTrashEmployee,
  permanentlyDeleteTrashMonth,
  purgeExpiredTrash,
  restoreTrashEmployee,
  restoreTrashMonth,
  trashEmployee,
  trashMonth,
} from '@/lib/trash'
import type {
  AppStore,
  DayCode,
  Employee,
  MonthSheet,
  ScheduleType,
  StockMovement,
  ViewId,
  WarehouseCategory,
  WarehouseItem,
  WarehouseLocation,
  WarehouseStore,
  WarehouseDocument,
} from '@/lib/types'
import { STORAGE_KEY } from '@/lib/types'
import { getFactMark } from '@/lib/stats'
import { popVoiceUndo, pushVoiceUndo, type VoiceUndoEntry } from '@/lib/voiceUndo'

export function useAppStore() {
  const initialLoad = useRef<LoadStoreResult>(loadStore())
  const [store, setStore] = useState<AppStore>(() =>
    purgeExpiredTrash(initialLoad.current.store),
  )
  const [loadWarning, setLoadWarning] = useState<LoadStoreResult['warning']>(
    () => initialLoad.current.warning,
  )
  const [saveError, setSaveError] = useState<SaveStoreResult | null>(null)
  const voiceUndoRef = useRef<VoiceUndoEntry[]>([])
  const [view, setView] = useState<ViewId>('month')
  const [activeMonth, setActiveMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    setStore((s) => runDailyBackup(s))
  }, [])

  useEffect(() => {
    if (import.meta.env.VITE_FST_WEB === 'true') return
    const result = saveStore(store)
    if (!result.ok) {
      setSaveError(result)
    } else {
      setSaveError(null)
    }
  }, [store])

  const patch = useCallback((fn: (s: AppStore) => AppStore) => {
    setStore((s) => purgeExpiredTrash(fn(s)))
  }, [])

  const updateMonth = useCallback((month: string, updater: (sheet: MonthSheet) => MonthSheet) => {
    setStore((s) => {
      const base = ensureMonth(s, month)
      const sheet = base.months[month]
      return {
        ...base,
        months: { ...base.months, [month]: updater(sheet) },
      }
    })
  }, [])

  const upsertEmployee = useCallback((emp: Employee) => {
    setStore((s) => {
      const exists = s.employees.some((e) => e.id === emp.id)
      const employees = exists
        ? s.employees.map((e) => (e.id === emp.id ? emp : e))
        : [...s.employees, emp]
      let next = { ...s, employees }
      for (const [key, sheet] of Object.entries(next.months)) {
        let updated = sheet
        for (const row of sheet.rows) {
          if (row.employeeId === emp.id) {
            updated = syncPlanRow(updated, row.id, emp)
          }
        }
        next = { ...next, months: { ...next.months, [key]: updated } }
      }
      return next
    })
  }, [])

  const removeEmployee = useCallback((id: string) => {
    setStore((s) => {
      let next = trashEmployee(s, id)
      next = appendAudit(next, {
        action: 'employee_remove',
        employeeId: id,
        detail: `employee ${id}`,
      })
      return next
    })
  }, [])

  const assignRowEmployee = useCallback(
    (month: string, rowId: string, employeeId: string | null) => {
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.id === rowId)
        if (!row) return base

        const rows = sheet.rows.map((r) => {
          if (r.id === rowId) return { ...r, employeeId }
          if (employeeId && r.employeeId === employeeId) {
            return { ...r, employeeId: null }
          }
          return r
        })
        let next: MonthSheet = { ...sheet, rows }
        if (employeeId) {
          const emp = base.employees.find((e) => e.id === employeeId)
          if (emp) next = syncPlanRow(next, rowId, emp)
        } else {
          const { [rowId]: _p, ...plan } = next.plan
          const { [rowId]: _f, ...fact } = next.fact
          next = {
            ...next,
            plan,
            fact,
            factOverrides: next.factOverrides.filter((k) => !k.startsWith(`${rowId}|`)),
          }
        }
        for (const r of rows) {
          if (r.id !== rowId && !r.employeeId && next.plan[r.id]) {
            const { [r.id]: _p, ...plan } = next.plan
            const { [r.id]: _f, ...fact } = next.fact
            next = {
              ...next,
              plan,
              fact,
              factOverrides: next.factOverrides.filter((k) => !k.startsWith(`${r.id}|`)),
            }
          }
        }
        return { ...base, months: { ...base.months, [month]: next } }
      })
    },
    [],
  )

  const setMark = useCallback(
    (month: string, rowId: string, dateKey: string, mode: 'plan' | 'fact', code: import('@/lib/types').DayCode) => {
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.id === rowId)
        let nextSheet = sheet
        if (mode === 'plan') {
          nextSheet = {
            ...sheet,
            plan: {
              ...sheet.plan,
              [rowId]: { ...sheet.plan[rowId], [dateKey]: code },
            },
          }
        } else {
          const oKey = `${rowId}|${dateKey}`
          const prev = getFactMark(sheet, rowId, dateKey) ?? ''
          nextSheet = {
            ...sheet,
            fact: { ...sheet.fact, [rowId]: { ...sheet.fact[rowId], [dateKey]: code } },
            factOverrides: sheet.factOverrides.includes(oKey)
              ? sheet.factOverrides
              : [...sheet.factOverrides, oKey],
          }
          let next = { ...base, months: { ...base.months, [month]: nextSheet } }
          next = auditFactChange(
            next,
            month,
            rowId,
            dateKey,
            row?.employeeId ?? undefined,
            prev,
            code,
          )
          return next
        }
        return { ...base, months: { ...base.months, [month]: nextSheet } }
      })
    },
    [],
  )

  const cycleMark = useCallback(
    (month: string, rowId: string, dateKey: string, mode: 'plan' | 'fact') => {
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.id === rowId)
        const current =
          mode === 'plan'
            ? (sheet.plan[rowId]?.[dateKey] ?? '')
            : (getFactMark(sheet, rowId, dateKey) ?? '')
        const code = nextCode(current)
        let nextSheet = sheet
        if (mode === 'plan') {
          nextSheet = {
            ...sheet,
            plan: {
              ...sheet.plan,
              [rowId]: { ...sheet.plan[rowId], [dateKey]: code },
            },
          }
        } else {
          const oKey = `${rowId}|${dateKey}`
          nextSheet = {
            ...sheet,
            fact: { ...sheet.fact, [rowId]: { ...sheet.fact[rowId], [dateKey]: code } },
            factOverrides: sheet.factOverrides.includes(oKey)
              ? sheet.factOverrides
              : [...sheet.factOverrides, oKey],
          }
          let next = { ...base, months: { ...base.months, [month]: nextSheet } }
          next = auditFactChange(
            next,
            month,
            rowId,
            dateKey,
            row?.employeeId ?? undefined,
            current,
            code,
          )
          return next
        }
        return { ...base, months: { ...base.months, [month]: nextSheet } }
      })
    },
    [],
  )

  const setCellCommentAction = useCallback(
    (month: string, rowId: string, dateKey: string, text: string) => {
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = setCellComment(base.months[month], rowId, dateKey, text)
        let next = { ...base, months: { ...base.months, [month]: sheet } }
        next = appendAudit(next, {
          action: 'comment',
          month,
          rowId,
          dateKey,
          detail: text.slice(0, 80),
        })
        return next
      })
    },
    [],
  )

  const bulkHolidayV = useCallback((month: string) => {
    setStore((s) => {
      const base = ensureMonth(s, month)
      const sheet = applyHolidayVForAll(base.months[month])
      let next = { ...base, months: { ...base.months, [month]: sheet } }
      return appendAudit(next, { action: 'bulk', month, detail: 'holiday V all' })
    })
  }, [])

  const bulkCopyPlanToFact52 = useCallback((month: string) => {
    setStore((s) => {
      const base = ensureMonth(s, month)
      const sheet = copyPlanToFactFor52(base.months[month], base.employees)
      let next = { ...base, months: { ...base.months, [month]: sheet } }
      return appendAudit(next, { action: 'bulk', month, detail: 'copy plan→fact 5/2' })
    })
  }, [])

  const regenerateRowPlan = useCallback(
    (month: string, rowId: string) => {
      const row = store.months[month]?.rows.find((r) => r.id === rowId)
      const emp = row?.employeeId
        ? store.employees.find((e) => e.id === row.employeeId)
        : null
      if (!emp) return
      updateMonth(month, (sheet) => syncPlanRow(sheet, rowId, emp))
    },
    [store, updateMonth],
  )

  const regenerateMonthPlan = useCallback(
    (month: string) => {
      updateMonth(month, (sheet) => {
        let next = sheet
        for (const row of sheet.rows) {
          const emp = row.employeeId
            ? store.employees.find((e) => e.id === row.employeeId)
            : null
          if (emp) next = syncPlanRow(next, row.id, emp)
        }
        return next
      })
    },
    [store.employees, updateMonth],
  )

  const replaceStore = useCallback((next: AppStore) => setStore(purgeExpiredTrash(next)), [])
  const resetStore = useCallback(() => {
    for (const key of [
      STORAGE_KEY,
      'fibercell-tabel-v6',
      'fibercell-tabel-v5',
      'fibercell-tabel-v4',
      'fibercell-tabel-v3',
      'fibercell-tabel-v2',
      'tabel-local-v1',
    ]) {
      localStorage.removeItem(key)
    }
    setStore(createDefaultStore())
  }, [])

  const addBrigade = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('empty')
    applyStoreUpdate(setStore, (s) => addBrigadeToStore(s, trimmed))
  }, [])

  const renameBrigade = useCallback((oldName: string, newName: string) => {
    applyStoreUpdate(setStore, (s) => {
      let next = renameBrigadeInStore(s, oldName, newName)
      const ka = next.brigadeNamesKa[oldName]
      if (ka) {
        const { [oldName]: _, ...rest } = next.brigadeNamesKa
        next = { ...next, brigadeNamesKa: { ...rest, [newName]: ka } }
      }
      return next
    })
  }, [])

  const setBrigadeNameKa = useCallback((nameRu: string, nameKa: string) => {
    setStore((s) => ({
      ...s,
      brigadeNamesKa: { ...s.brigadeNamesKa, [nameRu]: nameKa },
    }))
  }, [])

  const removeBrigade = useCallback((name: string) => {
    applyStoreUpdate(setStore, (s) => removeBrigadeFromStore(s, name))
  }, [])

  const addMonth = useCallback((month: string) => {
    applyStoreUpdate(setStore, (s) => addMonthToStore(s, month))
  }, [])

  const removeMonth = useCallback((month: string) => {
    let nextActive: string | undefined
    applyStoreUpdate(setStore, (s) => {
      if (isMonthArchived(s, month)) throw new Error('archived')
      const next = trashMonth(s, month)
      if (activeMonth === month) {
        const keys = Object.keys(next.months).sort()
        if (keys.length > 0) {
          nextActive = keys[keys.length - 1]
        } else {
          const now = new Date()
          nextActive = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
      }
      return next
    })
    if (nextActive) setActiveMonth(nextActive)
  }, [activeMonth])

  const archiveMonth = useCallback((month: string, archived: boolean) => {
    applyStoreUpdate(setStore, (s) => setMonthArchived(s, month, archived))
  }, [])

  const updateSettings = useCallback(
    (patchSettings: Partial<AppStore['settings']>) => {
      setStore((s) => ({
        ...s,
        settings: {
          ...s.settings,
          ...patchSettings,
          ai: patchSettings.ai ? { ...s.settings.ai, ...patchSettings.ai } : s.settings.ai,
          signatures: patchSettings.signatures
            ? { ...s.settings.signatures, ...patchSettings.signatures }
            : s.settings.signatures,
        },
      }))
    },
    [],
  )

  const setLocale = useCallback(
    (locale: AppStore['settings']['locale']) => {
      updateSettings({ locale })
    },
    [updateSettings],
  )

  const applyShiftTemplate = useCallback(
    (templateId: string, employeeIds: string[]) => {
      setStore((s) => applyTemplateToEmployees(s, templateId, employeeIds))
    },
    [],
  )

  const applyShiftTemplateBrigade = useCallback(
    (templateId: string, brigade: string) => {
      setStore((s) => applyTemplateToBrigade(s, templateId, brigade))
    },
    [],
  )

  const addBrigadeRowToMonth = useCallback(
    (month: string, brigade: string) => {
      updateMonth(month, (sheet) => addBrigadeRow(sheet, brigade))
    },
    [updateMonth],
  )

  const removeBrigadeRowFromMonth = useCallback(
    (month: string, rowId: string) => {
      updateMonth(month, (sheet) => removeBrigadeRow(sheet, rowId))
    },
    [updateMonth],
  )

  const removeEmptyBrigadeRowFromMonth = useCallback(
    (month: string, brigade: string) => {
      updateMonth(month, (sheet) => removeEmptyBrigadeRow(sheet, brigade))
    },
    [updateMonth],
  )

  const replaceEmployeeInBrigade = useCallback(
    (
      month: string,
      brigade: string,
      fromEmployeeId: string,
      toEmployeeId: string,
    ): boolean => {
      let ok = false
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const row = sheet.rows.find(
          (r) => r.brigade === brigade && r.employeeId === fromEmployeeId,
        )
        if (!row) return base

        const rows = sheet.rows.map((r) => {
          if (r.id === row.id) return { ...r, employeeId: toEmployeeId }
          if (r.employeeId === toEmployeeId) return { ...r, employeeId: null }
          return r
        })
        let next: MonthSheet = { ...sheet, rows }
        const emp = base.employees.find((e) => e.id === toEmployeeId)
        if (emp) next = syncPlanRow(next, row.id, emp)
        ok = true
        return { ...base, months: { ...base.months, [month]: next } }
      })
      return ok
    },
    [],
  )

  const swapEmployeeRows = useCallback(
    (month: string, employeeIdA: string, employeeIdB: string,
    ): boolean => {
      let ok = false
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const rowA = sheet.rows.find((r) => r.employeeId === employeeIdA)
        const rowB = sheet.rows.find((r) => r.employeeId === employeeIdB)
        if (!rowA || !rowB) return base

        const rows = sheet.rows.map((r) => {
          if (r.id === rowA.id) return { ...r, employeeId: employeeIdB }
          if (r.id === rowB.id) return { ...r, employeeId: employeeIdA }
          return r
        })
        let next: MonthSheet = { ...sheet, rows }
        const empA = base.employees.find((e) => e.id === employeeIdA)
        const empB = base.employees.find((e) => e.id === employeeIdB)
        if (empB) next = syncPlanRow(next, rowA.id, empB)
        if (empA) next = syncPlanRow(next, rowB.id, empA)
        ok = true
        return { ...base, months: { ...base.months, [month]: next } }
      })
      return ok
    },
    [],
  )

  const changeEmployeeScheduleFromDay = useCallback(
    (
      month: string,
      employeeId: string,
      fromDay: number,
      schedule: ScheduleType,
    ): boolean => {
      let ok = false
      setStore((s) => {
        const base = ensureMonth(s, month)
        const emp = base.employees.find((e) => e.id === employeeId)
        if (!emp) return base

        const updated = employeeWithScheduleFromDay(emp, schedule, fromDay, month)
        const employees = base.employees.map((e) =>
          e.id === employeeId ? updated : e,
        )

        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.employeeId === employeeId)
        if (!row) {
          ok = true
          return { ...base, employees }
        }

        const nextSheet = rebuildPlanFromDay(sheet, row.id, updated, fromDay)
        ok = true
        return {
          ...base,
          employees,
          months: { ...base.months, [month]: nextSheet },
        }
      })
      return ok
    },
    [],
  )

  const changeEmployeeAttributesFromDay = useCallback(
    (
      month: string,
      employeeId: string,
      fromDay: number,
      attrs: EmployeeShiftPatch,
    ): boolean => {
      let ok = false
      setStore((s) => {
        const base = ensureMonth(s, month)
        const emp = base.employees.find((e) => e.id === employeeId)
        if (!emp) return base

        const updated = employeeWithAttributesFromDay(emp, attrs, fromDay, month)
        const employees = base.employees.map((e) =>
          e.id === employeeId ? updated : e,
        )

        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.employeeId === employeeId)
        if (!row) {
          ok = true
          return { ...base, employees }
        }

        const nextSheet = rebuildPlanFromDay(sheet, row.id, updated, fromDay)
        ok = true
        return {
          ...base,
          employees,
          months: { ...base.months, [month]: nextSheet },
        }
      })
      return ok
    },
    [],
  )

  const assignPermanentToBrigade = useCallback(
    (month: string, employeeId: string, brigade: string): boolean => {
      let ok = false
      setStore((s) => {
        const base = ensureMonth(s, month)
        const emp = base.employees.find((e) => e.id === employeeId)
        if (!emp || !base.brigades.includes(brigade)) return base

        const updatedEmp = { ...emp, brigade }
        let sheet = base.months[month]

        let targetRowId = sheet.rows.find(
          (r) => r.brigade === brigade && !r.employeeId,
        )?.id
        if (!targetRowId) {
          sheet = addBrigadeRow(sheet, brigade)
          targetRowId = sheet.rows.find(
            (r) => r.brigade === brigade && !r.employeeId,
          )?.id
        }
        if (!targetRowId) return base

        const rows = sheet.rows.map((r) => {
          if (r.id === targetRowId) return { ...r, employeeId }
          if (employeeId && r.employeeId === employeeId) {
            return { ...r, employeeId: null }
          }
          return r
        })

        let nextSheet: MonthSheet = { ...sheet, rows }
        nextSheet = syncPlanRow(nextSheet, targetRowId, updatedEmp)

        for (const r of rows) {
          if (r.id !== targetRowId && !r.employeeId && nextSheet.plan[r.id]) {
            const { [r.id]: _p, ...plan } = nextSheet.plan
            const { [r.id]: _f, ...fact } = nextSheet.fact
            nextSheet = {
              ...nextSheet,
              plan,
              fact,
              factOverrides: nextSheet.factOverrides.filter(
                (k) => !k.startsWith(`${r.id}|`),
              ),
            }
          }
        }

        ok = true
        return {
          ...base,
          employees: base.employees.map((e) =>
            e.id === employeeId ? updatedEmp : e,
          ),
          months: { ...base.months, [month]: nextSheet },
        }
      })
      return ok
    },
    [],
  )

  const captureVoiceUndo = useCallback((label: string) => {
    voiceUndoRef.current = pushVoiceUndo(voiceUndoRef.current, store, label)
  }, [store])

  const undoVoiceAction = useCallback((): string | null => {
    const { nextStack, entry } = popVoiceUndo(voiceUndoRef.current)
    voiceUndoRef.current = nextStack
    if (!entry) return null
    setStore(purgeExpiredTrash(entry.snapshot))
    return entry.label
  }, [])

  const setMarksRange = useCallback(
    (
      month: string,
      rowId: string,
      fromDay: number,
      toDay: number,
      mode: 'plan' | 'fact',
      code: DayCode,
    ) => {
      setStore((s) => {
        const base = ensureMonth(s, month)
        const sheet = base.months[month]
        const row = sheet.rows.find((r) => r.id === rowId)
        const { year, month: mo } = parseMonthKey(month)

        if (mode === 'plan') {
          const rowPlan = { ...(sheet.plan[rowId] ?? {}) }
          for (let d = fromDay; d <= toDay; d++) {
            rowPlan[dayDateKey(year, mo, d)] = code
          }
          return {
            ...base,
            months: {
              ...base.months,
              [month]: { ...sheet, plan: { ...sheet.plan, [rowId]: rowPlan } },
            },
          }
        }

        const rowFact = { ...(sheet.fact[rowId] ?? {}) }
        const overrides = [...sheet.factOverrides]
        for (let d = fromDay; d <= toDay; d++) {
          const dateKey = dayDateKey(year, mo, d)
          rowFact[dateKey] = code
          const oKey = `${rowId}|${dateKey}`
          if (!overrides.includes(oKey)) overrides.push(oKey)
        }
        let next: AppStore = {
          ...base,
          months: {
            ...base.months,
            [month]: {
              ...sheet,
              fact: { ...sheet.fact, [rowId]: rowFact },
              factOverrides: overrides,
            },
          },
        }
        for (let d = fromDay; d <= toDay; d++) {
          const dateKey = dayDateKey(year, mo, d)
          const prev = getFactMark(sheet, rowId, dateKey) ?? ''
          next = auditFactChange(
            next,
            month,
            rowId,
            dateKey,
            row?.employeeId ?? undefined,
            prev,
            code,
          )
        }
        return next
      })
    },
    [],
  )

  const patchWarehouse = useCallback((fn: (w: WarehouseStore) => WarehouseStore) => {
    setStore((s) => ({ ...s, warehouse: fn(s.warehouse) }))
  }, [])

  const upsertWarehouseItem = useCallback(
    (item: WarehouseItem) => {
      patchWarehouse((w) => {
        const exists = w.items.some((i) => i.id === item.id)
        let next: WarehouseStore = {
          ...w,
          items: exists
            ? w.items.map((i) => (i.id === item.id ? item : i))
            : [...w.items, item],
        }
        next = appendWarehouseAudit(next, {
          action: exists ? 'item_change' : 'item_change',
          detail: exists ? `Изменено: ${item.name}` : `Добавлено: ${item.name}`,
          itemId: item.id,
        })
        return next
      })
    },
    [patchWarehouse],
  )

  const archiveWarehouseItem = useCallback(
    (id: string, archived: boolean) => {
      patchWarehouse((w) => {
        const item = w.items.find((i) => i.id === id)
        if (!item) return w
        let next: WarehouseStore = {
          ...w,
          items: w.items.map((i) =>
            i.id === id ? { ...i, active: !archived } : i,
          ),
        }
        next = appendWarehouseAudit(next, {
          action: 'item_archive',
          detail: archived ? `В архив: ${item.name}` : `Из архива: ${item.name}`,
          itemId: id,
        })
        return next
      })
    },
    [patchWarehouse],
  )

  const removeWarehouseItem = useCallback(
    (id: string) => {
      patchWarehouse((w) => ({
        ...w,
        items: w.items.filter((i) => i.id !== id),
        movements: w.movements.filter((m) => m.itemId !== id),
      }))
    },
    [patchWarehouse],
  )

  const upsertWarehouseCategory = useCallback(
    (cat: WarehouseCategory) => {
      patchWarehouse((w) => {
        const exists = w.categories.some((c) => c.id === cat.id)
        return {
          ...w,
          categories: exists
            ? w.categories.map((c) => (c.id === cat.id ? cat : c))
            : [...w.categories, cat],
        }
      })
    },
    [patchWarehouse],
  )

  const upsertWarehouseLocation = useCallback(
    (loc: WarehouseLocation) => {
      patchWarehouse((w) => {
        const exists = w.locations.some((l) => l.id === loc.id)
        return {
          ...w,
          locations: exists
            ? w.locations.map((l) => (l.id === loc.id ? loc : l))
            : [...w.locations, loc],
        }
      })
    },
    [patchWarehouse],
  )

  const addStockMovement = useCallback(
    (movement: Omit<StockMovement, 'id' | 'createdAt'>) => {
      patchWarehouse((w) => {
        const item = w.items.find((i) => i.id === movement.itemId)
        const qty = item
          ? toBaseQty(item, movement.quantity, movement.inputUnit)
          : movement.quantity
        let next: WarehouseStore = {
          ...w,
          movements: [
            ...w.movements,
            {
              ...movement,
              quantity: qty,
              warehouseId:
                movement.warehouseId || item?.warehouseId || w.locations[0]?.id || '',
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        }
        next = appendWarehouseAudit(next, {
          action: 'movement_add',
          detail: `${movement.type} · ${item?.name ?? movement.itemId} · ${qty}`,
          itemId: movement.itemId,
        })
        return next
      })
    },
    [patchWarehouse],
  )

  const deleteStockMovement = useCallback(
    (id: string) => {
      patchWarehouse((w) => {
        const m = w.movements.find((x) => x.id === id)
        let next: WarehouseStore = {
          ...w,
          movements: w.movements.filter((x) => x.id !== id),
        }
        if (m) {
          next = appendWarehouseAudit(next, {
            action: 'movement_delete',
            detail: `Удалена операция ${m.type}`,
            itemId: m.itemId,
          })
        }
        return next
      })
    },
    [patchWarehouse],
  )

  const postWarehouseDoc = useCallback(
    (doc: Omit<WarehouseDocument, 'id' | 'createdAt'>) => {
      patchWarehouse((w) => postWarehouseDocument(w, doc))
    },
    [patchWarehouse],
  )

  const mergeWarehouseInvoiceRegistry = useCallback(
    (registry: import('@/lib/warehouse/types').GeorgianInvoice[]) => {
      patchWarehouse((w) => ({
        ...w,
        invoiceRegistry: mergeInvoiceRegistry(w.invoiceRegistry, registry),
      }))
    },
    [patchWarehouse],
  )

  const runWarehouseInventory = useCallback(
    (args: Parameters<typeof runInventoryCount>[1]) => {
      patchWarehouse((w) => runInventoryCount(w, args))
    },
    [patchWarehouse],
  )

  const importWarehouseExcel = useCallback(
    async (file: File, warehouseId?: string) => {
      const imported = await importWarehouseFromExcel(file, store.warehouse, warehouseId)
      if (imported.result.movementsAdded > 0) {
        setStore((s) => ({ ...s, warehouse: imported.store }))
      }
      return imported.result
    },
    [store.warehouse],
  )

  const setWarehouseStore = useCallback(
    (warehouse: WarehouseStore) => {
      setStore((s) => ({ ...s, warehouse }))
    },
    [],
  )

  const dismissLoadWarning = useCallback(() => setLoadWarning(undefined), [])
  const dismissSaveError = useCallback(() => setSaveError(null), [])

  return {
    store,
    loadWarning,
    dismissLoadWarning,
    saveError,
    dismissSaveError,
    view,
    setView,
    activeMonth,
    setActiveMonth,
    patch,
    upsertEmployee,
    removeEmployee,
    assignRowEmployee,
    addBrigadeRowToMonth,
    removeBrigadeRowFromMonth,
    removeEmptyBrigadeRowFromMonth,
    replaceEmployeeInBrigade,
    swapEmployeeRows,
    changeEmployeeScheduleFromDay,
    changeEmployeeAttributesFromDay,
    assignPermanentToBrigade,
    captureVoiceUndo,
    undoVoiceAction,
    setMarksRange,
    cycleMark,
    setCellComment: setCellCommentAction,
    setMark,
    bulkHolidayV,
    bulkCopyPlanToFact52,
    regenerateRowPlan,
    regenerateMonthPlan,
    replaceStore,
    resetStore,
    updateSettings,
    setLocale,
    addBrigade,
    renameBrigade,
    setBrigadeNameKa,
    removeBrigade,
    addMonth,
    removeMonth,
    archiveMonth,
    applyShiftTemplate,
    applyShiftTemplateBrigade,
    restoreTrashEmployee: (at: string) => setStore((s) => restoreTrashEmployee(s, at)),
    restoreTrashMonth: (at: string) => setStore((s) => restoreTrashMonth(s, at)),
    purgeTrashEmployee: (at: string) =>
      setStore((s) => permanentlyDeleteTrashEmployee(s, at)),
    purgeTrashMonth: (at: string) => setStore((s) => permanentlyDeleteTrashMonth(s, at)),
    upsertWarehouseItem,
    archiveWarehouseItem,
    removeWarehouseItem,
    upsertWarehouseCategory,
    upsertWarehouseLocation,
    addStockMovement,
    deleteStockMovement,
    postWarehouseDoc,
    mergeWarehouseInvoiceRegistry,
    runWarehouseInventory,
    importWarehouseExcel,
    setWarehouseStore,
  }
}
