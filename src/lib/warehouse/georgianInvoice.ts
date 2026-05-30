import type { GeorgianInvoice, GeorgianInvoiceLine } from './types'

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Нормализованный ключ для поиска: SERIE/NUMBER или NUMBER */
export function normalizeInvoiceKey(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '').toUpperCase()
  if (!s) return ''
  return s.replace(/[\\-–—]/g, '/')
}

export function invoiceDisplayNumber(inv: Pick<GeorgianInvoice, 'serie' | 'number'>): string {
  if (inv.serie && !inv.number.includes('/')) {
    return `${inv.serie}/${inv.number}`
  }
  return inv.number
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return ''
}

function parseGoodsLine(raw: Record<string, unknown>): GeorgianInvoiceLine | null {
  const name = pickString(raw, [
    'goods_name',
    'goodsName',
    'name',
    'product_name',
    'productName',
    'description',
    'W_NAME',
    'item_name',
  ])
  if (!name) return null
  const quantity = parseNumber(raw.quantity ?? raw.qty ?? raw.amount_qty ?? raw.goods_quantity)
  if (quantity <= 0) return null
  const unitPrice = parseNumber(raw.unit_price ?? raw.unitPrice ?? raw.price ?? raw.goods_unit_price)
  const amount = parseNumber(raw.amount ?? raw.total ?? raw.goods_amount)
  return {
    name,
    quantity,
    unit: pickString(raw, ['unit', 'unit_name', 'unitName', 'goods_unit']) || undefined,
    unitPrice: unitPrice > 0 ? unitPrice : undefined,
    amount: amount > 0 ? amount : undefined,
    barcode: pickString(raw, ['bar_code', 'barcode', 'barCode']) || undefined,
  }
}

function buildInvoice(
  raw: Record<string, unknown>,
  source: GeorgianInvoice['source'],
): GeorgianInvoice | null {
  const serie = pickString(raw, ['inv_serie', 'invSerie', 'serie', 'series', 'invoice_serie'])
  const number = pickString(raw, [
    'inv_number',
    'invNumber',
    'number',
    'invoice_number',
    'invoiceNumber',
    'factura_number',
  ])
  const combined = pickString(raw, ['invoice_no', 'invoiceNo', 'document_number'])
  let num = number || combined
  if (!num && serie) return null
  if (!num) return null

  if (!number && combined.includes('/')) {
    const [s, n] = combined.split('/')
    if (s && n) {
      return buildInvoice(
        { ...raw, inv_serie: s.trim(), inv_number: n.trim() },
        source,
      )
    }
  }

  const goodsRaw =
    (raw.invoice_goods as unknown[]) ??
    (raw.invoiceGoods as unknown[]) ??
    (raw.goods as unknown[]) ??
    (raw.lines as unknown[]) ??
    (raw.items as unknown[]) ??
    []

  const lines: GeorgianInvoiceLine[] = []
  for (const g of goodsRaw) {
    if (!g || typeof g !== 'object') continue
    const line = parseGoodsLine(g as Record<string, unknown>)
    if (line) lines.push(line)
  }
  if (!lines.length) return null

  const displayNum = serie && !num.includes('/') ? `${serie}/${num}` : num
  const key = normalizeInvoiceKey(displayNum)

  return {
    id: crypto.randomUUID(),
    key,
    number: num,
    serie: serie || undefined,
    date: pickString(raw, [
      'operation_date',
      'operationDate',
      'date',
      'invoice_date',
      'create_date',
    ]).slice(0, 10) || undefined,
    sellerName: pickString(raw, ['seller_name', 'sellerName', 'supplier', 'vendor_name']) || undefined,
    sellerTin: pickString(raw, ['seller_tin', 'sellerTin', 'seller_un_id', 'supplier_tin']) || undefined,
    buyerTin: pickString(raw, ['buyer_tin', 'buyerTin', 'buyer_un_id']) || undefined,
    amount:
      parseNumber(raw.amount_full ?? raw.amountFull ?? raw.total_amount ?? raw.total) || undefined,
    lines,
    importedAt: new Date().toISOString(),
    source,
  }
}

export function parseInvoicesFromJson(text: string): GeorgianInvoice[] {
  const data = JSON.parse(text) as unknown
  const list = Array.isArray(data) ? data : [data]
  const out: GeorgianInvoice[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const inv = buildInvoice(item as Record<string, unknown>, 'json')
    if (inv) out.push(inv)
  }
  return out
}

