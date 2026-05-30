import { useMemo, useState } from 'react'
import { FormNotice } from '@/components/ui/FormNotice'
import { WarehouseDocumentEditor } from '@/components/warehouse/WarehouseDocumentEditor'
import { NomenclaturePicker } from '@/components/warehouse/NomenclaturePicker'
import { useI18n } from '@/context/I18nContext'
import { formatQty } from '@/lib/warehouse/stock'
import type { ItemBalance, StockMovementType } from '@/lib/warehouse/types'
import type { WarehousePageProps } from './warehouseTypes'

type Props = Pick<
  WarehousePageProps,
  | 'warehouse'
  | 'brigades'
  | 'onPostDocument'
  | 'onMergeInvoiceRegistry'
  | 'onAddMovement'
  | 'onDeleteMovement'
  | 'printMeta'
> & {
  warehouseId: string
  categoryNames: Map<string, string>
  balances: Map<string, ItemBalance>
}

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const { t } = useI18n()
  const styles: Record<string, string> = {
    receipt: 'bg-emerald-100 text-emerald-800',
    issue: 'bg-red-100 text-red-800',
    adjustment: 'bg-stone-200 text-stone-700',
    reserve: 'bg-amber-100 text-amber-800',
    unreserve: 'bg-sky-100 text-sky-800',
    inventory: 'bg-violet-100 text-violet-800',
  }
  const labels: Record<string, string> = {
    receipt: t('warehouse.receiptShort'),
    issue: t('warehouse.issueShort'),
    adjustment: t('warehouse.adjustmentShort'),
    reserve: t('warehouse.reserveShort'),
    unreserve: t('warehouse.unreserveShort'),
    inventory: t('warehouse.inventoryShort'),
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${styles[type] ?? ''}`}>
      {labels[type] ?? type}
    </span>
  )
}

export function WarehouseMovementsTab({
  warehouse,
  warehouseId,
  brigades,
  categoryNames,
  balances,
  printMeta,
  onPostDocument,
  onMergeInvoiceRegistry,
  onAddMovement,
  onDeleteMovement,
}: Props) {
  const { t } = useI18n()
  const whId = warehouseId || warehouse.locations[0]?.id || ''
  const [mode, setMode] = useState<'document' | 'other'>('document')

  const [itemId, setItemId] = useState<string | null>(null)
  const [opType, setOpType] = useState<StockMovementType>('adjustment')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const itemMap = useMemo(() => new Map(warehouse.items.map((i) => [i.id, i])), [warehouse.items])
  const activeItems = useMemo(() => warehouse.items.filter((i) => i.active), [warehouse.items])

  const recent = useMemo(
    () =>
      [...warehouse.movements]
        .filter((m) => !warehouseId || m.warehouseId === warehouseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40),
    [warehouse.movements, warehouseId],
  )

  function submitOther(e: React.FormEvent) {
    e.preventDefault()
    if (!itemId) {
      setFormError(t('warehouse.err.itemRequired'))
      return
    }
    const quantity = Number(qty.replace(',', '.'))
    if (!qty.trim() || Number.isNaN(quantity) || quantity <= 0) {
      setFormError(t('warehouse.err.qtyInvalid'))
      return
    }
    setFormError(null)
    onAddMovement({
      itemId,
      warehouseId: whId,
      type: opType,
      quantity,
      date,
      comment: comment || undefined,
    })
    setQty('')
    setComment('')
    setItemId(null)
  }

  const otherTypes: StockMovementType[] = ['adjustment', 'reserve', 'unreserve']

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_minmax(18rem,24rem)]">
      <div className="space-y-4 min-w-0">
        <div className="flex rounded-lg border border-grid bg-white p-1 shadow-sm w-fit">
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'document' ? 'bg-teal-700 text-white' : 'text-stone-600 hover:bg-stone-50'
            }`}
            onClick={() => setMode('document')}
          >
            {t('warehouse.doc.modeDocument')}
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'other' ? 'bg-teal-700 text-white' : 'text-stone-600 hover:bg-stone-50'
            }`}
            onClick={() => setMode('other')}
          >
            {t('warehouse.doc.modeOther')}
          </button>
        </div>

        {mode === 'document' ? (
          <WarehouseDocumentEditor
            warehouse={warehouse}
            categoryNames={categoryNames}
            balances={balances}
            brigades={brigades}
            warehouseId={whId}
            variant="page"
            printMeta={printMeta}
            onPost={onPostDocument}
            onMergeInvoiceRegistry={onMergeInvoiceRegistry}
          />
        ) : (
          <form
            onSubmit={submitOther}
            className="space-y-4 rounded-xl border border-grid bg-white p-5 shadow-sm"
          >
            <h3 className="font-bold text-ink">{t('warehouse.doc.modeOther')}</h3>
            {formError && (
              <FormNotice type="error" message={formError} onDismiss={() => setFormError(null)} />
            )}
            <div className="flex flex-wrap gap-2">
              {otherTypes.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    opType === id ? 'border-teal-700 bg-teal-700 text-white' : 'border-grid'
                  }`}
                  onClick={() => setOpType(id)}
                >
                  {id === 'adjustment'
                    ? t('warehouse.adjustment')
                    : id === 'reserve'
                      ? t('warehouse.reserve')
                      : t('warehouse.unreserve')}
                </button>
              ))}
            </div>
            <label className="block text-xs font-semibold text-stone-500">
              {t('warehouse.col.name')}
              <div className="mt-1">
                <NomenclaturePicker
                  items={activeItems}
                  categoryNames={categoryNames}
                  balances={balances}
                  warehouseId={whId}
                  value={itemId}
                  onChange={setItemId}
                />
              </div>
            </label>
            <label className="block text-xs font-semibold text-stone-500">
              {t('warehouse.quantity')}
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
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
              {t('warehouse.comment')}
              <input
                className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t('warehouse.saveMovement')}
            </button>
          </form>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-grid bg-white shadow-sm xl:max-h-[calc(100vh-12rem)]">
        <div className="border-b border-grid px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t('warehouse.journal')}
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">{t('warehouse.noMovements')}</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto xl:max-h-none">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-2 py-2 text-left">{t('warehouse.date')}</th>
                  <th className="px-2 py-2 text-left">{t('warehouse.col.name')}</th>
                  <th className="px-2 py-2">{t('warehouse.type')}</th>
                  <th className="px-2 py-2 text-right">{t('warehouse.quantity')}</th>
                  <th className="px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => {
                  const item = itemMap.get(m.itemId)
                  return (
                    <tr key={m.id} className="border-t border-grid/60">
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-stone-600">{m.date}</td>
                      <td className="max-w-[8rem] truncate px-2 py-2 text-xs" title={item?.name}>
                        {item?.name ?? '—'}
                        {m.documentNo && (
                          <span className="block text-[10px] text-stone-400">№ {m.documentNo}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <MovementTypeBadge type={m.type} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs font-medium">
                        {formatQty(Math.abs(m.quantity))}
                      </td>
                      <td className="px-1 py-2 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (confirm(t('warehouse.confirmDeleteMovement'))) onDeleteMovement(m.id)
                          }}
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
        )}
      </div>
    </div>
  )
}
