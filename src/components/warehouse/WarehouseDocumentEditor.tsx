import { useEffect, useMemo, useRef, useState } from 'react'
import { FormNotice } from '@/components/ui/FormNotice'
import { NomenclaturePicker } from '@/components/warehouse/NomenclaturePicker'
import { WarehousePickModal, type PickApplyRow } from '@/components/warehouse/WarehousePickModal'
import { useI18n } from '@/context/I18nContext'
import {
  buildReceiptPrintModel,
  type ReceiptPrintModel,
  type WarehousePrintMeta,
} from '@/lib/warehouse/printDocument'
import { WarehouseInvoiceLoader } from '@/components/warehouse/WarehouseInvoiceLoader'
import { WarehouseReceiptPrintPreview } from '@/components/warehouse/WarehouseReceiptPrintPreview'
import { suggestDocNumber } from '@/lib/warehouse/nomenclatureSearch'
import { formatQty, itemStockValue } from '@/lib/warehouse/stock'
import type { ItemBalance, WarehouseDocument, WarehouseStore } from '@/lib/warehouse/types'

export type DocLineRow = {
  key: string
  itemId: string | null
  quantity: string
}

type Props = {
  warehouse: WarehouseStore
  categoryNames: Map<string, string>
  balances: Map<string, ItemBalance>
  brigades: string[]
  warehouseId: string
  variant?: 'page' | 'modal'
  printMeta?: WarehousePrintMeta
  initialType?: 'receipt' | 'issue'
  initialPickSearch?: string
  initialPickOpen?: boolean
  onPost: (doc: Omit<WarehouseDocument, 'id' | 'createdAt'>) => void
  onMergeInvoiceRegistry: (registry: import('@/lib/warehouse/types').GeorgianInvoice[]) => void
  onCancel?: () => void
}

function newLine(): DocLineRow {
  return { key: crypto.randomUUID(), itemId: null, quantity: '' }
}

