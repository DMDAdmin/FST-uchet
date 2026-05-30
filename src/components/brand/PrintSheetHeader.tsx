import type { ReactNode } from 'react'
import { t, type Locale } from '@/i18n'
import { FiberCellBrand } from './FiberCellBrand'

type Props = {
  locale: Locale
  title: string
  site: string
  responsible?: string
  brigades: string[]
  children?: ReactNode
}

export function PrintSheetHeader({
  locale,
  title,
  site,
  responsible,
  brigades,
  children,
}: Props) {
  return (
    <header className="print-sheet-header">
      <div className="print-fc-header-row">
        <FiberCellBrand variant="print" />
        <div className="print-fc-header-text">
          <p className="print-org">{t(locale, 'print.sheetTitle')}</p>
          <h1 className="print-title">{title}</h1>
          <p className="print-meta">
            {t(locale, 'print.site')}: {site}
            {responsible
              ? ` · ${t(locale, 'print.responsible')}: ${responsible}`
              : ''}
          </p>
          <p className="print-meta print-brigades-list">
            {t(locale, 'print.brigadesLabel')}: {brigades.join(' · ')}
          </p>
        </div>
      </div>
      {children}
    </header>
  )
}