function xmlText(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

function parseInvoicesFromXmlDoc(doc: Document): GeorgianInvoice[] {
  const out: GeorgianInvoice[] = []

  const invoiceNodes = [
    ...doc.querySelectorAll('Invoice, invoice, INVOICE, Factura, factura'),
  ]
  if (invoiceNodes.length) {
    for (const node of invoiceNodes) {
      const raw: Record<string, unknown> = {
        inv_serie: xmlText(node.querySelector('InvSerie, inv_serie, Serie, serie')),
        inv_number: xmlText(node.querySelector('InvNumber, inv_number, Number, number')),
        operation_date: xmlText(node.querySelector('OperationDate, operation_date, Date, date')),
        seller_name: xmlText(node.querySelector('SellerName, seller_name, Supplier')),
        seller_tin: xmlText(node.querySelector('SellerTin, seller_tin, SellerUnId')),
        amount_full: xmlText(node.querySelector('AmountFull, amount_full, Total')),
      }
      const goodsNodes = [
        ...node.querySelectorAll('Goods, goods, InvoiceGoods, invoice_goods, Item, item, Line'),
      ]
      raw.invoice_goods = goodsNodes.map((g) => ({
        goods_name: xmlText(
          g.querySelector('GoodsName, goods_name, Name, name, W_NAME, Description'),
        ),
        quantity: xmlText(g.querySelector('Quantity, quantity, Qty, qty')),
        unit_price: xmlText(g.querySelector('UnitPrice, unit_price, Price, price')),
        unit: xmlText(g.querySelector('Unit, unit, UnitName')),
        bar_code: xmlText(g.querySelector('BarCode, bar_code, Barcode')),
        amount: xmlText(g.querySelector('Amount, amount, Total')),
      }))
      const inv = buildInvoice(raw, 'xml')
      if (inv) out.push(inv)
    }
    return out
  }

  // Один инвойс — корневой документ
  const root = doc.documentElement
  if (root) {
    const raw: Record<string, unknown> = {
      inv_serie: xmlText(root.querySelector('InvSerie, inv_serie, Serie')),
      inv_number: xmlText(root.querySelector('InvNumber, inv_number, Number')),
      operation_date: xmlText(root.querySelector('OperationDate, operation_date, Date')),
      seller_name: xmlText(root.querySelector('SellerName, seller_name')),
      seller_tin: xmlText(root.querySelector('SellerTin, seller_tin')),
    }
    const goodsNodes = [
      ...root.querySelectorAll('Goods, goods, InvoiceGoods, Item, Line, ROW'),
    ]
    if (goodsNodes.length) {
      raw.invoice_goods = goodsNodes.map((g) => ({
        goods_name: xmlText(g.querySelector('GoodsName, goods_name, Name, W_NAME')),
        quantity: xmlText(g.querySelector('Quantity, quantity')),
        unit_price: xmlText(g.querySelector('UnitPrice, unit_price, Price')),
      }))
      const inv = buildInvoice(raw, 'xml')
      if (inv) out.push(inv)
    }
  }

  return out
}

export function parseInvoicesFromXml(text: string): GeorgianInvoice[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('xmlParse')
  }
  return parseInvoicesFromXmlDoc(doc)
}

export function parseInvoiceFile(text: string, filename: string): GeorgianInvoice[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xml')) return parseInvoicesFromXml(text)
  return parseInvoicesFromJson(text)
}

export function findInvoiceByKey(
  registry: GeorgianInvoice[],
  query: string,
): GeorgianInvoice | undefined {
  const key = normalizeInvoiceKey(query)
  if (!key) return undefined
  return registry.find((inv) => inv.key === key || normalizeInvoiceKey(invoiceDisplayNumber(inv)) === key)
}

export function mergeInvoiceRegistry(
  registry: GeorgianInvoice[],
  incoming: GeorgianInvoice[],
): GeorgianInvoice[] {
  const map = new Map(registry.map((inv) => [inv.key, inv]))
  for (const inv of incoming) {
    map.set(inv.key, { ...inv, id: map.get(inv.key)?.id ?? inv.id })
  }
  return [...map.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

export function findItemByInvoiceLine(
  items: { id: string; name: string; sku?: string; barcode?: string; active: boolean }[],
  line: GeorgianInvoiceLine,
): string | null {
  const active = items.filter((i) => i.active)
  if (line.barcode) {
    const byBarcode = active.find((i) => i.barcode?.toLowerCase() === line.barcode!.toLowerCase())
    if (byBarcode) return byBarcode.id
  }
  const n = normName(line.name)
  const exact = active.find((i) => normName(i.name) === n)
  if (exact) return exact.id
  const partial = active.find(
    (i) => normName(i.name).includes(n) || n.includes(normName(i.name)),
  )
  return partial?.id ?? null
}

export type InvoiceApplyResult = {
  matched: { itemId: string; quantity: number; name: string }[]
  unmatched: GeorgianInvoiceLine[]
}

export function applyInvoiceToItems(
  invoice: GeorgianInvoice,
  items: { id: string; name: string; sku?: string; barcode?: string; active: boolean; price?: number }[],
): InvoiceApplyResult {
  const matched: InvoiceApplyResult['matched'] = []
  const unmatched: GeorgianInvoiceLine[] = []

  for (const line of invoice.lines) {
    const itemId = findItemByInvoiceLine(items, line)
    if (itemId) {
      matched.push({ itemId, quantity: line.quantity, name: line.name })
    } else {
      unmatched.push(line)
    }
  }

  return { matched, unmatched }
}
