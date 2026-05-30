import { useState } from 'react'
import { FormNotice } from '@/components/ui/FormNotice'
import { useI18n } from '@/context/I18nContext'
import { listDailyBackups, restoreDailyBackup, saveBackupToFolder } from '@/lib/backup'
import { brigadeEmployeeCount } from '@/lib/brigadeManage'
import { formatMonthTitle, monthKey, shiftMonth } from '@/lib/dates'
import { isMonthArchived, listMonthKeys } from '@/lib/monthManage'
import { exportToJson } from '@/lib/storage'
import type { AppStore, PrintSignatures } from '@/lib/types'

type Props = {
  store: AppStore
  isAccountant: boolean
  onAddBrigade: (name: string) => void
  onRenameBrigade: (oldName: string, newName: string) => void
  onRemoveBrigade: (name: string) => void
  onAddMonth: (month: string) => void
  onRemoveMonth: (month: string) => void
  onArchiveMonth: (month: string, archived: boolean) => void
  onUpdateSettings: (patch: Partial<AppStore['settings']>) => void
  onSetBrigadeNameKa: (nameRu: string, nameKa: string) => void
  onRestoreTrashEmployee: (deletedAt: string) => void
  onRestoreTrashMonth: (deletedAt: string) => void
  onPurgeTrashEmployee: (deletedAt: string) => void
  onPurgeTrashMonth: (deletedAt: string) => void
  onReplaceStore: (store: AppStore) => void
}