export function WarehouseDocumentEditor({
  warehouse,
  categoryNames,
  balances,
  brigades,
  warehouseId,
  variant = 'page',
  printMeta,
  initialType = 'receipt',
  initialPickSearch,
  initialPickOpen = false,
  onPost,
  onMergeInvoiceRegistry,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const whId = warehouseId || warehouse.locations[0]?.id || ''

  const [type, setType] = useState<'receipt' | 'issue'>(initialType)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [number, setNumber] = useState('')
  const [numberTouched, setNumberTouched] = useState(false)
  const [counterparty, setCounterparty] = useState('')
  const [brigade, setBrigade] = useState('')
  const [comment, setComment] = useState('')
  const [invoiceKey, setInvoiceKey] = useState<string | undefined>()
  const [sellerTin, setSellerTin] = useState<string | undefined>()
  const [lines, setLines] = useState<DocLineRow[]>(() => [newLine()])
  const [pickOpen, setPickOpen] = useState(initialPickOpen)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printPreview, setPrintPreview] = useState<ReceiptPrintModel | null>(null)

  const qtyRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const activeItems = useMemo(() => warehouse.items.filter((i) => i.active), [warehouse.items])

  useEffect(() => {
    if (initialPickOpen) setPickOpen(true)
  }, [initialPickOpen])

  useEffect(() => {
    if (numberTouched) return
    setNumber(suggestDocNumber(warehouse.documents, type, date))
  }, [type, date, warehouse.documents, numberTouched])

  function updateLine(key: string, patch: Partial<DocLineRow>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function pickItem(rowKey: string, itemId: string | null) {
    if (!itemId) {
      updateLine(rowKey, { itemId: null })
      return
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === itemId && l.key !== rowKey)
      if (existing) {
        return prev
          .filter((l) => l.key !== rowKey)
          .map((l) =>
            l.key === existing.key
              ? {
                  ...l,
                  quantity: l.quantity || '1',
                }
              : l,
          )
      }
      return prev.map((l) => (l.key === rowKey ? { ...l, itemId } : l))
    })
  }

  function mergePickedRows(rows: PickApplyRow[]) {
    setLines((prev) => {
      let next = prev.filter((l) => l.itemId)
      for (const row of rows) {
        const idx = next.findIndex((l) => l.itemId === row.itemId)
        if (idx >= 0) {
          const cur = Number(next[idx]!.quantity.replace(',', '.')) || 0
          next = next.map((l, i) =>
            i === idx ? { ...l, quantity: String(cur + row.quantity) } : l,
          )
        } else {
          next = [
            ...next,
            { key: crypto.randomUUID(), itemId: row.itemId, quantity: String(row.quantity) },
          ]
        }
      }
      return next.length ? next : [newLine()]
    })
  }

  function addLine(focus = true) {
    const row = newLine()
    setLines((prev) => [...prev, row])
    if (focus) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(`[data-line="${row.key}"] input`)
        el?.focus()
      })
    }
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((l) => l.key !== key)))
  }

  function focusQty(key: string) {
    qtyRefs.current.get(key)?.focus()
    qtyRefs.current.get(key)?.select()
  }

  function resetForm() {
    setCounterparty('')
    setBrigade('')
    setComment('')
    setInvoiceKey(undefined)
    setSellerTin(undefined)
    setLines([newLine()])
    setNumberTouched(false)
    setNumber(suggestDocNumber(warehouse.documents, type, date))
  }

  function handleInvoiceLoad(result: import('@/components/warehouse/WarehouseInvoiceLoader').InvoiceLoadResult) {
    setNumber(result.number)
    setNumberTouched(true)
    setDate(result.date)
    setCounterparty(result.counterparty)
    setInvoiceKey(result.invoiceKey)
    setSellerTin(result.sellerTin)
    setLines(
      result.lines.length
        ? result.lines.map((l) => ({
            key: crypto.randomUUID(),
            itemId: l.itemId,
            quantity: String(l.quantity),
          }))
        : [newLine()],
    )
    if (result.unmatched.length) {
      setComment((c) => {
        const note = `${t('warehouse.invoice.unmatchedNote')}: ${result.unmatched.join('; ')}`
        return c ? `${c}\n${note}` : note
      })
    }
  }

  function postDocument() {
    const parsed = lines
      .map((l) => ({
        itemId: l.itemId!,
        quantity: Number(l.quantity.replace(',', '.')),
      }))
      .filter((l) => l.itemId && l.quantity > 0)

    if (!number.trim() || !parsed.length) return

    onPost({
      type,
      number: number.trim(),
      date,
      warehouseId: whId,
      counterparty: counterparty.trim() || undefined,
      brigade: type === 'issue' && brigade ? brigade : undefined,
      comment: comment.trim() || undefined,
      invoiceKey: type === 'receipt' ? invoiceKey : undefined,
      sellerTin: type === 'receipt' ? sellerTin : undefined,
      lines: parsed,
    })
    resetForm()
  }

  function printDraft() {
    if (type !== 'receipt' || !printMeta) return
    const parsed = lines
      .map((l) => ({
        itemId: l.itemId!,
        quantity: Number(l.quantity.replace(',', '.')),
      }))
      .filter((l) => l.itemId && l.quantity > 0)

    if (!number.trim()) {
      setPrintError(t('warehouse.print.errNoNumber'))
      return
    }
    if (!parsed.length) {
      setPrintError(t('warehouse.print.errNoLines'))
      return
    }
    setPrintError(null)
    setPrintPreview(
      buildReceiptPrintModel(
        warehouse,
        {
          number: number.trim(),
          date,
          warehouseId: whId,
          counterparty: counterparty.trim() || undefined,
          comment: comment.trim() || undefined,
          lines: parsed,
        },
        printMeta,
      ),
    )
  }

  let totalSum = 0
  for (const line of lines) {
    if (!line.itemId) continue
    const item = activeItems.find((i) => i.id === line.itemId)
    const q = Number(line.quantity.replace(',', '.'))
    if (item && q > 0) totalSum += itemStockValue(item, q)
  }

  const shell = variant === 'modal' ? 'space-y-4' : 'rounded-xl border border-grid bg-white shadow-sm'

  return (
    <div className={shell}>
      <div className={`${variant === 'page' ? 'border-b border-grid px-4 py-3' : ''}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-grid p-0.5">
            {(['receipt', 'issue'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                  type === id
                    ? id === 'receipt'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
                onClick={() => setType(id)}
              >
                {id === 'receipt' ? t('warehouse.receipt') : t('warehouse.issue')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={() => setPickOpen(true)}
          >
            {t('warehouse.pick.button')}
          </button>
          <span className="text-xs text-stone-400">{t('warehouse.picker.hint')}</span>
        </div>
      </div>

      {type === 'receipt' && (
        <div className={variant === 'page' ? 'border-b border-grid px-4 py-3' : 'pb-2'}>
          <WarehouseInvoiceLoader
            warehouse={warehouse}
            items={activeItems}
            onLoad={handleInvoiceLoad}
            onRegistryUpdate={onMergeInvoiceRegistry}
          />
        </div>
      )}

      {printError && (
        <div className={variant === 'page' ? 'px-4' : ''}>
          <FormNotice type="error" message={printError} onDismiss={() => setPrintError(null)} />
        </div>
      )}

      <div className={`grid gap-3 ${variant === 'page' ? 'border-b border-grid px-4 py-3 sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
        <label className="block text-xs font-semibold text-stone-500">
          {t('warehouse.doc.number')}
          <input
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm font-medium"
            value={number}
            onChange={(e) => {
              setNumberTouched(true)
              setNumber(e.target.value)
            }}
          />
        </label>
        <label className="block text-xs font-semibold text-stone-500">
          {t('warehouse.date')}
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-stone-500">
          {t('warehouse.doc.counterparty')}
          <input
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </label>
        {type === 'issue' && brigades.length > 0 ? (
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.doc.brigade')}
            <select
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={brigade}
              onChange={(e) => setBrigade(e.target.value)}
            >
              <option value="">—</option>
              {brigades.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.comment')}
            <input
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        )}
      </div>

      {type === 'issue' && brigades.length > 0 && (
        <div className={variant === 'page' ? 'border-b border-grid px-4 pb-3' : ''}>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.comment')}
            <input
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className={variant === 'page' ? 'overflow-x-auto' : ''}>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-grid bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="w-10 px-2 py-2 text-center">№</th>
              <th className="min-w-[16rem] px-2 py-2">{t('warehouse.col.name')}</th>
              <th className="w-28 px-2 py-2">{t('warehouse.col.category')}</th>
              <th className="w-14 px-2 py-2">{t('warehouse.col.unit')}</th>
              <th className="w-24 px-2 py-2 text-right">{t('warehouse.col.available')}</th>
              <th className="w-28 px-2 py-2 text-right">{t('warehouse.quantity')}</th>
              <th className="w-24 px-2 py-2 text-right">{t('warehouse.col.sum')}</th>
              <th className="w-8 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const item = line.itemId
                ? activeItems.find((i) => i.id === line.itemId)
                : undefined
              const bal = line.itemId ? balances.get(line.itemId) : undefined
              const qty = Number(line.quantity.replace(',', '.'))
              const sum = item && qty > 0 ? itemStockValue(item, qty) : 0

              return (
                <tr key={line.key} className="border-b border-grid/60 align-top" data-line={line.key}>
                  <td className="px-2 py-2 text-center text-stone-400 tabular-nums">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <NomenclaturePicker
                      items={activeItems}
                      categoryNames={categoryNames}
                      balances={balances}
                      warehouseId={whId}
                      value={line.itemId}
                      autoFocus={idx === lines.length - 1 && !line.itemId}
                      onChange={(id) => pickItem(line.key, id)}
                      onConfirmQty={() => focusQty(line.key)}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-stone-500">
                    {item ? categoryNames.get(item.categoryId) ?? '—' : '—'}
                  </td>
                  <td className="px-2 py-2 text-stone-500">{item?.unit ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {item ? formatQty(bal?.available ?? 0) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      ref={(el) => {
                        if (el) qtyRefs.current.set(line.key, el)
                        else qtyRefs.current.delete(line.key)
                      }}
                      type="text"
                      inputMode="decimal"
                      disabled={!line.itemId}
                      className="w-full rounded border border-grid px-2 py-1.5 text-right text-sm tabular-nums disabled:bg-stone-50"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (idx === lines.length - 1) addLine(true)
                          else {
                            const next = lines[idx + 1]
                            if (next) {
                              document
                                .querySelector<HTMLInputElement>(`[data-line="${next.key}"] input`)
                                ?.focus()
                            }
                          }
                        }
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {sum ? `${formatQty(sum)} ₾` : '—'}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      type="button"
                      className="text-stone-400 hover:text-red-600"
                      title={t('warehouse.doc.removeLine')}
                      onClick={() => removeLine(line.key)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          variant === 'page' ? 'border-t border-grid px-4 py-3' : 'pt-2'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
            onClick={() => setPickOpen(true)}
          >
            {t('warehouse.pick.button')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-grid px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
            onClick={() => addLine(true)}
          >
            + {t('warehouse.doc.addLine')}
          </button>
          {totalSum > 0 && (
            <span className="self-center text-sm text-stone-500">
              {t('warehouse.doc.total')}: <strong className="tabular-nums">{formatQty(totalSum)} ₾</strong>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {type === 'receipt' && printMeta && (
            <button
              type="button"
              className="rounded-lg border border-grid px-4 py-2 text-sm font-medium hover:bg-stone-50"
              onClick={printDraft}
            >
              {t('warehouse.print.previewBtn')}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              className="rounded-lg border border-grid px-4 py-2 text-sm"
              onClick={onCancel}
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={postDocument}
          >
            {t('warehouse.doc.post')}
          </button>
        </div>
      </div>

      <WarehousePickModal
        open={pickOpen}
        items={activeItems}
        categories={warehouse.categories}
        categoryNames={categoryNames}
        balances={balances}
        warehouseId={whId}
        docType={type}
        initialSearch={initialPickSearch}
        onClose={() => setPickOpen(false)}
        onApply={mergePickedRows}
      />

      {printPreview && (
        <WarehouseReceiptPrintPreview
          model={printPreview}
          onClose={() => setPrintPreview(null)}
        />
      )}
    </div>
  )
}
