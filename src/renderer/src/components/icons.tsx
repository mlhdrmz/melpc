import type { ReactElement } from 'react'
import type { CategoryId } from '@engines/catalog/types'

// Çip logosu ("A · Atölye") ve kategori simgeleri, design/kasa-topla-vitrin.html'deki çizimlerle aynı.

export function ChipLogo({ size = 26 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="chip-logo">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </svg>
  )
}

const CATEGORY_PATHS: Record<CategoryId, ReactElement> = {
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  motherboard: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="6" height="6" />
      <path d="M16.5 7v10M7 16.5h6" />
    </>
  ),
  memory: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="1" />
      <path d="M6 11v2M10 11v2M14 11v2M18 11v2M4 16v3M20 16v3" />
    </>
  ),
  gpu: (
    <>
      <rect x="2" y="7" width="20" height="10" rx="1.5" />
      <circle cx="8" cy="12" r="2.5" />
      <circle cx="16" cy="12" r="2.5" />
      <path d="M5 17v2" />
    </>
  ),
  storage: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="1" />
      <path d="M6 9v6M18 12h.01" />
    </>
  ),
  psu: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="10" cy="12" r="4" />
      <path d="M17 9v6" />
    </>
  ),
  case: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M9 6h6M12 17h.01" />
    </>
  ),
  cooler: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10c0-4 3-5 5-3M14 12c4 0 5 3 3 5M12 14c0 4-3 5-5 3M10 12c-4 0-5-3-3-5" />
    </>
  )
}

export function CategoryIcon({ category, size = 22 }: { category: CategoryId; size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="line-icon">
      {CATEGORY_PATHS[category]}
    </svg>
  )
}
