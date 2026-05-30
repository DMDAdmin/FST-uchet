import { BRAND } from '@/lib/brand'

type Variant = 'sidebar' | 'page' | 'print'

type Props = {
  variant?: Variant
  className?: string
}

export function FiberCellBrand({ variant = 'page', className = '' }: Props) {
  return (
    <div className={`fc-brand fc-brand--${variant} ${className}`.trim()}>
      <img
        src={BRAND.mark}
        alt=""
        aria-hidden
        className="fc-brand__mark"
      />
      <img
        src={BRAND.wordmark}
        alt="FiberCell"
        className="fc-brand__wordmark"
      />
    </div>
  )
}

export function PrintBrandWatermark() {
  return (
    <img
      src={BRAND.mark}
      alt=""
      aria-hidden
      className="print-fc-watermark"
    />
  )
}
