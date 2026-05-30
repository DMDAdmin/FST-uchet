import { useI18n } from '@/context/I18nContext'
import { formatMonthTitle } from '@/lib/dates'
import { listMonthKeys } from '@/lib/monthManage'
import { monthStats } from '@/lib/stats'
import type { AppStore } from '@/lib/types'

type Props = { store: AppStore }

export function SummaryPage({ store }: Props) {
  const { t, locale, statsReadiness, statsControl } = useI18n()
  const months = listMonthKeys(store)
  const rows = months.map((m) => ({ month: m, stats: monthStats(store.months[m], store.employees) }))
  const total = rows.reduce(
    (acc, r) => ({
      planHours: acc.planHours + r.stats.planHours,
      factHours: acc.factHours + r.stats.factHours,
      mismatches: acc.mismatches + r.stats.mismatches,
      factShifts: acc.factShifts + r.stats.factShifts,
    }),
    { planHours: 0, factHours: 0, mismatches: 0, factShifts: 0 },
  )

  return (
    <div className="flex flex-col gap-4 p-5">
      <header>
        <h2 className="text-xl font-bold text-ink">{t('summary.title')}</h2>
        <p className="text-sm text-ink-muted">{t('summary.subtitle')}</p>
      </header>

      <div className="overflow-auto rounded-xl border border-grid bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">{t('summary.colMonth')}</th>
              <th className="px-4 py-3">{t('stats.planH')}</th>
              <th className="px-4 py-3">{t('stats.factH')}</th>
              <th className="px-4 py-3">{t('stats.deviation')}</th>
              <th className="px-4 py-3">{t('summary.colFilled')}</th>
              <th className="px-4 py-3">{t('summary.colMismatchShort')}</th>
              <th className="px-4 py-3">{t('stats.absences')}</th>
              <th className="px-4 py-3">{t('stats.factShifts')}</th>
              <th className="px-4 py-3">{t('stats.readiness')}</th>
              <th className="px-4 py-3">{t('stats.control')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ month, stats }) => (
              <tr key={month} className="border-t border-grid">
                <td className="px-4 py-3 font-medium capitalize">
                  {formatMonthTitle(month, locale)}
                </td>
                <td className="px-4 py-3 font-mono">{stats.planHours}</td>
                <td className="px-4 py-3 font-mono">{stats.factHours}</td>
                <td className="px-4 py-3 font-mono">{stats.deviation}</td>
                <td className="px-4 py-3 font-mono">{Math.round(stats.fillRate * 100)}%</td>
                <td className="px-4 py-3 font-mono">{stats.mismatches}</td>
                <td className="px-4 py-3 font-mono">{stats.absences}</td>
                <td className="px-4 py-3 font-mono">{stats.factShifts}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      stats.readiness === 'ready'
                        ? 'bg-emerald-100 text-emerald-800'
                        : stats.readiness === 'review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {statsReadiness(stats.readiness)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-semibold ${
                      stats.control === 'ok' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {statsControl(stats.control)}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-accent/30 bg-accent-soft/20 font-semibold">
              <td className="px-4 py-3">{t('common.total')}</td>
              <td className="px-4 py-3 font-mono">{total.planHours}</td>
              <td className="px-4 py-3 font-mono">{total.factHours}</td>
              <td className="px-4 py-3 font-mono">{total.factHours - total.planHours}</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 font-mono">{total.mismatches}</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3 font-mono">{total.factShifts}</td>
              <td colSpan={2} className="px-4 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
