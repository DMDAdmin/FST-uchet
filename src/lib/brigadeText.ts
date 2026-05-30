import type { Locale } from './types'

export function brigadeLabel(
  nameRu: string,
  namesKa: Record<string, string>,
  locale: Locale,
): string {
  const ka = namesKa[nameRu]?.trim()
  if (locale === 'ka') return ka || nameRu
  return nameRu
}

export function brigadeLines(
  nameRu: string,
  namesKa: Record<string, string>,
  locale: Locale,
): { primary: string; secondary?: string } {
  return { primary: brigadeLabel(nameRu, namesKa, locale) }
}
