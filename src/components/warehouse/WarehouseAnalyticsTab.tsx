import { useMemo } from 'react'
import { useI18n } from '@/context/I18nContext'
import {
  computeAllBalances,
  formatQty,
  itemStockValue,
  lowStockItems,
  turnoverForPeriod,
} from '@/lib/warehouse/stock'
import type { WarehousePageProps } from './warehouseTypes'

type Props = WarehousePageProps & {
  warehouseId: string
  fromDate: string
  toDate: string
}

export function WarehouseAnalyticsTab({
  warehouse,
  warehouseId,
  fromDate,
  toDate,
}: Props) {
  const { t } = useI18n()
  const balances = useMemo(
    () => computeAllBalances(warehouse, warehouseId || undefined),
    [warehouse, warehouseId],
  )
  const turnover = useMemo(
    () => turnoverForPeriod(warehouse, fromDate, toDate, warehouseId || undefined),
    [warehouse, fromDate, toDate, warehouseId],
  )
  const top = turnover.slice(0, 15)
  const itemMap = new Map(warehouse.items.map((i) => [i.id, i]))

  let totalValue = 0
  for (const item of warehouse.items) {
    if (warehouseId && item.warehouseId !== warehouseId) continue
    totalValue += itemStockValue(item, balances.get(item.id)?.balance ?? 0)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="font-bold text-ink">{t('warehouse.analytics.summary')}</h3>
        <p className="mt-2 text-sm text-stone-500">
          {fromDate} — {toDate}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('warehouse.analytics.stockValue')}</dt>
            <dd className="font-semibold tabular-nums">
              {totalValue ? `${formatQty(totalValue)} ₾` : '—'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('warehouse.kpi.lowStock')}</dt>
            <dd className="font-semibold">
              {lowStockItems(warehouse.items.filter((i) => i.active), balances).length}
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-xl border border-grid bg-white shadow-sm overflow-hidden">
        <div className="border-b border-grid px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t('warehouse.analytics.topIssue')}
        </div>
        {top.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">{t('warehouse.noMovements')}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {top.map((row) => {
                const item = itemMap.get(row.itemId)
                return (
                  <tr key={row.itemId} className="border-t border-grid/60">
                    <td className="px-4 py-2 truncate max-w-[14rem]" title={item?.name}>
                      {item?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700">
                      {formatQty(row.issue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {formatQty(row.receipt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
