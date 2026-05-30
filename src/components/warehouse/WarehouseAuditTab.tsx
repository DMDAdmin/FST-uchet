import { useI18n } from '@/context/I18nContext'
import type { WarehouseStore } from '@/lib/warehouse/types'

export function WarehouseAuditTab({ warehouse }: { warehouse: WarehouseStore }) {
  const { t } = useI18n()
  const entries = [...warehouse.auditLog].reverse().slice(0, 200)

  const actionLabel: Record<string, string> = {
    item_change: t('warehouse.audit.itemChange'),
    item_archive: t('warehouse.audit.itemArchive'),
    movement_add: t('warehouse.audit.movementAdd'),
    movement_delete: t('warehouse.audit.movementDelete'),
    document_post: t('warehouse.audit.documentPost'),
    inventory: t('warehouse.audit.inventory'),
    import: t('warehouse.audit.import'),
  }

  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-12 text-center text-sm text-stone-500">
        {t('warehouse.audit.empty')}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-grid bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-grid bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3 w-36">{t('warehouse.audit.when')}</th>
            <th className="px-3 py-3 w-32">{t('warehouse.audit.action')}</th>
            <th className="px-3 py-3">{t('warehouse.audit.detail')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-grid/60">
              <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                {e.at.slice(0, 16).replace('T', ' ')}
              </td>
              <td className="px-3 py-2 text-xs font-semibold uppercase text-teal-800">
                {actionLabel[e.action] ?? e.action}
              </td>
              <td className="px-3 py-2">{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
