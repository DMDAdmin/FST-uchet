import { useI18n } from '@/context/I18nContext'

type Props = {
  brigades: string[]
  search: string
  filterBrigade: string
  filterSchedule: string
  readOnly?: boolean
  onSearch: (v: string) => void
  onFilterBrigade: (v: string) => void
  onFilterSchedule: (v: string) => void
  onBulkHolidayV: () => void
  onBulkCopy52: () => void
  onShowHotkeys: () => void
}

export function MonthToolsBar({
  brigades,
  search,
  filterBrigade,
  filterSchedule,
  readOnly = false,
  onSearch,
  onFilterBrigade,
  onFilterSchedule,
  onBulkHolidayV,
  onBulkCopy52,
  onShowHotkeys,
}: Props) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-grid bg-white/90 px-3 py-2 text-sm shadow-sm">
      <input
        className="min-w-[10rem] flex-1 rounded-md border border-grid px-2 py-1.5 text-sm"
        placeholder={t('month.searchEmployee')}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <select
        className="rounded-md border border-grid px-2 py-1.5 text-xs"
        value={filterBrigade}
        onChange={(e) => onFilterBrigade(e.target.value)}
      >
        <option value="">{t('month.allBrigades')}</option>
        {brigades.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-grid px-2 py-1.5 text-xs"
        value={filterSchedule}
        onChange={(e) => onFilterSchedule(e.target.value)}
      >
        <option value="">{t('month.allSchedules')}</option>
        <option value="5/2 8ч">5/2 8ч</option>
        <option value="2/2 11ч">2/2 11ч</option>
      </select>
      <button
        type="button"
        className="rounded-md border border-grid px-2 py-1.5 text-xs hover:bg-paper-dark disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onBulkHolidayV}
        disabled={readOnly}
        title={readOnly ? t('month.archivedReadOnly') : t('month.bulkHolidayHint')}
      >
        {t('month.bulkHoliday')}
      </button>
      <button
        type="button"
        className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onBulkCopy52}
        disabled={readOnly}
        title={readOnly ? t('month.archivedReadOnly') : t('month.bulkCopy52Hint')}
      >
        {t('month.bulkCopy52')}
      </button>
      <button
        type="button"
        className="rounded-md border border-grid px-2 py-1 text-xs text-stone-500 hover:bg-paper-dark"
        onClick={onShowHotkeys}
        title={t('hotkeys.title')}
      >
        ?
      </button>
    </div>
  )
}
