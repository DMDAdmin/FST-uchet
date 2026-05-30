import { useEffect, useMemo } from 'react'
import { useAiAssistant } from '@/context/AiAssistantContext'
import { createAiExecutor } from '@/lib/ai/executor'
import type { AppStore, DayCode, ScheduleType, ViewId } from '@/lib/types'

type Props = {
  store: AppStore
  view: ViewId
  activeMonth: string
  onNavigate: (view: ViewId) => void
  onOpenMonth: (month: string) => void
  onPostWarehouseDoc: (doc: {
    type: 'receipt' | 'issue'
    number: string
    date: string
    warehouseId: string
    counterparty?: string
    brigade?: string
    comment?: string
    lines: { itemId: string; quantity: number }[]
  }) => void
  onSetMarksRange: (
    month: string,
    rowId: string,
    fromDay: number,
    toDay: number,
    mode: 'plan' | 'fact',
    code: DayCode,
  ) => void
  onSetMark: (
    month: string,
    rowId: string,
    dateKey: string,
    mode: 'plan' | 'fact',
    code: DayCode,
  ) => void
  onAssignPermanentToBrigade: (month: string, employeeId: string, brigade: string) => boolean
  onReplaceInBrigade: (
    month: string,
    brigade: string,
    fromEmployeeId: string,
    toEmployeeId: string,
  ) => boolean
  onSwapEmployeeRows: (month: string, employeeIdA: string, employeeIdB: string) => boolean
  onChangeScheduleFromDay: (
    month: string,
    employeeId: string,
    fromDay: number,
    schedule: ScheduleType,
  ) => boolean
}

export function AppAiBridge({
  store,
  view,
  activeMonth,
  onNavigate,
  onOpenMonth,
  onPostWarehouseDoc,
  onSetMarksRange,
  onSetMark,
  onAssignPermanentToBrigade,
  onReplaceInBrigade,
  onSwapEmployeeRows,
  onChangeScheduleFromDay,
}: Props) {
  const { registerExecutor } = useAiAssistant()

  const executor = useMemo(
    () =>
      createAiExecutor({
        store,
        view,
        activeMonth,
        onNavigate,
        onOpenMonth,
        onPostWarehouseDoc,
        onSetMarksRange,
        onSetMark,
        onAssignPermanentToBrigade,
        onReplaceInBrigade,
        onSwapEmployeeRows,
        onChangeScheduleFromDay,
      }),
    [
      store,
      view,
      activeMonth,
      onNavigate,
      onOpenMonth,
      onPostWarehouseDoc,
      onSetMarksRange,
      onSetMark,
      onAssignPermanentToBrigade,
      onReplaceInBrigade,
      onSwapEmployeeRows,
      onChangeScheduleFromDay,
    ],
  )

  useEffect(() => registerExecutor(executor), [registerExecutor, executor])

  return null
}
