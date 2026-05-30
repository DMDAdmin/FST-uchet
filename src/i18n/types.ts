export type Locale = 'ru' | 'ka'

export type Dict = Record<string, string>

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'ka', label: 'ქართული' },
]
