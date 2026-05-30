import holidayData from '@/data/georgia-holidays.json'
import type { Locale } from './types'

export type GeorgiaHoliday = { date: string; name: string; nameKa?: string }

const BY_DATE = new Map<string, string>()
const BY_DATE_KA = new Map<string, string>()

/** Грузинские названия по русскому тексту из справочника */
const NAME_KA: Record<string, string> = {
  'Новый год': 'ახალი წელი',
  'Новый год (2-й день)': 'ახალი წელი (2-ე დღე)',
  'Рождество (православное)': 'შობა',
  'Крещение (Богоявление)': 'ნათლისღება',
  'День матери': 'დედის დღე',
  'Международный женский день': '8 მარტი',
  'День восстановления независимости': 'დამოუკიდებლობის აღდგენის დღე',
  'Страстная пятница': 'პარასკევი',
  'Пасха': 'აღდგომა',
  'Пасха (понедельник)': 'აღდგომის შემდეგი დღე',
  'День Победы': 'გამარჯვების დღე',
  'День святого Андрея': 'მოწმ. ანდრიას დღე',
  'День семьи и родительского почитания': 'ოჯახის დღე',
  'День независимости': 'დამოუკიდებლობის დღე',
  'Успение Пресвятой Богородицы': 'მარიამობა',
  'Светицховлоба (Мцхетоба)': 'სვეტიცხოვლობა',
  'День святого Георгия': 'გიორგობა',
}

for (const year of Object.values(holidayData)) {
  for (const h of year) {
    BY_DATE.set(h.date, h.name)
    BY_DATE_KA.set(h.date, NAME_KA[h.name] ?? h.name)
  }
}

export function isGeorgiaPublicHoliday(dateKey: string): boolean {
  return BY_DATE.has(dateKey)
}

export function georgiaHolidayName(dateKey: string, locale: Locale = 'ru'): string | null {
  if (locale === 'ka') return BY_DATE_KA.get(dateKey) ?? BY_DATE.get(dateKey) ?? null
  return BY_DATE.get(dateKey) ?? null
}

export function georgiaHolidayNameBilingual(dateKey: string): string | null {
  const ru = BY_DATE.get(dateKey)
  if (!ru) return null
  const ka = BY_DATE_KA.get(dateKey)
  return ka && ka !== ru ? `${ru} / ${ka}` : ru
}

export function holidaysInMonth(year: number, month: number): GeorgiaHoliday[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const list: GeorgiaHoliday[] = []
  for (const [date, name] of BY_DATE) {
    if (date.startsWith(prefix)) {
      list.push({ date, name, nameKa: BY_DATE_KA.get(date) })
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date))
}
