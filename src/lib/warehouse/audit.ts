import type { WarehouseAuditEntry, WarehouseStore } from './types'

const MAX = 300

export function appendWarehouseAudit(
  store: WarehouseStore,
  entry: Omit<WarehouseAuditEntry, 'id' | 'at'>,
): WarehouseStore {
  const row: WarehouseAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  }
  return {
    ...store,
    auditLog: [...store.auditLog, row].slice(-MAX),
  }
}
