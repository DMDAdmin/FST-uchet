import type { DayCode } from '@/lib/types'

const STYLES: Record<string, string> = {
  '8': 'bg-emerald-50 text-emerald-800 font-semibold',
  '11': 'bg-sky-50 text-sky-800 font-semibold',
  'Н': 'bg-violet-50 text-violet-800 font-semibold',
  '22': 'bg-indigo-50 text-indigo-800 font-semibold',
  'В': 'bg-stone-100 text-stone-500',
  'ОТ': 'bg-amber-50 text-amber-800 font-semibold',
  'Б': 'bg-blue-50 text-blue-800 font-semibold',
  'X': 'bg-red-50 text-red-700 font-semibold',
  'ПР': 'bg-orange-50 text-orange-800 font-semibold',
  '': 'text-stone-300',
}

type Props = {
  code: DayCode
  mismatch?: boolean
  dimmed?: boolean
  hasComment?: boolean
  dataCell?: string
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  title?: string
}

export function DayCell({
  code,
  mismatch,
  dimmed,
  hasComment,
  dataCell,
  onClick,
  onContextMenu,
  title,
}: Props) {
  return (
    <button
      type="button"
      title={title}
      data-cell={dataCell}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative flex h-8 w-8 items-center justify-center font-mono text-xs transition-all hover:ring-2 hover:ring-accent/40 focus:outline-none focus:ring-2 focus:ring-accent ${
        STYLES[code] ?? STYLES['']
      } ${mismatch ? 'ring-2 ring-amber-400 ring-offset-1' : ''} ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      {code || '·'}
      {hasComment && (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
      )}
    </button>
  )
}
