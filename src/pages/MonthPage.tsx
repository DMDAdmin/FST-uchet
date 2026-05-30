import { useEffect, useState } from 'react'
import { FiberCellBrand } from '@/components/brand/FiberCellBrand'
import { FormNotice } from '@/components/ui/FormNotice'
import { HotkeysHelp } from '@/components/help/HotkeysHelp'
import { OnboardingTour } from '@/components/help/OnboardingTour'
import { CellCommentModal } from '@/components/month/CellCommentModal'
import { CodeLegendBar } from '@/components/month/CodeLegendBar'
import { MonthKpiBar } from '@/components/month/MonthKpiBar'
import { MonthProblemsBar } from '@/components/month/MonthProblemsBar'
import { MonthToolsBar } from '@/components/month/MonthToolsBar'
import { PlanFactTable } from '@/components/month/PlanFactTable'
import { TimesheetSection } from '@/components/month/TimesheetSection'
import { PrintPreviewModal, type PrintConfig } from '@/components/print/PrintPreviewModal'
import { PrintSetupModal } from '@/components/print/PrintSetupModal'
import { useI18n } from '@/context/I18nContext'
import { getCellComment } from '@/lib/bulkOps'
import { formatMonthTitle, shiftMonth } from '@/lib/dates'
import { isMonthArchived } from '@/lib/monthManage'
import { ensureMonth } from '@/lib/monthSheet'
import { monthStats } from '@/lib/stats'
import type { AppStore } from '@/lib/types'

export type MonthViewLayout = 'dual' | 'plan' | 'fact'

type Props = {
  store: AppStore
  month: string
  onMonthChange: (m: string) => void
  onPatch: (fn: (s: AppStore) => AppStore) => void
  onCycle: (rowId: string, dateKey: string, mode: 'plan' | 'fact') => void
  onAssign: (rowId: string, employeeId: string | null) => void
  onRegenerateRow: (rowId: string) => void
  onAddRow: (brigade: string) => void
  onRemoveRow: (rowId: string) => void
  onRemoveEmptyRow: (brigade: string) => void
  onRegenerateMonth: () => void
  onBulkHolidayV: () => void
  onBulkCopy52: () => void
  onSetComment: (rowId: string, dateKey: string, text: string) => void
  onTourComplete: () => void
}

