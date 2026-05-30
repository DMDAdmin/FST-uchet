import { appendWarehouseAudit } from './audit'
import { toBaseQty } from './stock'
import type { StockMovement, WarehouseDocument, WarehouseStore } from './types'

export function postWarehouseDocument(
  store: WarehouseStore,
  doc: Omit<WarehouseDocument, 'id' | 'createdAt'>,
): WarehouseStore {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const full: WarehouseDocument = { ...doc, id, createdAt }

  const itemMap = new Map(store.items.map((i) => [i.id, i]))
  const movements: StockMovement[] = full.lines.map((line) => {
    const item = itemMap.get(line.itemId)
    const qty = item
      ? toBaseQty(item, line.quantity, line.inputUnit)
      : line.quantity
    return {
      id: crypto.randomUUID(),
      itemId: line.itemId,
      warehouseId: full.warehouseId,
      type: full.type,
      quantity: qty,
      date: full.date,
      documentId: id,
      documentNo: full.number,
      brigade: full.brigade,
      comment: full.comment,
      inputUnit: line.inputUnit,
      createdAt,
    }
  })

  let next: WarehouseStore = {
    ...store,
    documents: [...store.documents, full],
    movements: [...store.movements, ...movements],
  }
  next = appendWarehouseAudit(next, {
    action: 'document_post',
    detail: `${full.type === 'receipt' ? 'Приход' : 'Расход'} №${full.number} · ${full.lines.length} поз.`,
  })
  return next
}

export function runInventoryCount(
  store: WarehouseStore,
  args: {
    itemId: string
    warehouseId: string
    counted: number
    date: string
    comment?: string
  },
): WarehouseStore {
  const { itemId, warehouseId, counted, date, comment } = args
  const item = store.items.find((i) => i.id === itemId)
  if (!item) return store

  let receipt = 0
  let issue = 0
  let adjustment = 0
  for (const m of store.movements) {
    if (m.itemId !== itemId || m.warehouseId !== warehouseId) continue
    if (m.type === 'receipt') receipt += Math.abs(m.quantity)
    else if (m.type === 'issue') issue += Math.abs(m.quantity)
    else if (m.type === 'adjustment' || m.type === 'inventory') adjustment += m.quantity
  }
  const current = receipt - issue + adjustment
  const delta = counted - current
  if (Math.abs(delta) < 1e-9) return store

  const movement: StockMovement = {
    id: crypto.randomUUID(),
    itemId,
    warehouseId,
    type: 'inventory',
    quantity: delta,
    date,
    comment: comment ?? `Инвентаризация: было ${current}, стало ${counted}`,
    createdAt: new Date().toISOString(),
  }

  let next: WarehouseStore = {
    ...store,
    movements: [...store.movements, movement],
  }
  next = appendWarehouseAudit(next, {
    action: 'inventory',
    detail: `${item.name}: ${current} → ${counted}`,
    itemId,
  })
  return next
}
