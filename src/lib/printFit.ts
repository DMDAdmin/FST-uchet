/** A4 альбом: высота и ширина печатной области (мм) */
const PAGE_H_MM = 210
const PAGE_W_MM = 297
const MARGIN_MM = 16
const MM_TO_PX = 96 / 25.4

export function fitPrintPages(container: HTMLElement | null): void {
  if (!container) return

  const maxHPx = (PAGE_H_MM - MARGIN_MM) * MM_TO_PX
  const maxWPx = (PAGE_W_MM - MARGIN_MM) * MM_TO_PX

  container.querySelectorAll<HTMLElement>('.print-sheet-page').forEach((page) => {
    page.style.removeProperty('zoom')
    page.classList.remove('print-scaled')

    const content = page.querySelector<HTMLElement>('.print-sheet-content')
    if (!content) return

    const h = page.scrollHeight
    const w = content.scrollWidth

    let scale = 1

    if (h > maxHPx) {
      scale = Math.min(scale, (maxHPx / h) * 0.98)
    }
    if (w > maxWPx) {
      scale = Math.min(scale, (maxWPx / w) * 0.98)
    }

    /* Заполнить лист, если контент мелкий (убирает пустоту снизу и справа) */
    const targetFill = 0.92
    if (h < maxHPx * targetFill && w < maxWPx * targetFill) {
      const scaleUp = Math.min(
        (maxHPx / h) * targetFill,
        (maxWPx / w) * targetFill,
        1.15,
      )
      scale = Math.max(scale, scaleUp)
    }

    if (Math.abs(scale - 1) < 0.02) return

    page.style.zoom = String(scale)
    page.classList.add('print-scaled')
  })
}

export function resetPrintFit(container: HTMLElement | null): void {
  if (!container) return
  container.querySelectorAll('.print-sheet-page').forEach((page) => {
    page.classList.remove('print-scaled')
    const el = page as HTMLElement
    el.style.removeProperty('zoom')
  })
}
