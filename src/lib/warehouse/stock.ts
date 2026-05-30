import type {
  ItemBalance,
  StockMovement,
  StockMovementType,
  TurnoverRow,
  WarehouseItem,
  WarehouseStore,
} from './types'

export function movementDelta(type: StockMovementType, quantity: number): number {
  const q = Math.abs(quantity)
  if (type === 'receipt') return q
  if (type === 'issue') return -q
  if (type === 'reserve') return 0
  if (type === 'unreserve') return 0
  return quantity
}

export function toBaseQty(item: WarehouseItem, qty: number, inputUnit?: string): number {
  if (!inputUnit || inputUnit === item.unit) return qty
  const conv = item.unitConversions?.find((c) => c.unit === inputUnit)
  return conv ? qty * conv.factor : qty
}

export function computeItemBalance(
  itemId: string,
  movements: StockMovement[],
  warehouseId?: string,
): ItemBalance {
  let receipt = 0
  let issue = 0
  let adjustment = 0
  let reserved = 0
  for (const m of movements) {
    if (m.itemId !== itemId) continue
    if (warehouseId && m.warehouseId !== warehouseId) continue
    if (m.type === 'receipt') receipt += Math.abs(m.quantity)
    else if (m.type === 'issue') issue += Math.abs(m.quantity)
    else if (m.type === 'adjustment' || m.type === 'inventory') adjustment += m.quantity
    else if (m.type === 'reserve') reserved += Math.abs(m.quantity)
    else if (m.type === 'unreserve') reserved -= Math.abs(m.quantity)
  }
  reserved = Math.max(0, reserved)
  const balance = receipt - issue + adjustment
  return {
    itemId,
    receipt,
    issue,
    adjustment,
    reserved,
    balance,
    available: balance - reserved,
  }
}

export function computeAllBalances(
  warehouse: WarehouseStore,
  warehouseId?: string,
): Map<string, ItemBalance> {
  const map = new Map<string, ItemBalance>()
  for (const item of warehouse.items) {
    map.set(item.id, computeItemBalance(item.id, warehouse.movements, warehouseId))
  }
  return map
}

export function lowStockItems(
  items: WarehouseItem[],
  balances: Map<string, ItemBalance>,
): WarehouseItem[] {
  return items.filter((item) => {
    if (!item.active || item.minStock == null) return false
    return (balances.get(item.id)?.available ?? 0) < item.minStock
  })
}

export function turnoverForPeriod(
  warehouse: WarehouseStore,
  from: string,
  to: string,
  warehouseId?: string,
): TurnoverRow[] {
  const map = new Map<string, TurnoverRow>()
  for (const m of warehouse.movements) {
    if (m.date < from || m.date > to) continue
    if (warehouseId && m.warehouseId !== warehouseId) continue
    if (m.type !== 'receipt' && m.type !== 'issue') continue
    const row = map.get(m.itemId) ?? { itemId: m.itemId, receipt: 0, issue: 0, net: 0 }
    if (m.type === 'receipt') row.receipt += Math.abs(m.quantity)
    else row.issue += Math.abs(m.quantity)
    row.net = row.receipt - row.issue
    map.set(m.itemId, row)
  }
  return [...map.values()].sort((a, b) => b.issue - a.issue)
}

export function itemStockValue(item: WarehouseItem, balance: number): number {
  if (!item.price) return 0
  return balance * item.price
}

export function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2).replace(/\.?0+$/, '')
}

export function findItemBySkuOrBarcode(
  items: WarehouseItem[],
  query: string,
): WarehouseItem | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return items.find(
    (i) =>
      i.active &&
      (i.sku?.toLowerCase() === q ||
        i.barcode?.toLowerCase() === q ||
        i.name.toLowerCase().includes(q)),
  )
}
