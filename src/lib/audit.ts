import type { AppStore, AuditEntry, DayCode } from './types'
import { MAX_AUDIT_ENTRIES } from './types'

export function appendAudit(
  store: AppStore,
  entry: Omit<AuditEntry, 'id' | 'at'>,
): AppStore {
  const full: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  }
  const auditLog = [full, ...store.auditLog].slice(0, MAX_AUDIT_ENTRIES)
  return { ...store, auditLog }
}

export function auditFactChange(
  store: AppStore,
  month: string,
  rowId: string,
  dateKey: string,
  employeeId: string | undefined,
  oldCode: DayCode,
  newCode: DayCode,
): AppStore {
  if (oldCode === newCode) return store
  return appendAudit(store, {
    action: 'fact_change',
    month,
    rowId,
    dateKey,
    employeeId,
    oldValue: oldCode || '·',
    newValue: newCode || '·',
    detail: `${dateKey}: ${oldCode || '·'} → ${newCode || '·'}`,
  })
}
