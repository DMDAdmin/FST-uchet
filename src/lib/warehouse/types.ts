export type StockMovementType =
  | 'receipt'
  | 'issue'
  | 'adjustment'
  | 'reserve'
  | 'unreserve'
  | 'inventory'

export type WarehouseLocation = {
  id: string
  name: string
  sortOrder: number
}

export type WarehouseCategory = {
  id: string
  name: string
  sortOrder: number
}

export type UnitConversion = {
  unit: string
  /** 1 alt unit = factor base units */
  factor: number
}

export type WarehouseItem = {
  id: string
  name: string
  categoryId: string
  warehouseId: string
  unit: string
  sku?: string
  barcode?: string
  price?: number
  minStock?: number
  note?: string
  unitConversions?: UnitConversion[]
  active: boolean
  sortOrder: number
}

export type StockMovement = {
  id: string
  itemId: string
  warehouseId: string
  type: StockMovementType
  quantity: number
  date: string
  documentId?: string
  documentNo?: string
  brigade?: string
  comment?: string
  /** if entered in alternate unit */
  inputUnit?: string
  createdAt: string
}

export type WarehouseDocumentLine = {
  itemId: string
  quantity: number
  inputUnit?: string
}

export type WarehouseDocument = {
  id: string
  type: 'receipt' | 'issue'
  number: string
  date: string
  warehouseId: string
  counterparty?: string
  brigade?: string
  comment?: string
  /** Ключ инвойса RS.ge (серия/номер) */
  invoiceKey?: string
  sellerTin?: string
  lines: WarehouseDocumentLine[]
  createdAt: string
}

/** Строка инвойса RS.ge / eAPI */
export type GeorgianInvoiceLine = {
  name: string
  quantity: number
  unit?: string
  unitPrice?: number
  amount?: number
  barcode?: string
}

/** Импортированный инвойс — локальный реестр для подстановки в приход */
export type GeorgianInvoice = {
  id: string
  /** Нормализованный ключ для поиска (SERIE/NUMBER) */
  key: string
  number: string
  serie?: string
  date?: string
  sellerName?: string
  sellerTin?: string
  buyerTin?: string
  amount?: number
  lines: GeorgianInvoiceLine[]
  importedAt: string
  source: 'json' | 'xml' | 'excel'
}

export type WarehouseAuditEntry = {
  id: string
  at: string
  action:
    | 'item_change'
    | 'item_archive'
    | 'movement_add'
    | 'movement_delete'
    | 'document_post'
    | 'inventory'
    | 'import'
  detail: string
  itemId?: string
}

export type WarehouseStore = {
  locations: WarehouseLocation[]
  categories: WarehouseCategory[]
  items: WarehouseItem[]
  movements: StockMovement[]
  documents: WarehouseDocument[]
  /** Реестр инвойсов RS.ge (импорт JSON/XML) */
  invoiceRegistry: GeorgianInvoice[]
  auditLog: WarehouseAuditEntry[]
}

export type ItemBalance = {
  itemId: string
  receipt: number
  issue: number
  adjustment: number
  reserved: number
  balance: number
  available: number
}

export type TurnoverRow = {
  itemId: string
  receipt: number
  issue: number
  net: number
}
