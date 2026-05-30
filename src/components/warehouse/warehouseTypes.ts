import type { Locale, PrintSignatures } from '@/lib/types'
import type { WarehouseStore } from '@/lib/warehouse/types'
import type { ImportResult } from '@/lib/warehouse/importExport'
import type {
  StockMovement,
  WarehouseCategory,
  WarehouseDocument,
  WarehouseItem,
  WarehouseLocation,
} from '@/lib/warehouse/types'

export type WarehousePageProps = {
  warehouse: WarehouseStore
  brigades: string[]
  printMeta?: {
    site: string
    responsible?: string
    signatures?: PrintSignatures
    locale: Locale
  }
  onUpsertItem: (item: WarehouseItem) => void
  onArchiveItem: (id: string, archived: boolean) => void
  onRemoveItem: (id: string) => void
  onUpsertCategory: (cat: WarehouseCategory) => void
  onUpsertLocation: (loc: WarehouseLocation) => void
  onAddMovement: (movement: Omit<StockMovement, 'id' | 'createdAt'>) => void
  onDeleteMovement: (id: string) => void
  onPostDocument: (doc: Omit<WarehouseDocument, 'id' | 'createdAt'>) => void
  onMergeInvoiceRegistry: (registry: import('@/lib/warehouse/types').GeorgianInvoice[]) => void
  onRunInventory: (args: {
    itemId: string
    warehouseId: string
    counted: number
    date: string
    comment?: string
  }) => void
  onImportExcel: (file: File, warehouseId?: string) => Promise<ImportResult>
  onExportExcel: (warehouseId?: string) => void
}

export type WarehouseTab =
  | 'balances'
  | 'nomenclature'
  | 'movements'
  | 'documents'
  | 'inventory'
  | 'analytics'
  | 'import'
  | 'audit'

export const WAREHOUSE_TABS: WarehouseTab[] = [
  'balances',
  'nomenclature',
  'movements',
  'documents',
  'inventory',
  'analytics',
  'import',
  'audit',
]

export const UNITS = ['шт', 'кг', 'л', 'м', 'рул', 'уп', 'компл', 'т', 'м²', 'м³']
