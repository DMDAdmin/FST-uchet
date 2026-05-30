import { useEffect, useRef, useState } from 'react'
import { AccountantLoginModal } from '@/components/auth/AccountantLoginModal'
import { FormNotice } from '@/components/ui/FormNotice'
import { StorageAlert } from '@/components/system/StorageAlert'
import { I18nProvider } from '@/context/I18nContext'
import { AppShell } from '@/components/layout/AppShell'
import { useAccountant } from '@/hooks/useAccountant'
import { useAppStore } from '@/hooks/useAppStore'
import { DEFAULT_ACCOUNTANT_PASSWORD } from '@/lib/auth'
import { restoreDailyBackup } from '@/lib/backup'
import { importFromJson, exportToJson } from '@/lib/storage'
import { t as translate } from '@/i18n'
import { CodesPage } from '@/pages/CodesPage'
import { EmployeesPage } from '@/pages/EmployeesPage'
import { MonthPage } from '@/pages/MonthPage'
import { PayPage } from '@/pages/PayPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SummaryPage } from '@/pages/SummaryPage'
import { WarehousePage } from '@/pages/WarehousePage'
import { FstCloudSync } from '@/components/web/FstCloudSync'

const isFstWeb = import.meta.env.VITE_FST_WEB === 'true'

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null)
  const app = useAppStore()
  const accountant = useAccountant(app.store.settings.accountantPassword)
  const [showLogin, setShowLogin] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(
    () =>
      !app.store.settings.passwordChanged &&
      app.store.settings.accountantPassword === DEFAULT_ACCOUNTANT_PASSWORD,
  )
  const [importNotice, setImportNotice] = useState<string | null>(null)

  useEffect(() => {
    if (app.view === 'pay' && !accountant.isAccountant) {
      setShowLogin(true)
    }
  }, [app.view, accountant.isAccountant])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  function handleViewChange(view: typeof app.view) {
    if (view === 'pay' && !accountant.isAccountant) {
      setShowLogin(true)
      return
    }
    app.setView(view)
  }

  async function handleImport(file: File) {
    if (!confirm(translate(app.store.settings.locale, 'app.importConfirm'))) {
      return
    }
    try {
      app.replaceStore(await importFromJson(file))
      setImportNotice(null)
    } catch {
      setImportNotice(translate(app.store.settings.locale, 'app.importError'))
    }
  }

  function handleRestoreBackup(date: string) {
    if (!confirm(translate(app.store.settings.locale, 'storage.restoreConfirm'))) {
      return
    }
    const restored = restoreDailyBackup(date)
    if (restored) {
      app.replaceStore(restored)
      app.dismissLoadWarning()
    }
  }

  return (
    <I18nProvider locale={app.store.settings.locale} setLocale={app.setLocale}>
      <>
        <StorageAlert
          loadWarning={app.loadWarning}
        saveError={app.saveError}
        onDismissLoadWarning={app.dismissLoadWarning}
        onDismissSaveError={app.dismissSaveError}
        onExportJson={() => exportToJson(app.store)}
          onRestoreFromBackup={handleRestoreBackup}
        />
        {importNotice && (
          <div className="px-4 pt-3">
            <FormNotice
              type="error"
              message={importNotice}
              onDismiss={() => setImportNotice(null)}
            />
          </div>
        )}
        <AppShell
          store={app.store}
          view={app.view}
          isAccountant={accountant.isAccountant}
          onViewChange={handleViewChange}
          onAccountantLogout={accountant.logout}
          onImport={() => fileRef.current?.click()}
          onReset={app.resetStore}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />

          {app.view === 'month' && (
            <MonthPage
              store={app.store}
              month={app.activeMonth}
              onMonthChange={app.setActiveMonth}
              onPatch={app.patch}
              onCycle={(rowId, dateKey, mode) =>
                app.cycleMark(app.activeMonth, rowId, dateKey, mode)
              }
              onAssign={(rowId, empId) =>
                app.assignRowEmployee(app.activeMonth, rowId, empId)
              }
              onRegenerateRow={(rowId) => app.regenerateRowPlan(app.activeMonth, rowId)}
              onAddRow={(brigade) => app.addBrigadeRowToMonth(app.activeMonth, brigade)}
              onRemoveRow={(rowId) => app.removeBrigadeRowFromMonth(app.activeMonth, rowId)}
              onRemoveEmptyRow={(brigade) =>
                app.removeEmptyBrigadeRowFromMonth(app.activeMonth, brigade)
              }
              onRegenerateMonth={() => app.regenerateMonthPlan(app.activeMonth)}
              onBulkHolidayV={() => app.bulkHolidayV(app.activeMonth)}
              onBulkCopy52={() => app.bulkCopyPlanToFact52(app.activeMonth)}
              onSetComment={(rowId, dateKey, text) =>
                app.setCellComment(app.activeMonth, rowId, dateKey, text)
              }
              onTourComplete={() => app.updateSettings({ tourCompleted: true })}
            />
          )}
          {app.view === 'employees' && (
            <EmployeesPage
              employees={app.store.employees}
              brigades={app.store.brigades}
              isAccountant={accountant.isAccountant}
              onSave={app.upsertEmployee}
              onRemove={app.removeEmployee}
            />
          )}
          {app.view === 'summary' && <SummaryPage store={app.store} />}
          {app.view === 'pay' && accountant.isAccountant && (
            <PayPage
              store={app.store}
              month={app.activeMonth}
              onMonthChange={app.setActiveMonth}
            />
          )}
          {app.view === 'codes' && <CodesPage />}
          {app.view === 'warehouse' && (
            <WarehousePage
              warehouse={app.store.warehouse}
              brigades={app.store.brigades}
              printMeta={{
                site: app.store.settings.site,
                responsible: app.store.settings.responsible,
                signatures: app.store.settings.signatures,
                locale: app.store.settings.locale,
              }}
              onUpsertItem={app.upsertWarehouseItem}
              onArchiveItem={app.archiveWarehouseItem}
              onRemoveItem={app.removeWarehouseItem}
              onUpsertCategory={app.upsertWarehouseCategory}
              onUpsertLocation={app.upsertWarehouseLocation}
              onAddMovement={app.addStockMovement}
              onDeleteMovement={app.deleteStockMovement}
              onPostDocument={app.postWarehouseDoc}
              onMergeInvoiceRegistry={app.mergeWarehouseInvoiceRegistry}
              onRunInventory={app.runWarehouseInventory}
              onImportExcel={app.importWarehouseExcel}
              onExportExcel={() => {}}
            />
          )}
          {app.view === 'settings' && (
            <SettingsPage
              store={app.store}
              isAccountant={accountant.isAccountant}
              onAddBrigade={app.addBrigade}
              onRenameBrigade={app.renameBrigade}
              onRemoveBrigade={app.removeBrigade}
              onAddMonth={app.addMonth}
              onRemoveMonth={app.removeMonth}
              onArchiveMonth={app.archiveMonth}
              onUpdateSettings={app.updateSettings}
              onSetBrigadeNameKa={app.setBrigadeNameKa}
              onRestoreTrashEmployee={app.restoreTrashEmployee}
              onRestoreTrashMonth={app.restoreTrashMonth}
              onPurgeTrashEmployee={app.purgeTrashEmployee}
              onPurgeTrashMonth={app.purgeTrashMonth}
              onReplaceStore={app.replaceStore}
            />
          )}
        </AppShell>

        {showLogin && (
          <AccountantLoginModal
            onLogin={accountant.login}
            onClose={() => {
              setShowLogin(false)
              if (!accountant.isAccountant && app.view === 'pay') {
                app.setView('month')
              }
            }}
          />
        )}

        {showPasswordPrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
            <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-ink">
                {translate(app.store.settings.locale, 'settings.defaultPasswordTitle')}
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                {translate(app.store.settings.locale, 'settings.defaultPasswordHint')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setShowPasswordPrompt(false)
                  setShowLogin(true)
                }}
                >
                  {translate(app.store.settings.locale, 'settings.changePasswordNow')}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-grid px-4 py-2 text-sm"
                  onClick={() => setShowPasswordPrompt(false)}
                >
                  {translate(app.store.settings.locale, 'settings.later')}
                </button>
              </div>
            </div>
          </div>
        )}
        {isFstWeb && <FstCloudSync store={app.store} replaceStore={app.replaceStore} />}
      </>
    </I18nProvider>
  )
}
