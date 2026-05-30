import { employeeSearchText } from '@/i18n'
import { useMemo, useState } from 'react'
import { BilingualText } from '@/components/employee/BilingualText'
import { useI18n } from '@/context/I18nContext'
import type { Employee, EmploymentStatus, ScheduleType, ShiftMode } from '@/lib/types'

type Props = {
  employees: Employee[]
  brigades: string[]
  isAccountant: boolean
  onSave: (e: Employee) => void
  onRemove: (id: string) => void
}

const emptyForm = (brigades: string[]): Employee => ({
  id: '',
  fullName: '',
  nameKa: '',
  tabNumber: '',
  position: '',
  positionKa: '',
  brigade: brigades[0] ?? '',
  schedule: '2/2 11ч',
  group2x2: 'А',
  cycleStart: '2026-06-01',
  active: true,
  shiftMode: 'day',
  employmentStatus: 'active',
})

export function EmployeesPage({
  employees,
  brigades,
  isAccountant,
  onSave,
  onRemove,
}: Props) {
  const { t, employeeNameLines, employeePositionLines } = useI18n()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const filtered = useMemo(() => {
    const list = employees.filter((e) => showInactive || e.active)
    if (!q.trim()) return list
    const s = q.toLowerCase()
    return list.filter((e) => employeeSearchText(e).includes(s))
  }, [employees, q, showInactive])

  function openNew() {
    setEditing({ ...emptyForm(brigades), id: crypto.randomUUID() })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing?.fullName.trim()) return
    onSave(editing)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">{t('employees.title')}</h2>
          <p className="text-sm text-ink-muted">
            {t('employees.activeCount')}: {employees.filter((e) => e.active).length} ·{' '}
            {t('employees.totalCount')}: {employees.length}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          onClick={openNew}
        >
          {t('employees.add')}
        </button>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[14rem] flex-1 rounded-lg border border-grid bg-white px-3 py-2 text-sm"
          placeholder={t('employees.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('employees.showInactive')}
        </label>
      </div>

      <div className="overflow-auto rounded-xl border border-grid bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">{t('employees.colTab')}</th>
              <th className="px-3 py-2">{t('employees.colName')}</th>
              <th className="px-3 py-2">{t('employees.colPosition')}</th>
              <th className="px-3 py-2">{t('employees.colBrigade')}</th>
              <th className="px-3 py-2">{t('employees.colSchedule')}</th>
              <th className="px-3 py-2">{t('employees.status')}</th>
              <th className="px-3 py-2">{t('employees.colGroup')}</th>
              {isAccountant && <th className="px-3 py-2">{t('employees.colPay')}</th>}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isAccountant ? 9 : 8}
                  className="px-4 py-8 text-center text-sm text-stone-500"
                >
                  {t('employees.noSearchResults')}
                </td>
              </tr>
            ) : (
            filtered.map((emp) => (
              <tr key={emp.id} className="border-t border-grid hover:bg-paper/50">
                <td className="px-3 py-2 font-mono text-xs">{emp.tabNumber}</td>
                <td className="px-3 py-2 font-medium">
                  <BilingualText lines={employeeNameLines(emp)} />
                </td>
                <td className="max-w-[14rem] px-3 py-2 text-stone-600">
                  <BilingualText lines={employeePositionLines(emp)} />
                </td>
                <td className="px-3 py-2 text-xs">{emp.brigade || '—'}</td>
                <td className="px-3 py-2 text-xs">{emp.schedule}</td>
                <td className="px-3 py-2 text-xs">
                  {emp.employmentStatus === 'vacation'
                    ? t('employees.statusVacation')
                    : emp.employmentStatus === 'maternity'
                      ? t('employees.statusMaternity')
                      : emp.employmentStatus === 'terminated'
                        ? t('employees.statusTerminated')
                        : t('employees.statusActive')}
                  {emp.statusUntil ? ` (${emp.statusUntil})` : ''}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{emp.group2x2 || '—'}</td>
                {isAccountant && (
                  <td className="px-3 py-2 font-mono text-xs">
                    {emp.schedule === '5/2 8ч'
                      ? emp.monthlySalary
                        ? `${emp.monthlySalary.toLocaleString('ru-RU')} ₾`
                        : '—'
                      : emp.hourlyRate
                        ? `${emp.hourlyRate.toLocaleString('ru-RU')} ₾/ч`
                        : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => setEditing(emp)}
                  >
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold">
              {employees.some((e) => e.id === editing.id)
                ? t('employees.editTitle')
                : t('employees.newTitle')}
            </h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium text-stone-500">
                {t('employees.fieldNameRu')}
                <input
                  required
                  className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                  value={editing.fullName}
                  onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-stone-500">
                {t('employees.fieldNameKa')}
                <input
                  className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                  value={editing.nameKa ?? ''}
                  onChange={(e) => setEditing({ ...editing, nameKa: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.fieldTab')}
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.tabNumber}
                    onChange={(e) => setEditing({ ...editing, tabNumber: e.target.value })}
                  />
                </label>
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.fieldCycleStart')}
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.cycleStart}
                    onChange={(e) => setEditing({ ...editing, cycleStart: e.target.value })}
                  />
                </label>
              </div>
              <label className="text-xs font-medium text-stone-500">
                {t('employees.fieldPositionRu')}
                <input
                  className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                  value={editing.position}
                  onChange={(e) => setEditing({ ...editing, position: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-stone-500">
                {t('employees.fieldPositionKa')}
                <input
                  className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                  value={editing.positionKa ?? ''}
                  onChange={(e) => setEditing({ ...editing, positionKa: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-stone-500">
                {t('employees.fieldBrigade')}
                <select
                  className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                  value={editing.brigade}
                  onChange={(e) => setEditing({ ...editing, brigade: e.target.value })}
                >
                  <option value="">{t('employees.notAssigned')}</option>
                  {brigades.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.fieldSchedule')}
                  <select
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.schedule}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        schedule: e.target.value as ScheduleType,
                      })
                    }
                  >
                    <option value="5/2 8ч">5/2 8ч</option>
                    <option value="2/2 11ч">2/2 11ч</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.fieldGroup')}
                  <select
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.group2x2}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        group2x2: e.target.value as Employee['group2x2'],
                      })
                    }
                  >
                    <option value="">—</option>
                    <option value="А">А</option>
                    <option value="Б">Б</option>
                  </select>
                </label>
              </div>
              {editing.schedule === '2/2 11ч' && (
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.fieldShift')}
                  <select
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.shiftMode ?? 'day'}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        shiftMode: e.target.value as ShiftMode,
                      })
                    }
                  >
                    <option value="day">{t('employees.shiftDay')}</option>
                    <option value="night">{t('employees.shiftNight')}</option>
                  </select>
                </label>
              )}
              {isAccountant && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  {editing.schedule === '5/2 8ч' ? (
                    <label className="col-span-2 text-xs font-medium text-stone-600">
                      {t('employees.monthlySalary')}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                        value={editing.monthlySalary ?? ''}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            monthlySalary: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  ) : (
                    <label className="col-span-2 text-xs font-medium text-stone-600">
                      {t('employees.hourlyRate')}
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                        value={editing.hourlyRate ?? ''}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            hourlyRate: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => {
                    const active = e.target.checked
                    setEditing({
                      ...editing,
                      active,
                      employmentStatus: active
                        ? editing.employmentStatus === 'terminated'
                          ? 'active'
                          : editing.employmentStatus
                        : 'terminated',
                    })
                  }}
                />
                {t('employees.activeFlag')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.status')}
                  <select
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.employmentStatus ?? 'active'}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        employmentStatus: e.target.value as EmploymentStatus,
                        active: e.target.value !== 'terminated',
                      })
                    }
                  >
                    <option value="active">{t('employees.statusActive')}</option>
                    <option value="vacation">{t('employees.statusVacation')}</option>
                    <option value="maternity">{t('employees.statusMaternity')}</option>
                    <option value="terminated">{t('employees.statusTerminated')}</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-stone-500">
                  {t('employees.statusUntil')}
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-grid px-2 py-1.5"
                    value={editing.statusUntil ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, statusUntil: e.target.value || undefined })
                    }
                  />
                </label>
              </div>
              <label className="text-xs font-medium text-stone-500">
                {t('employees.photo')}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () =>
                      setEditing({
                        ...editing,
                        photoDataUrl: reader.result as string,
                      })
                    reader.readAsDataURL(file)
                  }}
                />
                {editing.photoDataUrl && (
                  <img
                    src={editing.photoDataUrl}
                    alt=""
                    className="mt-2 h-16 w-16 rounded object-cover"
                  />
                )}
              </label>
            </div>
            <div className="mt-6 flex justify-between gap-2">
              {employees.some((e) => e.id === editing.id) && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => {
                    if (confirm(t('employees.confirmDelete'))) {
                      onRemove(editing.id)
                      setEditing(null)
                    }
                  }}
                >
                  {t('common.delete')}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-grid px-4 py-2 text-sm"
                  onClick={() => setEditing(null)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
