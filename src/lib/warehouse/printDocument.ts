import type { Locale, PrintSignatures } from '@/lib/types'
import { itemStockValue, toBaseQty } from '@/lib/warehouse/stock'
import type { WarehouseDocument, WarehouseStore } from '@/lib/warehouse/types'

export type WarehousePrintMeta = {
  site: string
  responsible?: string
  signatures?: PrintSignatures
  locale?: Locale
}

export type ReceiptPrintDoc = Pick<
  WarehouseDocument,
  'number' | 'date' | 'warehouseId' | 'counterparty' | 'comment' | 'lines'
>

export type ReceiptPrintLine = {
  idx: number
  name: string
  sku?: string
  category: string
  unit: string
  qty: number
  price: number
  sum: number
}

export type ReceiptPrintModel = {
  locale: Locale
  number: string
  dateFormatted: string
  warehouseName: string
  counterparty: string
  comment?: string
  orgLine: string
  lines: ReceiptPrintLine[]
  lineCount: number
  totalQty: number
  totalSum: number
  receivedBy: string
  accountant: string
  generatedAt: string
}

function formatPrintDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

export function formatReceiptMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function signatureName(
  signatures: PrintSignatures | undefined,
  role: 'master' | 'accountant' | 'director',
  locale: Locale,
): string {
  if (!signatures) return ''
  const ka = locale === 'ka'
  if (role === 'master') return (ka ? signatures.masterKa : signatures.masterRu) ?? ''
  if (role === 'accountant') return (ka ? signatures.accountantKa : signatures.accountantRu) ?? ''
  return (ka ? signatures.directorKa : signatures.directorRu) ?? ''
}

export function buildReceiptPrintModel(
  store: WarehouseStore,
  doc: ReceiptPrintDoc,
  meta: WarehousePrintMeta,
): ReceiptPrintModel {
  const locale = meta.locale ?? 'ru'
  const itemMap = new Map(store.items.map((i) => [i.id, i]))
  const catMap = new Map(store.categories.map((c) => [c.id, c.name]))
  const whName =
    store.locations.find((l) => l.id === doc.warehouseId)?.name ?? doc.warehouseId

  const lines: ReceiptPrintLine[] = []
  let totalSum = 0
  let totalQty = 0

  doc.lines.forEach((line, idx) => {
    const item = itemMap.get(line.itemId)
    if (!item) return
    const qty = toBaseQty(item, line.quantity, line.inputUnit)
    const price = item.price ?? 0
    const sum = itemStockValue(item, qty)
    totalSum += sum
    totalQty += qty
    lines.push({
      idx: idx + 1,
      name: item.name,
      sku: item.sku,
      category: catMap.get(item.categoryId) ?? '',
      unit: item.unit,
      qty,
      price,
      sum,
    })
  })

  const master = signatureName(meta.signatures, 'master', locale)
  const accountant = signatureName(meta.signatures, 'accountant', locale)
  const director = signatureName(meta.signatures, 'director', locale)

  return {
    locale,
    number: doc.number,
    dateFormatted: formatPrintDate(doc.date),
    warehouseName: whName,
    counterparty: doc.counterparty ?? '—',
    comment: doc.comment,
    orgLine: [meta.site, meta.responsible].filter(Boolean).join(' · ') || '—',
    lines,
    lineCount: lines.length,
    totalQty,
    totalSum,
    receivedBy: master,
    accountant: accountant || director,
    generatedAt: new Date().toLocaleString(locale === 'ka' ? 'ka-GE' : 'ru-RU'),
  }
}

export function buildReceiptPrintModelFromDocument(
  store: WarehouseStore,
  doc: WarehouseDocument,
  meta: WarehousePrintMeta,
): ReceiptPrintModel | null {
  if (doc.type !== 'receipt') return null
  return buildReceiptPrintModel(store, doc, meta)
}
