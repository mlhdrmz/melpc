// Katalog motorunun veri tipleri.
// Kural: her teknik özelliğin bir kaynağı vardır; kaynağı olmayan değer kataloğa girmez.
// Bilinmeyen değer `null` olarak tutulur ve arayüzde "bilinmiyor" görünür.

export const CATEGORY_IDS = [
  'cpu',
  'motherboard',
  'memory',
  'gpu',
  'storage',
  'psu',
  'case',
  'cooler'
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

/** Bir bilginin alındığı yer. */
export interface SourceRef {
  url: string
  /** Bilginin alındığı tarih, YYYY-AA-GG. */
  retrieved: string
  title?: string
}

export type RadiatorPosition = 'front' | 'top' | 'rear' | 'bottom' | 'side'

/**
 * Kasada bir radyatör yeri. Üretici ya boyları tek tek sayar (sizesMm) ya da yalnızca en büyük boyu verir
 * ("up to 420 mm" → maxMm). İkisinden en az biri bulunur.
 */
export interface RadiatorMount {
  position: RadiatorPosition
  /** Bu yere takılabilen radyatör boyları (mm), ör. [240, 280, 360]. */
  sizesMm?: number[]
  /** Üreticinin yalnızca en büyük boyu verdiği durumda o boy (mm). */
  maxMm?: number
}

/** Konnektör adı → adet, ör. { "8-pin": 2, "16-pin": 1 }. */
export type ConnectorMap = Record<string, number>

export type SpecValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | ConnectorMap
  | RadiatorMount[]

/** JSON dosyasındaki bir teknik özellik. */
export interface SpecEntry {
  /** null = bilinmiyor. */
  value: SpecValue | null
  /** `sources` içindeki anahtar. value null değilse zorunlu. */
  source?: string
  note?: string
}

/** JSON dosyasındaki bir parça kaydı. */
export interface PartRecord {
  id: string
  category: CategoryId
  brand: string
  model: string
  /** Üretici parça kodu (MPN); mağazalarda eşleştirmede kullanılır. */
  mpn?: string
  sources: Record<string, SourceRef>
  specs: Record<string, SpecEntry>
  /** YYYY-AA-GG */
  addedAt: string
  /** YYYY-AA-GG */
  updatedAt: string
}

/** Kaynağı çözülmüş teknik özellik. */
export interface ResolvedSpec {
  value: SpecValue | null
  source: SourceRef | null
  note?: string
}

/** Motorların ve arayüzün kullandığı parça. */
export interface Part {
  id: string
  category: CategoryId
  brand: string
  model: string
  mpn?: string
  specs: Record<string, ResolvedSpec>
  addedAt: string
  updatedAt: string
}

export interface CatalogLoadError {
  file: string
  partId?: string
  message: string
}
