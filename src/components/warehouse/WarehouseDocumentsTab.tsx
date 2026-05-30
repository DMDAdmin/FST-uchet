import { useEffect, useMemo, useState } from 'react'
import { WarehouseDocumentEditor } from '@/components/warehouse/WarehouseDocumentEditor'
import { useI18n } from '@/context/I18nContext'
import type { WarehousePickDetail } from '@/lib/ai/warehousePickEvent'
import {
  buildReceiptPrintModelFromDocument,
  type ReceiptPrintModel,
} from '@/lib/warehouse/printDocument'
import { WarehouseReceiptPrintPreview } from '@/components/warehouse/WarehouseReceiptPrintPreview'
import { computeAllBalances } from '@/lib/warehouse/stock'
import type { WarehouseDocument } from '@/lib/warehouse/types'
import type { WarehousePageProps } from './warehouseTypes'

type Props = Pick<WarehousePageProps, 'warehouse' | 'brigades' | 'onPostDocument' | 'onMergeInvoiceRegistry' | 'printMeta'> & {
  warehouseId: string
  categoryNames: Map<string, string>
  pendingAiPick?: WarehousePickDetail | null
  onConsumeAiPick?: () => void
}

export function WarehouseDocumentsTab({
  warehouse,
  brigades,
  warehouseId,
  categoryNames,
  onPostDocument,
  printMeta,
  onMergeInvoiceRegistry,
  pendingAiPick,
  onConsumeAiPick,
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [aiPick, setAiPick] = useState<WarehousePickDetail | null>(null)
  const [printPreview, setPrintPreview] = useState<ReceiptPrintModel | null>(null)

  const whId = warehouseId || warehouse.locations[0]?.id || ''
  const balances = useMemo(
    () => computeAllBalances(warehouse, whId || undefined),
    [warehouse, whId],
  )

  const itemMap = useMemo(
    () => new Map(warehouse.items.map((i) => [i.id, i])),
    [warehouse.items],
  )

  const docs = useMemo(
    () =>
      [...warehouse.documents]
        .filter((d) => !warehouseId || d.warehouseId === warehouseId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [warehouse.documents, warehouseId],
  )

  useEffect(() => {
    if (!pendingAiPick?.query) return
    setAiPick(pendingAiPick)
    setOpen(true)
    onConsumeAiPick?.()
  }, [pendingAiPick, onConsumeAiPick])

  function handlePrint(doc: WarehouseDocument) {
    if (doc.type !== 'receipt' || !printMeta) return
    const model = buildReceiptPrintModelFromDocument(warehouse, doc, printMeta)
    if (model) setPrintPreview(model)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={() => {
            setAiPick(null)
            setOpen(true)
          }}
        >
          {t('warehouse.doc.new')}
        </button>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-12 text-center text-sm text-stone-500">
          {t('warehouse.doc.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-grid bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grid bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">{t('warehouse.date')}</th>
                <th className="px-3 py-3">{t('warehouse.doc.number')}</th>
                <th className="px-3 py-3">{t('warehouse.type')}</th>
                <th className="px-3 py-3">{t('warehouse.doc.lines')}</th>
                <th className="px-3 py-3">{t('warehouse.doc.counterparty')}</th>
                <th className="px-3 py-3 w-24">{t('warehouse.print.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-grid/60">
                  <td className="px-4 py-2.5 whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-2.5 font-medium">
                    {d.number}
                    {d.invoiceKey && d.invoiceKey !== d.number && (
                      <span className="block text-[10px] font-normal text-stone-400">
                        RS: {d.invoiceKey}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.type === 'receipt' ? t('warehouse.receipt') : t('warehouse.issue')}
                    {d.brigade ? ` · ${d.brigade}` : ''}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.lines.map((l) => itemMap.get(l.itemId)?.name ?? '—').join(', ').slice(0, 80)}
                    {d.lines.length > 1 ? ` (${d.lines.length})` : ''}
                  </td>
                  <td className="px-3 py-2.5 text-stone-600">{d.counterparty ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {d.type === 'receipt' && printMeta && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-teal-700 hover:underline"
                        onClick={() => handlePrint(d)}
                      >
                        {t('warehouse.print.previewBtn')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-grid px-6 py-4">
              <h3 className="text-lg font-bold">{t('warehouse.doc.new')}</h3>
            </div>
            <div className="overflow-auto px-4 py-4">
              <WarehouseDocumentEditor
                warehouse={warehouse}
                categoryNames={categoryNames}
                balances={balances}
                brigades={brigades}
                warehouseId={whId}
                variant="modal"
                printMeta={printMeta}
                initialType={aiPick?.type}
                initialPickSearch={aiPick?.query}
                initialPickOpen={Boolean(aiPick?.query)}
                onPost={(doc) => {
                  onPostDocument(doc)
                  setOpen(false)
                  setAiPick(null)
                }}
                onMergeInvoiceRegistry={onMergeInvoiceRegistry}
                onCancel={() => {
                  setOpen(false)
                  setAiPick(null)
                }}
              />
            </div>
          </div>
        </div>
      )}
      {printPreview && (
        <WarehouseReceiptPrintPreview
          model={printPreview}
          onClose={() => setPrintPreview(null)}
        />
      )}
    </div>
  )
}
