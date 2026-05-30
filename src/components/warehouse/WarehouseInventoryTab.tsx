import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { computeAllBalances, formatQty } from '@/lib/warehouse/stock'
import type { WarehousePageProps } from './warehouseTypes'

type Props = Pick<WarehousePageProps, 'warehouse' | 'onRunInventory'> & {
  warehouseId: string
}

export function WarehouseInventoryTab({ warehouse, warehouseId, onRunInventory }: Props) {
  const { t } = useI18n()
  const whId = warehouseId || warehouse.locations[0]?.id || ''
  const balances = useMemo(
    () => computeAllBalances(warehouse, whId || undefined),
    [warehouse, whId],
  )
  const [itemId, setItemId] = useState(warehouse.items.find((i) => i.active)?.id ?? '')
  const [counted, setCounted] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [comment, setComment] = useState('')

  const item = warehouse.items.find((i) => i.id === itemId)
  const current = balances.get(itemId)?.balance ?? 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(counted.replace(',', '.'))
    if (!itemId || Number.isNaN(n) || n < 0) return
    onRunInventory({ itemId, warehouseId: whId, counted: n, date, comment: comment || undefined })
    setCounted('')
    setComment('')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form
        onSubmit={submit}
        className="rounded-xl border border-grid bg-white p-5 shadow-sm space-y-4"
      >
        <h3 className="font-bold text-ink">{t('warehouse.inventory.title')}</h3>
        <p className="text-sm text-stone-500">{t('warehouse.inventory.hint')}</p>
        <label className="block text-xs font-semibold text-stone-500">
          {t('warehouse.col.name')}
          <select
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {warehouse.items
              .filter((i) => i.active)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </label>
        <p className="text-sm">
          {t('warehouse.inventory.current')}:{' '}
          <span className="font-bold tabular-nums">
            {formatQty(current)} {item?.unit ?? ''}
          </span>
        </p>
        <label className="block text-xs font-semibold text-stone-500">
          {t('warehouse.inventory.counted')} *
          <input
            type="text"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
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
          {t('warehouse.inventory.apply')}
        </button>
      </form>
      <div className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">{t('warehouse.inventory.recent')}</h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
          {[...warehouse.auditLog]
            .filter((e) => e.action === 'inventory')
            .slice(-20)
            .reverse()
            .map((e) => (
              <li key={e.id} className="border-b border-grid/60 pb-2">
                <span className="text-stone-400">{e.at.slice(0, 16).replace('T', ' ')}</span>
                <p>{e.detail}</p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}
