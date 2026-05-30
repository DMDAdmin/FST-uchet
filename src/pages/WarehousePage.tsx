import { useMemo, useState, Fragment, useCallback, useEffect } from 'react'
import { FiberCellBrand } from '@/components/brand/FiberCellBrand'
import { FormNotice } from '@/components/ui/FormNotice'
import { WarehouseAnalyticsTab } from '@/components/warehouse/WarehouseAnalyticsTab'
import { WarehouseAuditTab } from '@/components/warehouse/WarehouseAuditTab'
import { WarehouseDocumentsTab } from '@/components/warehouse/WarehouseDocumentsTab'
import { WarehouseImportTab } from '@/components/warehouse/WarehouseImportTab'
import { WarehouseMovementsTab } from '@/components/warehouse/WarehouseMovementsTab'
import { WarehouseInventoryTab } from '@/components/warehouse/WarehouseInventoryTab'
import {
  UNITS,
  WAREHOUSE_TABS,
  type WarehousePageProps,
  type WarehouseTab,
} from '@/components/warehouse/warehouseTypes'
import { useI18n } from '@/context/I18nContext'
import { WAREHOUSE_PICK_EVENT, consumePendingWarehousePick, type WarehousePickDetail } from '@/lib/ai/warehousePickEvent'
import { exportWarehouseBalancesExcel } from '@/lib/warehouse/importExport'
import { printWarehouseBalances } from '@/lib/warehouse/print'
import {
  computeAllBalances,
  formatQty,
  itemStockValue,
  lowStockItems,
} from '@/lib/warehouse/stock'
import type {
  StockMovementType,
  WarehouseCategory,
  WarehouseItem,
  WarehouseLocation,
} from '@/lib/warehouse/types'