export function SettingsPage({
  store,
  isAccountant,
  onAddBrigade,
  onRenameBrigade,
  onRemoveBrigade,
  onAddMonth,
  onRemoveMonth,
  onArchiveMonth,
  onUpdateSettings,
  onSetBrigadeNameKa,
  onRestoreTrashEmployee,
  onRestoreTrashMonth,
  onPurgeTrashEmployee,
  onPurgeTrashMonth,
  onReplaceStore,
}: Props) {
  const { t, tf, locale, setLocale } = useI18n()
  const [newBrigade, setNewBrigade] = useState('')
  const [editingBrigade, setEditingBrigade] = useState<string | null>(null)
  const [editBrigadeName, setEditBrigadeName] = useState('')
  const [editBrigadeKa, setEditBrigadeKa] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newMonth, setNewMonth] = useState(() => {
    const keys = listMonthKeys(store)
    const last = keys[keys.length - 1]
    return last ? shiftMonth(last, 1) : monthKey(new Date().getFullYear(), new Date().getMonth() + 1)
  })
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(
    null,
  )

  function showNotice(type: 'error' | 'success' | 'info', message: string) {
    setNotice({ type, message })
  }

  const months = listMonthKeys(store)
  const dailyBackups = listDailyBackups()
  const signatures = store.settings.signatures ?? {}

  function patchSignatures(patch: Partial<PrintSignatures>) {
    onUpdateSettings({
      signatures: { ...signatures, ...patch },
    })
  }

  function brigadeErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      switch (err.message) {
        case 'empty':
          return t('settings.err.brigadeEmpty')
        case 'duplicate':
          return t('settings.err.brigadeDuplicate')
        case 'last':
          return t('settings.err.brigadeLast')
        case 'employees':
          return t('settings.err.brigadeEmployees')
        case 'missing':
          return t('settings.err.brigadeMissing')
        default:
          return err.message
      }
    }
    return t('settings.err.generic')
  }

  function monthErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      switch (err.message) {
        case 'archived':
          return t('settings.err.monthArchived')
        case 'exists':
          return t('settings.err.monthExists')
        case 'missing':
          return t('settings.err.monthMissing')
        default:
          return err.message
      }
    }
    return t('settings.err.generic')
  }

  function handleAddBrigade(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newBrigade.trim()
    if (!trimmed) {
      showNotice('error', t('settings.err.brigadeEmpty'))
      return
    }
    try {
      onAddBrigade(trimmed)
      setNewBrigade('')
      showNotice('success', t('settings.brigadeAdded'))
    } catch (err) {
      showNotice('error', brigadeErrorMessage(err))
    }
  }

  function saveBrigadeRename(oldName: string) {
    const trimmed = editBrigadeName.trim()
    if (!trimmed) {
      showNotice('error', t('settings.err.brigadeEmpty'))
      return
    }
    try {
      onRenameBrigade(oldName, trimmed)
      if (editBrigadeKa.trim()) {
        onSetBrigadeNameKa(trimmed, editBrigadeKa.trim())
      }
      setEditingBrigade(null)
      setEditBrigadeName('')
      setEditBrigadeKa('')
      showNotice('success', t('settings.brigadeSaved'))
    } catch (err) {
      showNotice('error', brigadeErrorMessage(err))
    }
  }

  function handleRemoveBrigade(name: string) {
    const count = brigadeEmployeeCount(store, name)
    if (count > 0) {
      showNotice('error', tf('settings.confirmDeleteBrigadeBusy', { name, count }))
      return
    }
    if (!confirm(tf('settings.confirmDeleteBrigade', { name }))) return
    try {
      onRemoveBrigade(name)
      showNotice('success', t('settings.brigadeRemoved'))
    } catch (err) {
      showNotice('error', brigadeErrorMessage(err))
    }
  }

  function handleAddMonth(e: React.FormEvent) {
    e.preventDefault()
    try {
      onAddMonth(newMonth)
      setNewMonth(shiftMonth(newMonth, 1))
      showNotice('success', t('settings.monthAdded'))
    } catch (err) {
      showNotice('error', monthErrorMessage(err))
    }
  }

  function handleRemoveMonth(month: string) {
    if (isMonthArchived(store, month)) {
      showNotice('error', t('settings.err.archiveRemove'))
      return
    }
    if (
      !confirm(
        tf('settings.confirmDeleteMonth', {
          month: formatMonthTitle(month, locale),
        }),
      )
    ) {
      return
    }
    try {
      onRemoveMonth(month)
      showNotice('success', t('settings.monthRemoved'))
    } catch (err) {
      showNotice('error', monthErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-8 p-5">
      <header>
        <h2 className="text-xl font-bold text-ink">{t('settings.title')}</h2>
        <p className="text-sm text-ink-muted">{t('settings.subtitle')}</p>
      </header>

      {notice && (
        <FormNotice
          type={notice.type}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t('settings.language')}
        </h3>
        <div className="mt-3 flex gap-2">
          {(['ru', 'ka'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                locale === l
                  ? 'border-accent bg-accent text-white'
                  : 'border-grid bg-white hover:bg-paper-dark'
              }`}
              onClick={() => setLocale(l)}
            >
              {t(l === 'ru' ? 'locale.ru' : 'locale.ka')}
            </button>
          ))}
        </div>
      </section>

      {isAccountant && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            {t('settings.accounting')}
          </h3>
          <p className="mt-1 text-sm text-stone-500">{t('settings.passwordHint')}</p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (newPassword.trim().length < 4) {
                showNotice('error', t('settings.passwordShort'))
                return
              }
              onUpdateSettings({
                accountantPassword: newPassword.trim(),
                passwordChanged: true,
              })
              setNewPassword('')
              showNotice('success', t('settings.passwordSaved'))
            }}
          >
            <input
              type="password"
              className="min-w-[12rem] flex-1 rounded-md border border-grid px-3 py-2 text-sm"
              placeholder={t('settings.newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              {t('settings.savePassword')}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t('settings.brigades')}
        </h3>
        <p className="mt-1 text-sm text-stone-500">{t('settings.brigadesHint')}</p>

        <ul className="mt-4 space-y-2">
          {store.brigades.map((name) => (
            <li
              key={name}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-grid bg-paper/40 px-3 py-2"
            >
              {editingBrigade === name ? (
                <>
                  <input
                    className="min-w-[10rem] flex-1 rounded-md border border-grid px-2 py-1 text-sm"
                    value={editBrigadeName}
                    onChange={(e) => setEditBrigadeName(e.target.value)}
                    placeholder="RU"
                    autoFocus
                  />
                  <input
                    className="min-w-[10rem] flex-1 rounded-md border border-grid px-2 py-1 text-sm"
                    value={editBrigadeKa}
                    onChange={(e) => setEditBrigadeKa(e.target.value)}
                    placeholder="GE"
                  />
                  <button
                    type="button"
                    className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
                    onClick={() => saveBrigadeRename(name)}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-grid px-3 py-1 text-xs"
                    onClick={() => setEditingBrigade(null)}
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">
                    {name}
                    {store.brigadeNamesKa[name] && (
                      <span className="ml-2 text-xs text-stone-400">
                        / {store.brigadeNamesKa[name]}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-stone-400">
                    {brigadeEmployeeCount(store, name)} {t('settings.empCount')}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-grid px-2 py-1 text-xs hover:bg-paper-dark"
                    onClick={() => {
                      setEditingBrigade(name)
                      setEditBrigadeName(name)
                      setEditBrigadeKa(store.brigadeNamesKa[name] ?? '')
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveBrigade(name)}
                    disabled={store.brigades.length <= 1}
                  >
                    {t('common.delete')}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddBrigade} className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[14rem] flex-1 rounded-md border border-grid px-3 py-2 text-sm"
            placeholder={t('settings.newBrigade')}
            value={newBrigade}
            onChange={(e) => setNewBrigade(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            {t('settings.addBrigade')}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t('settings.backup')}
        </h3>
        <p className="mt-1 text-sm text-stone-500">{t('settings.backupHint')}</p>
        <p className="mt-1 text-xs text-stone-400">{t('settings.exportSecretsNote')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-grid px-3 py-2 text-sm hover:bg-paper-dark"
            onClick={() => exportToJson(store)}
          >
            JSON
          </button>
          <button
            type="button"
            className="rounded-lg border border-grid px-3 py-2 text-sm hover:bg-paper-dark"
            onClick={async () => {
              const ok = await saveBackupToFolder(store)
              if (!ok) showNotice('error', t('settings.backupFolder'))
            }}
          >
            {t('settings.backupFolder')}
          </button>
        </div>
        {dailyBackups.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-stone-600">
            {dailyBackups.map((b) => (
              <li key={b.date} className="flex items-center gap-2">
                <span>{b.date}</span>
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => {
                    const restored = restoreDailyBackup(b.date)
                    if (restored && confirm(tf('settings.restoreConfirm', { date: b.date }))) {
                      onReplaceStore(restored)
                    }
                  }}
                >
                  ↺
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(store.trash.employees.length > 0 || store.trash.months.length > 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            {t('settings.trash')}
          </h3>
          {store.trash.employees.map((item) => (
            <div key={item.deletedAt} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{item.employee.fullName}</span>
              <span className="text-xs text-stone-400">{item.deletedAt.slice(0, 10)}</span>
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                title={t('settings.trashRestore')}
                onClick={() => onRestoreTrashEmployee(item.deletedAt)}
              >
                {t('settings.trashRestore')}
              </button>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                title={t('settings.trashPurge')}
                onClick={() => {
                  if (confirm(t('settings.confirmPurgeTrash'))) {
                    onPurgeTrashEmployee(item.deletedAt)
                  }
                }}
              >
                {t('settings.trashPurge')}
              </button>
            </div>
          ))}
          {store.trash.months.map((item) => (
            <div key={item.deletedAt} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{formatMonthTitle(item.sheet.month, locale)}</span>
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                title={t('settings.trashRestore')}
                onClick={() => onRestoreTrashMonth(item.deletedAt)}
              >
                {t('settings.trashRestore')}
              </button>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                title={t('settings.trashPurge')}
                onClick={() => {
                  if (confirm(t('settings.confirmPurgeTrash'))) {
                    onPurgeTrashMonth(item.deletedAt)
                  }
                }}
              >
                {t('settings.trashPurge')}
              </button>
            </div>
          ))}
        </section>
      )}

      {store.auditLog.length > 0 && (
        <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            {t('settings.audit')}
          </h3>
          <div className="mt-3 max-h-48 overflow-auto text-xs">
            <table className="min-w-full">
              <tbody>
                {[...store.auditLog].reverse().slice(0, 50).map((e) => (
                  <tr key={e.id} className="border-t border-grid">
                    <td className="py-1 pr-2 whitespace-nowrap text-stone-400">
                      {e.at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-1">{e.action}</td>
                    <td className="py-1 text-stone-600">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t('settings.signatures')}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['masterRu', 'print.signMaster', 'RU'],
              ['masterKa', 'print.signMaster', 'GE'],
              ['accountantRu', 'print.signAccountant', 'RU'],
              ['accountantKa', 'print.signAccountant', 'GE'],
              ['directorRu', 'print.signDirector', 'RU'],
              ['directorKa', 'print.signDirector', 'GE'],
            ] as const
          ).map(([key, labelKey, lang]) => (
            <label key={key} className="text-xs font-medium text-stone-500">
              {t(labelKey)} ({lang})
              <input
                className="mt-1 w-full rounded-md border border-grid px-2 py-1.5 text-sm"
                value={signatures[key] ?? ''}
                onChange={(e) => patchSignatures({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-grid bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t('settings.months')}
        </h3>
        <p className="mt-1 text-sm text-stone-500">{t('settings.monthsHint')}</p>

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2">{t('settings.colMonth')}</th>
                <th className="px-3 py-2">{t('settings.colArchive')}</th>
                <th className="px-3 py-2 text-right">{t('settings.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const archived = isMonthArchived(store, month)
                return (
                  <tr key={month} className="border-t border-grid">
                    <td className="px-3 py-2 font-medium capitalize">
                      {formatMonthTitle(month, locale)}
                      {archived && (
                        <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-600">
                          {t('month.archive')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={archived}
                          onChange={(e) => onArchiveMonth(month, e.target.checked)}
                        />
                        {t('settings.archiveProtect')}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={archived}
                        title={
                          archived
                            ? t('settings.unarchiveToRemove')
                            : t('settings.removeMonthTitle')
                        }
                        onClick={() => handleRemoveMonth(month)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAddMonth} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-stone-500">
            {t('settings.newMonth')}
            <input
              type="month"
              className="mt-1 block rounded-md border border-grid px-3 py-2 text-sm"
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-grid bg-white px-4 py-2 text-sm font-semibold hover:bg-paper-dark"
          >
            {t('settings.addMonth')}
          </button>
        </form>
      </section>
    </div>
  )
}