export function MonthPage({
  store,
  month,
  onMonthChange,
  onPatch,
  onCycle,
  onAssign,
  onRegenerateRow,
  onAddRow,
  onRemoveRow,
  onRemoveEmptyRow,
  onRegenerateMonth,
  onBulkHolidayV,
  onBulkCopy52,
  onSetComment,
  onTourComplete,
}: Props) {
  const { t, locale } = useI18n()
  const [layout, setLayout] = useState<MonthViewLayout>('dual')
  const [printStep, setPrintStep] = useState<'off' | 'setup' | 'preview'>('off')
  const [printConfig, setPrintConfig] = useState<PrintConfig | null>(null)
  const [search, setSearch] = useState('')
  const [filterBrigade, setFilterBrigade] = useState('')
  const [filterSchedule, setFilterSchedule] = useState('')
  const [showHotkeys, setShowHotkeys] = useState(false)
  const [tourStep, setTourStep] = useState(
    () => (store.settings.tourCompleted ? 99 : 0),
  )
  const [commentTarget, setCommentTarget] = useState<{
    rowId: string
    dateKey: string
  } | null>(null)

  useEffect(() => {
    onPatch((s) => ensureMonth(s, month))
  }, [month, onPatch])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey) setShowHotkeys(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sheet = store.months[month]

  if (!sheet) {
    return <div className="p-8 text-stone-500">{t('month.loading')}</div>
  }

  const stats = monthStats(sheet, store.employees)
  const archived = isMonthArchived(store, month)

  function handleRegenerateMonth() {
    if (archived) return
    onRegenerateMonth()
  }

  function handleBulkHolidayV() {
    if (archived) return
    if (!confirm(t('month.confirmBulkHoliday'))) return
    onBulkHolidayV()
  }

  function handleBulkCopy52() {
    if (archived) return
    if (!confirm(t('month.confirmBulkCopy52'))) return
    onBulkCopy52()
  }

  const tableProps = {
    store,
    sheet,
    search,
    filterBrigade,
    filterSchedule,
    readOnly: archived,
    onAssign,
    onRegenerateRow,
    onAddRow,
    onRemoveRow,
    onRemoveEmptyRow,
    onCommentRequest: (rowId: string, dateKey: string) =>
      setCommentTarget({ rowId, dateKey }),
  }

  return (
    <div className="month-page flex flex-col gap-4 p-5 print:p-2">
      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="flex min-w-0 items-center gap-4">
          <FiberCellBrand variant="page" className="shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              {t('app.title')}
            </p>
            <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold capitalize text-ink">
              {formatMonthTitle(month, locale)}
              {isMonthArchived(store, month) && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                  {t('month.archive')}
                </span>
              )}
            </h2>
            <p className="text-sm text-ink-muted">
              {t('print.site')}: {store.settings.site}
              {store.settings.responsible ? ` · ${store.settings.responsible}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-grid bg-white shadow-sm">
            <button
              type="button"
              className="px-3 py-2 text-stone-600 hover:bg-paper-dark"
              onClick={() => onMonthChange(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <span className="min-w-[9rem] px-2 py-2 text-center text-sm font-semibold capitalize">
              {formatMonthTitle(month, locale)}
            </span>
            <button
              type="button"
              className="px-3 py-2 text-stone-600 hover:bg-paper-dark"
              onClick={() => onMonthChange(shiftMonth(month, 1))}
            >
              ›
            </button>
          </div>
          <div className="flex rounded-lg border border-grid bg-white p-1 shadow-sm">
            {(
              [
                ['dual', t('month.overview')],
                ['plan', t('month.plan')],
                ['fact', t('month.fact')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                  layout === id ? 'bg-accent text-white' : 'text-stone-600'
                }`}
                onClick={() => setLayout(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-lg border border-grid bg-white px-3 py-2 text-sm font-medium hover:bg-paper-dark disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleRegenerateMonth}
            disabled={archived}
            title={archived ? t('month.archivedReadOnly') : undefined}
          >
            {t('month.regenerate')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-stone-800 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700"
            onClick={() => setPrintStep('setup')}
          >
            {t('common.print')}
          </button>
        </div>
      </header>

      {archived && (
        <FormNotice type="info" message={t('month.archivedReadOnly')} />
      )}

      <MonthToolsBar
        brigades={store.brigades}
        search={search}
        filterBrigade={filterBrigade}
        filterSchedule={filterSchedule}
        readOnly={archived}
        onSearch={setSearch}
        onFilterBrigade={setFilterBrigade}
        onFilterSchedule={setFilterSchedule}
        onBulkHolidayV={handleBulkHolidayV}
        onBulkCopy52={handleBulkCopy52}
        onShowHotkeys={() => setShowHotkeys(true)}
      />

      <MonthProblemsBar store={store} sheet={sheet} />

      {printStep === 'setup' && (
        <PrintSetupModal
          sheet={sheet}
          brigades={store.brigades}
          initialConfig={printConfig}
          onClose={() => {
            setPrintStep('off')
            setPrintConfig(null)
          }}
          onConfirm={(config) => {
            setPrintConfig(config)
            setPrintStep('preview')
          }}
        />
      )}
      {printStep === 'preview' && printConfig && (
        <PrintPreviewModal
          store={store}
          sheet={sheet}
          config={printConfig}
          onClose={() => {
            setPrintStep('off')
            setPrintConfig(null)
          }}
          onBack={() => setPrintStep('setup')}
        />
      )}

      <MonthKpiBar stats={stats} />
      <CodeLegendBar />

      {layout === 'dual' ? (
        <div className="flex flex-col gap-6">
          <TimesheetSection title={t('month.planTitle')} subtitle={t('month.planHint')} tone="plan">
            <PlanFactTable
              {...tableProps}
              mode="plan"
              metaEditable={!archived}
              embedded
              onCycle={(rowId, dk) => onCycle(rowId, dk, 'plan')}
            />
          </TimesheetSection>
          <TimesheetSection title={t('month.factTitle')} subtitle={t('month.factHint')} tone="fact">
            <PlanFactTable
              {...tableProps}
              mode="fact"
              metaEditable={false}
              embedded
              onCycle={(rowId, dk) => onCycle(rowId, dk, 'fact')}
            />
          </TimesheetSection>
        </div>
      ) : (
        <TimesheetSection
          title={layout === 'plan' ? t('month.planTitle') : t('month.factTitle')}
          tone={layout}
        >
          <PlanFactTable
            {...tableProps}
            mode={layout}
            metaEditable={layout === 'plan' && !archived}
            embedded
            onCycle={(rowId, dk) => onCycle(rowId, dk, layout)}
          />
        </TimesheetSection>
      )}

      {showHotkeys && <HotkeysHelp onClose={() => setShowHotkeys(false)} />}
      {tourStep < 5 && (
        <OnboardingTour
          step={tourStep}
          onNext={() => {
            if (tourStep + 1 >= 5) {
              setTourStep(99)
              onTourComplete()
            } else setTourStep(tourStep + 1)
          }}
          onSkip={() => {
            setTourStep(99)
            onTourComplete()
          }}
        />
      )}
      {commentTarget && (
        <CellCommentModal
          dateKey={commentTarget.dateKey}
          initial={getCellComment(sheet, commentTarget.rowId, commentTarget.dateKey)}
          onSave={(text) => onSetComment(commentTarget.rowId, commentTarget.dateKey, text)}
          onClose={() => setCommentTarget(null)}
        />
      )}
    </div>
  )
}
