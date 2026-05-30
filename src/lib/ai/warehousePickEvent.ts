export const WAREHOUSE_PICK_EVENT = 'fibercell:warehouse-pick'

export type WarehousePickDetail = {
  query: string
  type?: 'receipt' | 'issue'
  quantity?: number
}

const STORAGE_KEY = 'fibercell-pending-pick'

export function dispatchWarehousePick(detail: WarehousePickDetail): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail))
  } catch {
    // ignore quota errors
  }
  window.dispatchEvent(new CustomEvent(WAREHOUSE_PICK_EVENT, { detail }))
}

export function consumePendingWarehousePick(): WarehousePickDetail | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return JSON.parse(raw) as WarehousePickDetail
  } catch {
    return null
  }
}