export function WarehousePage(props: WarehousePageProps) {
  const {
    warehouse,
    brigades,
    printMeta,
    onUpsertItem,
    onArchiveItem,
    onRemoveItem,
    onUpsertCategory,
    onUpsertLocation,
    onAddMovement,
    onDeleteMovement,
    onPostDocument,
    onRunInventory,
    onImportExcel,
    onExportExcel,
    onMergeInvoiceRegistry,
  } = props

  const { t } = useI18n()
  const [tab, setTab] = useState<WarehouseTab>('balances')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouse.locations[0]?.id ?? '')
  const [deficitOnly, setDeficitOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editItem, setEditItem] = useState<WarehouseItem | null>(null)
  const [cardItem, setCardItem] = useState<WarehouseItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pendingAiPick, setPendingAiPick] = useState<WarehousePickDetail | null>(null)

  useEffect(() => {
    const pending = consumePendingWarehousePick()
    if (pending?.query) {
      setTab('documents')
      setPendingAiPick(pending)
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WarehousePickDetail>).detail
      if (!detail?.query) return
      setTab('documents')
      setPendingAiPick(detail)
    }
    window.addEventListener(WAREHOUSE_PICK_EVENT, handler)
    return () => window.removeEventListener(WAREHOUSE_PICK_EVENT, handler)
  }, [])

  const balances = useMemo(
    () => computeAllBalances(warehouse, warehouseId || undefined),
    [warehouse, warehouseId],
  )
  const categories = useMemo(
    () => [...warehouse.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [warehouse.categories],
  )
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const categoryNames = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  const baseItems = warehouse.items.filter((i) => (showArchived ? !i.active : i.active))
  const filteredItems = baseItems.filter((item) => {
    const q = search.trim().toLowerCase()
    if (warehouseId && item.warehouseId !== warehouseId) return false
    if (catFilter && item.categoryId !== catFilter) return false
    if (!q) return true
    const cat = catMap.get(item.categoryId)?.name ?? ''
    return (
      item.name.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      item.sku?.toLowerCase().includes(q) ||
      item.barcode?.toLowerCase().includes(q)
    )
  })

  const hasItemFilter = !!(search.trim() || catFilter || deficitOnly || warehouseId)

  const displayItems = deficitOnly
    ? filteredItems.filter((i) => lowStockItems([i], balances).length > 0)
    : filteredItems

  const activeItems = warehouse.items.filter((i) => i.active)
  const lowStock = lowStockItems(activeItems, balances)

  const handleExport = useCallback(() => {
    exportWarehouseBalancesExcel(warehouse, balances, warehouseId || undefined)
    onExportExcel(warehouseId || undefined)
  }, [warehouse, balances, warehouseId, onExportExcel])

  function openNewItem() {
    const catId = catFilter || categories[0]?.id || ''
    setEditItem({
      id: crypto.randomUUID(),
      name: '',
      categoryId: catId,
      warehouseId: warehouseId || warehouse.locations[0]?.id || '',
      unit: 'шт',
      active: true,
      sortOrder: warehouse.items.length,
    })
    setIsNew(true)
  }

  const tabLabels: Record<WarehouseTab, string> = {
    balances: t('warehouse.tab.balances'),
    nomenclature: t('warehouse.tab.nomenclature'),
    movements: t('warehouse.tab.movements'),
    documents: t('warehouse.tab.documents'),
    inventory: t('warehouse.tab.inventory'),
    analytics: t('warehouse.tab.analytics'),
    import: t('warehouse.tab.import'),
    audit: t('warehouse.tab.audit'),
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <FiberCellBrand variant="page" className="shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
              {t('warehouse.badge')}
            </p>
            <h2 className="text-2xl font-bold text-ink">{t('warehouse.title')}</h2>
            <p className="text-sm text-stone-500">{t('warehouse.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <KpiCard label={t('warehouse.kpi.items')} value={String(activeItems.length)} />
          <KpiCard label={t('warehouse.kpi.categories')} value={String(categories.length)} />
          <KpiCard
            label={t('warehouse.kpi.lowStock')}
            value={String(lowStock.length)}
            warn={lowStock.length > 0}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-full flex-wrap rounded-lg border border-grid bg-white p-1 shadow-sm">
          {WAREHOUSE_TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                tab === id ? 'bg-teal-700 text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}
              onClick={() => setTab(id)}
            >
              {tabLabels[id]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {tab !== 'import' && tab !== 'audit' && (
          <>
            <input
              type="search"
              placeholder={t('warehouse.search')}
              className="min-w-[12rem] flex-1 rounded-lg border border-grid bg-white px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-lg border border-grid bg-white px-3 py-2 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{t('warehouse.allLocations')}</option>
              {warehouse.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-grid bg-white px-3 py-2 text-sm"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">{t('warehouse.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        {tab === 'balances' && (
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={deficitOnly}
              onChange={(e) => setDeficitOnly(e.target.checked)}
            />
            {t('warehouse.deficitOnly')}
          </label>
        )}
        {tab === 'nomenclature' && (
          <>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {t('warehouse.showArchived')}
            </label>
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              onClick={openNewItem}
            >
              {t('warehouse.addItem')}
            </button>
          </>
        )}
        {(tab === 'balances' || tab === 'import') && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-grid bg-white px-3 py-2 text-sm hover:bg-stone-50"
              onClick={handleExport}
            >
              {t('warehouse.exportExcel')}
            </button>
            <button
              type="button"
              className="rounded-lg border border-grid bg-white px-3 py-2 text-sm hover:bg-stone-50"
              onClick={() =>
                printWarehouseBalances(warehouse, warehouseId || undefined, t('warehouse.title'))
              }
            >
              {t('warehouse.print')}
            </button>
          </div>
        )}
        {tab === 'analytics' && (
          <>
            <input
              type="date"
              className="rounded-lg border border-grid px-3 py-2 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-stone-400">—</span>
            <input
              type="date"
              className="rounded-lg border border-grid px-3 py-2 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </>
        )}
      </div>

      {tab === 'balances' && (
        <BalancesTable
          items={displayItems}
          catMap={catMap}
          balances={balances}
          hasFilter={hasItemFilter}
          onEdit={setCardItem}
        />
      )}
      {tab === 'nomenclature' && (
        <NomenclatureTable
          items={displayItems}
          catMap={catMap}
          balances={balances}
          archived={showArchived}
          hasFilter={hasItemFilter}
          onEdit={(item) => {
            setEditItem(item)
            setIsNew(false)
          }}
          onArchive={(id, arch) => onArchiveItem(id, arch)}
          onRemove={onRemoveItem}
        />
      )}
      {tab === 'movements' && (
        <WarehouseMovementsTab
          warehouse={warehouse}
          warehouseId={warehouseId}
          brigades={brigades}
          categoryNames={categoryNames}
          balances={balances}
          printMeta={printMeta}
          onPostDocument={onPostDocument}
          onMergeInvoiceRegistry={onMergeInvoiceRegistry}
          onAddMovement={onAddMovement}
          onDeleteMovement={onDeleteMovement}
        />
      )}
      {tab === 'documents' && (
        <WarehouseDocumentsTab
          warehouse={warehouse}
          brigades={brigades}
          warehouseId={warehouseId}
          categoryNames={categoryNames}
          printMeta={printMeta}
          onPostDocument={onPostDocument}
          onMergeInvoiceRegistry={onMergeInvoiceRegistry}
          pendingAiPick={pendingAiPick}
          onConsumeAiPick={() => setPendingAiPick(null)}
        />
      )}
      {tab === 'inventory' && (
        <WarehouseInventoryTab
          warehouse={warehouse}
          warehouseId={warehouseId}
          onRunInventory={onRunInventory}
        />
      )}
      {tab === 'analytics' && (
        <WarehouseAnalyticsTab
          {...props}
          warehouseId={warehouseId}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
      {tab === 'import' && (
        <WarehouseImportTab
          onImportExcel={onImportExcel}
          warehouseId={warehouseId}
          locations={warehouse.locations}
          onWarehouseChange={setWarehouseId}
        />
      )}
      {tab === 'audit' && <WarehouseAuditTab warehouse={warehouse} />}

      {editItem && (
        <ItemEditModal
          item={editItem}
          isNew={isNew}
          categories={categories}
          locations={warehouse.locations}
          onClose={() => setEditItem(null)}
          onSave={(item) => {
            onUpsertItem(item)
            setEditItem(null)
          }}
          onAddCategory={(name) => {
            const cat: WarehouseCategory = {
              id: crypto.randomUUID(),
              name,
              sortOrder: categories.length,
            }
            onUpsertCategory(cat)
            return cat.id
          }}
          onAddLocation={(name) => {
            const loc: WarehouseLocation = {
              id: crypto.randomUUID(),
              name,
              sortOrder: warehouse.locations.length,
            }
            onUpsertLocation(loc)
            return loc.id
          }}
        />
      )}

      {cardItem && (
        <ItemCardModal
          item={cardItem}
          warehouse={warehouse}
          balances={balances}
          onClose={() => setCardItem(null)}
          onEdit={() => {
            setEditItem(cardItem)
            setIsNew(false)
            setCardItem(null)
          }}
        />
      )}
    </div>
  )
}

function KpiCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`min-w-[5.5rem] rounded-xl border px-4 py-3 ${
        warn ? 'border-amber-300 bg-amber-50' : 'border-grid bg-white'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`text-xl font-bold ${warn ? 'text-amber-800' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function BalancesTable({
  items,
  catMap,
  balances,
  hasFilter,
  onEdit,
}: {
  items: WarehouseItem[]
  catMap: Map<string, WarehouseCategory>
  balances: ReturnType<typeof computeAllBalances>
  hasFilter?: boolean
  onEdit: (item: WarehouseItem) => void
}) {
  const { t } = useI18n()
  const grouped = useMemo(() => {
    const map = new Map<string, WarehouseItem[]>()
    for (const item of items) {
      const list = map.get(item.categoryId) ?? []
      list.push(item)
      map.set(item.categoryId, list)
    }
    return map
  }, [items])

  if (!items.length) {
    return (
      <EmptyState
        message={hasFilter ? t('warehouse.emptyFilter') : t('warehouse.empty')}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-grid bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-grid bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">{t('warehouse.col.name')}</th>
            <th className="px-3 py-3 w-20">{t('warehouse.col.unit')}</th>
            <th className="px-3 py-3 w-24 text-right">{t('warehouse.col.reserved')}</th>
            <th className="px-3 py-3 w-28 text-right">{t('warehouse.col.balance')}</th>
            <th className="px-3 py-3 w-28 text-right">{t('warehouse.col.available')}</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([catId, catItems]) => (
            <Fragment key={catId}>
              <tr className="bg-teal-50/60">
                <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-900">
                  {catMap.get(catId)?.name ?? '—'}
                </td>
              </tr>
              {catItems.map((item) => {
                const b = balances.get(item.id)
                const low = item.minStock != null && (b?.available ?? 0) < item.minStock
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-grid/60 hover:bg-stone-50/80"
                    onClick={() => onEdit(item)}
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">{item.name}</td>
                    <td className="px-3 py-2.5 text-stone-500">{item.unit}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-stone-600">
                      {formatQty(b?.reserved ?? 0)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                        low ? 'text-amber-700' : (b?.balance ?? 0) === 0 ? 'text-stone-400' : 'text-ink'
                      }`}
                    >
                      {formatQty(b?.balance ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatQty(b?.available ?? 0)}</td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NomenclatureTable({
  items,
  catMap,
  balances,
  archived,
  hasFilter,
  onEdit,
  onArchive,
  onRemove,
}: {
  items: WarehouseItem[]
  catMap: Map<string, WarehouseCategory>
  balances: ReturnType<typeof computeAllBalances>
  archived: boolean
  hasFilter?: boolean
  onEdit: (item: WarehouseItem) => void
  onArchive: (id: string, archived: boolean) => void
  onRemove: (id: string) => void
}) {
  const { t } = useI18n()
  if (!items.length) {
    return (
      <EmptyState
        message={hasFilter ? t('warehouse.emptyFilter') : t('warehouse.empty')}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-grid bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-grid bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">{t('warehouse.col.name')}</th>
            <th className="px-3 py-3">{t('warehouse.col.category')}</th>
            <th className="px-3 py-3">{t('warehouse.col.sku')}</th>
            <th className="px-3 py-3 w-20">{t('warehouse.col.unit')}</th>
            <th className="px-3 py-3 w-24 text-right">{t('warehouse.col.balance')}</th>
            <th className="px-3 py-3 w-32" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-grid/60 hover:bg-stone-50/80">
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  className="text-left font-medium text-ink hover:text-teal-800 hover:underline"
                  onClick={() => onEdit(item)}
                >
                  {item.name}
                </button>
              </td>
              <td className="px-3 py-2.5 text-stone-600">{catMap.get(item.categoryId)?.name ?? '—'}</td>
              <td className="px-3 py-2.5 text-stone-500 text-xs">{item.sku ?? '—'}</td>
              <td className="px-3 py-2.5 text-stone-500">{item.unit}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                {formatQty(balances.get(item.id)?.balance ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs">
                <button type="button" className="text-teal-700 hover:underline" onClick={() => onEdit(item)}>
                  {t('common.edit')}
                </button>
                {archived ? (
                  <button
                    type="button"
                    className="ml-3 text-emerald-700 hover:underline"
                    onClick={() => onArchive(item.id, false)}
                  >
                    {t('warehouse.restore')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ml-3 text-amber-700 hover:underline"
                      onClick={() => onArchive(item.id, true)}
                    >
                      {t('warehouse.archive')}
                    </button>
                    <button
                      type="button"
                      className="ml-3 text-red-600 hover:underline"
                      onClick={() => {
                        if (confirm(t('warehouse.confirmDelete'))) onRemove(item.id)
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TypeBadge({ type }: { type: StockMovementType }) {
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

function ItemEditModal({
  item,
  isNew,
  categories,
  locations,
  onClose,
  onSave,
  onAddCategory,
  onAddLocation,
}: {
  item: WarehouseItem
  isNew: boolean
  categories: WarehouseCategory[]
  locations: WarehouseLocation[]
  onClose: () => void
  onSave: (item: WarehouseItem) => void
  onAddCategory: (name: string) => string
  onAddLocation: (name: string) => string
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(item)
  const [newCat, setNewCat] = useState('')
  const [newLoc, setNewLoc] = useState('')
  const [altUnit, setAltUnit] = useState('')
  const [altFactor, setAltFactor] = useState('')
  const [error, setError] = useState<string | null>(null)

  function save() {
    const name = draft.name.trim()
    if (!name) {
      setError(t('warehouse.err.nameRequired'))
      return
    }
    setError(null)
    onSave({ ...draft, name })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-grid px-6 py-4">
          <h3 className="text-lg font-bold">{isNew ? t('warehouse.addItem') : t('warehouse.editItem')}</h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          {error && <FormNotice type="error" message={error} onDismiss={() => setError(null)} />}
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.col.name')} *
            <input
              autoFocus
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2.5 text-sm font-medium"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.col.category')}
            <select
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-grid px-3 py-2 text-sm"
              placeholder={t('warehouse.newCategory')}
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border border-grid px-3 text-sm hover:bg-stone-50"
              onClick={() => {
                const n = newCat.trim()
                if (!n) return
                setDraft({ ...draft, categoryId: onAddCategory(n) })
                setNewCat('')
              }}
            >
              +
            </button>
          </div>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.location')}
            <select
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.warehouseId}
              onChange={(e) => setDraft({ ...draft, warehouseId: e.target.value })}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-grid px-3 py-2 text-sm"
              placeholder={t('warehouse.newLocation')}
              value={newLoc}
              onChange={(e) => setNewLoc(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border border-grid px-3 text-sm hover:bg-stone-50"
              onClick={() => {
                const n = newLoc.trim()
                if (!n) return
                setDraft({ ...draft, warehouseId: onAddLocation(n) })
                setNewLoc('')
              }}
            >
              +
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-stone-500">
              {t('warehouse.col.sku')}
              <input
                className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
                value={draft.sku ?? ''}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value || undefined })}
              />
            </label>
            <label className="block text-xs font-semibold text-stone-500">
              {t('warehouse.col.barcode')}
              <input
                className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
                value={draft.barcode ?? ''}
                onChange={(e) => setDraft({ ...draft, barcode: e.target.value || undefined })}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.col.unit')}
            <select
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.price')}
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.price ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, price: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </label>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.minStock')}
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.minStock ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, minStock: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </label>
          <div>
            <p className="text-xs font-semibold text-stone-500">{t('warehouse.unitConversion')}</p>
            <div className="mt-1 flex gap-2">
              <input
                className="w-20 rounded-lg border border-grid px-2 py-2 text-sm"
                placeholder={t('warehouse.col.unit')}
                value={altUnit}
                onChange={(e) => setAltUnit(e.target.value)}
              />
              <input
                className="flex-1 rounded-lg border border-grid px-2 py-2 text-sm"
                placeholder={t('warehouse.conversionFactor')}
                value={altFactor}
                onChange={(e) => setAltFactor(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-grid px-2 text-sm"
                onClick={() => {
                  const f = Number(altFactor.replace(',', '.'))
                  if (!altUnit.trim() || !f) return
                  setDraft({
                    ...draft,
                    unitConversions: [
                      ...(draft.unitConversions ?? []).filter((c) => c.unit !== altUnit.trim()),
                      { unit: altUnit.trim(), factor: f },
                    ],
                  })
                  setAltUnit('')
                  setAltFactor('')
                }}
              >
                +
              </button>
            </div>
            {(draft.unitConversions ?? []).map((c) => (
              <p key={c.unit} className="mt-1 text-xs text-stone-500">
                1 {c.unit} = {c.factor} {draft.unit}
              </p>
            ))}
          </div>
          <label className="block text-xs font-semibold text-stone-500">
            {t('warehouse.note')}
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-sm"
              value={draft.note ?? ''}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-grid px-6 py-4">
          <button type="button" className="rounded-lg border border-grid px-4 py-2 text-sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemCardModal({
  item,
  warehouse,
  balances,
  onClose,
  onEdit,
}: {
  item: WarehouseItem
  warehouse: WarehousePageProps['warehouse']
  balances: ReturnType<typeof computeAllBalances>
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()
  const b = balances.get(item.id)
  const cat = warehouse.categories.find((c) => c.id === item.categoryId)
  const loc = warehouse.locations.find((l) => l.id === item.warehouseId)
  const movements = warehouse.movements
    .filter((m) => m.itemId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-grid px-6 py-4">
          <h3 className="text-lg font-bold">{item.name}</h3>
          <p className="text-sm text-stone-500">
            {cat?.name} · {loc?.name}
          </p>
        </div>
        <dl className="space-y-2 px-6 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('warehouse.col.balance')}</dt>
            <dd className="font-bold tabular-nums">{formatQty(b?.balance ?? 0)} {item.unit}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('warehouse.col.available')}</dt>
            <dd className="tabular-nums">{formatQty(b?.available ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('warehouse.col.reserved')}</dt>
            <dd className="tabular-nums">{formatQty(b?.reserved ?? 0)}</dd>
          </div>
          {item.price != null && (
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('warehouse.stockValue')}</dt>
              <dd className="tabular-nums">{formatQty(itemStockValue(item, b?.balance ?? 0))} ₾</dd>
            </div>
          )}
        </dl>
        {movements.length > 0 && (
          <div className="border-t border-grid px-6 py-3">
            <p className="text-xs font-semibold uppercase text-stone-400">{t('warehouse.recentForItem')}</p>
            <ul className="mt-2 space-y-1 text-xs">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span>{m.date}</span>
                  <TypeBadge type={m.type} />
                  <span className="tabular-nums">{formatQty(Math.abs(m.quantity))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-grid px-6 py-4">
          <button type="button" className="rounded-lg border border-grid px-4 py-2 text-sm" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white" onClick={onEdit}>
            {t('common.edit')}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-16 text-center text-stone-500">
      {message}
    </div>
  )
}
