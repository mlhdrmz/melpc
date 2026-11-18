import type { ReactElement } from 'react'
import { partPriceLabel } from './format'
import { usePrices } from './PriceContext'

/** Bir parçanın en ucuz güncel fiyatı ya da neden fiyatı olmadığı; tek satır. */
export function PriceLine({
  partId,
  className = 'price-line',
  showCount = true
}: {
  partId: string
  className?: string
  /** "2 mağazada" bilgisi (dar yerlerde gizlenir). */
  showCount?: boolean
}): ReactElement {
  const { index, storeName, now } = usePrices()
  const label = partPriceLabel(index.get(partId), storeName, now, showCount)
  return (
    <span className={`${className} price-line--${label.tone}`}>
      <span className="price-line__text">{label.text}</span>
      {label.detail && <span className="price-line__detail"> · {label.detail}</span>}
    </span>
  )
}
