// Fiyat motorunun veri tipleri. Fiyatlar TL (KDV dahil peşin fiyat) olarak tutulur.
// Okunamayan fiyat tahmin edilmez: price null kalır ve arayüzde "güncel değil" görünür.

export const STORE_IDS = ['itopya', 'gaming', 'vatan'] as const
export type StoreId = (typeof STORE_IDS)[number]

/** Bir ürün sayfasından okunan kimlik ve fiyat bilgisi. */
export interface ParsedProduct {
  name?: string
  /** Üretici parça kodu (mağazanın sayfada gösterdiği). */
  mpn?: string
  /** EAN / GTIN. */
  gtin?: string
  /** Mağazanın kendi ürün kodu. */
  sku?: string
  /** KDV dahil fiyat (TL). Okunamazsa undefined. */
  price?: number
  currency?: string
  /** true = stokta, false = stokta değil / satışta değil, undefined = bilinmiyor. */
  inStock?: boolean
  /** schema.org availability değerinin son kısmı (InStock, OutOfStock, Discontinued ...). */
  availability?: string
}

/** Kaydedilmiş bir fiyat okuması. */
export interface OfferRecord {
  partId: string
  storeId: StoreId
  url: string
  /** null = bu okumada fiyat alınamadı. */
  price: number | null
  inStock: boolean | null
  /** ISO zaman. */
  fetchedAt: string
  /** Okuma başarısızsa nedeni (Türkçe). */
  error?: string
}

/** Katalog parçasının bir mağazadaki ürünle eşleşmesi. */
export type MatchStatus = 'candidate' | 'confirmed' | 'rejected' | 'notFound'

/** Üretici kodu karşılaştırmasının sonucu. */
export type CodeCheck = 'match' | 'mismatch' | 'missing'

export interface StoreMatch {
  partId: string
  storeId: StoreId
  status: MatchStatus
  /** Ürün sayfasının linki (notFound'da yok). */
  url?: string
  /** Aday sayfadan okunan bilgiler (Melih'e gösterilir). */
  product?: ParsedProduct
  codeCheck?: CodeCheck
  /** ISO zaman. */
  updatedAt: string
}
