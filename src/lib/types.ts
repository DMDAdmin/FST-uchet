export type DayCode = '8' | '11' | 'Н' | '22' | 'В' | 'ОТ' | 'Б' | 'X' | 'ПР' | ''

import type { WarehouseStore } from './warehouse/types'

export type {
  WarehouseCategory,
  WarehouseItem,
  StockMovement,
  StockMovementType,
  ItemBalance,
  WarehouseStore,
  WarehouseLocation,
  WarehouseDocument,
  WarehouseAuditEntry,
  UnitConversion,
  TurnoverRow,
} from './warehouse/types'

export type ScheduleType = '5/2 8ч' | '2/2 11ч'

export type Group2x2 = 'А' | 'Б' | ''

export type ShiftMode = 'day' | 'night'

export type Locale = 'ru' | 'ka'

export type EmploymentStatus = 'active' | 'vacation' | 'maternity' | 'terminated'

export type Employee = {
  id: string
  fullName: string
  tabNumber: string
  position: string
  brigade: string
  schedule: ScheduleType
  group2x2: Group2x2
  cycleStart: string
  active: boolean
  hourlyRate?: number
  monthlySalary?: number
  shiftMode?: ShiftMode
  note?: string
  nameKa?: string
  positionKa?: string
  employmentStatus?: EmploymentStatus
  /** Дата окончания отпуска/декрета (YYYY-MM-DD) */
  statusUntil?: string
  /** Миниатюра фото (data URL) */
  photoDataUrl?: string
}

export type TimesheetRow = {
  id: string
  brigade: string
  employeeId: string | null
  sortOrder: number
}

export type MonthSheet = {
  month: string
  rows: TimesheetRow[]
  plan: Record<string, Record<string, DayCode>>
  fact: Record<string, Record<string, DayCode>>
  factOverrides: string[]
  /** rowId|YYYY-MM-DD → комментарий */
  comments: Record<string, string>
}

export type AuditEntry = {
  id: string
  at: string
  action: 'fact_change' | 'plan_change' | 'comment' | 'employee_remove' | 'month_remove' | 'bulk'
  month?: string
  employeeId?: string
  rowId?: string
  dateKey?: string
  detail: string
  oldValue?: string
  newValue?: string
}

export type TrashEmployee = { employee: Employee; deletedAt: string }
export type TrashMonth = { sheet: MonthSheet; deletedAt: string }

export type ShiftTemplate = {
  id: string
  name: string
  schedule: ScheduleType
  group2x2?: Group2x2
  shiftMode?: ShiftMode
  cycleStart?: string
}

export type PrintSignatures = {
  masterRu?: string
  masterKa?: string
  accountantRu?: string
  accountantKa?: string
  directorRu?: string
  directorKa?: string
}

import type { AiProviderId } from '@/lib/ai/providers'

export type AiSettings = {
  /** off | openai | kimi | custom */
  provider?: AiProviderId
  enabled?: boolean
  apiKey?: string
  /** OpenAI-compatible endpoint, напр. https://api.openai.com/v1 */
  baseUrl?: string
  model?: string
}

export type AppStore = {
  version: 6
  brigades: string[]
  /** Грузинское название бригады (ключ — русское имя) */
  brigadeNamesKa: Record<string, string>
  archivedMonths: string[]
  employees: Employee[]
  months: Record<string, MonthSheet>
  auditLog: AuditEntry[]
  trash: { employees: TrashEmployee[]; months: TrashMonth[] }
  shiftTemplates: ShiftTemplate[]
  warehouse: WarehouseStore
  settings: {
    responsible: string
    site: string
    accountantPassword: string
    locale: Locale
    tourCompleted?: boolean
    lastBackupDate?: string
    passwordChanged?: boolean
    signatures?: PrintSignatures
    ai?: AiSettings
  }
}

export const STORAGE_KEY = 'fibercell-tabel-v6'
export const TRASH_RETENTION_DAYS = 7
export const MAX_AUDIT_ENTRIES = 500

export type ViewId =
  | 'month'
  | 'employees'
  | 'summary'
  | 'pay'
  | 'codes'
  | 'warehouse'
  | 'settings'

export function commentKey(rowId: string, dateKey: string): string {
  return `${rowId}|${dateKey}`
}
