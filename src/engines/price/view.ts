import { computeTotals, isUsable, STALE_AFTER_MS, type Totals } from './totals'
import type { OfferRecord, StoreId, StoreMatch } from './types'

// Arayüzün gösterdiği fiyat bilgisi: her parça için onaylı mağazalardaki son fiyatlar, en ucuz mağaza ve durum.
// Kurallar (Melih onayladı, docs/asama-3-plan.md):
// - Gösterilen fiyat, fiyatı okunabilmiş son okumadır; okunduğu zamanla birlikte gösterilir.
// - Son okuma başarısızsa ya da fiyat 3 günden eskiyse fiyat "güncel değil" sayılır.
// - Toplamlara yalnızca son okuması başarılı, 3 günden yeni ve stokta olan fiyatlar katılır; okunamayan fiyat katılmaz.

export interface StorePrice {
  storeId: StoreId
  /** Onaylı ürün linki. */
  url: string
  /** Fiyatı okunabilmiş son okuma (yoksa null). */
  price: number | null
  inStock: boolean | null
  pricedAt: string | null
  /** Son deneme (başarılı ya da değil). */
  checkedAt: string | null
  /** Son deneme başarısızsa nedeni. */
  error?: string
  /** "Güncel değil": son okuma başarısız ya da fiyat 3 günden eski ya da hiç okunamadı. */
  stale: boolean
  /** Toplamlara katılır: son okuma başarılı, 3 günden yeni ve stokta. */
  usable: boolean
}

/**
 * priced: en az bir mağazada toplama katılabilen fiyat var.
 * noUsable: onaylı eşleşme var ama güncel ve stokta fiyat yok.
 * pending: onay bekleyen aday var.
 * notFound: bütün mağazalarda arandı, bulunamadı (ya da reddedildi).
 * unmatched: henüz eşleştirilmedi.
 */
export type PartPriceStatus = 'priced' | 'noUsable' | 'pending' | 'notFound' | 'unmatched'

export interface PartPrices {
  partId: string
  /** Onaylı mağazalar: toplama katılanlar ucuzdan pahalıya, sonra öbürleri. */
  stores: StorePrice[]
  best: StorePrice | null
  status: PartPriceStatus
}

export interface PriceIndex {
  get(partId: string): PartPrices
  /** partIds: toplamadaki parçalar (aynı disk iki kez seçildiyse iki kez). */
  totals(partIds: string[]): Totals
}

export interface PriceIndexInput {
  matches: StoreMatch[]
  latest: OfferRecord[]
  lastPriced: OfferRecord[]
  /** Mağaza sayısı: "bütün mağazalarda bulunamadı" kararı için. */
  storeCount: number
}

const key = (partId: string, storeId: StoreId): string => `${partId}|${storeId}`

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k)
  if (list) list.push(v)
  else m.set(k, [v])
}

export function buildPriceIndex(input: PriceIndexInput, now: number): PriceIndex {
  const matchesByPart = new Map<string, StoreMatch[]>()
  for (const m of input.matches) push(matchesByPart, m.partId, m)
  const latest = new Map(input.latest.map((o) => [key(o.partId, o.storeId), o]))
  const priced = new Map(input.lastPriced.map((o) => [key(o.partId, o.storeId), o]))
  // Toplamlar son okumalarla hesaplanır: son okuması başarısız (fiyatsız) olan mağaza toplama girmez.
  const latestByPart = new Map<string, OfferRecord[]>()
  for (const o of input.latest) push(latestByPart, o.partId, o)
  const cache = new Map<string, PartPrices>()

  const get = (partId: string): PartPrices => {
    const hit = cache.get(partId)
    if (hit) return hit
    const matches = matchesByPart.get(partId) ?? []
    const stores: StorePrice[] = matches
      .filter((m) => m.status === 'confirmed' && m.url)
      .map((m) => {
        const last = latest.get(key(partId, m.storeId))
        const p = priced.get(key(partId, m.storeId))
        const failed = Boolean(last && last.price === null)
        const old = !p || now - Date.parse(p.fetchedAt) > STALE_AFTER_MS
        return {
          storeId: m.storeId,
          url: m.url as string,
          price: p?.price ?? null,
          inStock: p?.inStock ?? null,
          pricedAt: p?.fetchedAt ?? null,
          checkedAt: last?.fetchedAt ?? null,
          ...(failed && last?.error ? { error: last.error } : {}),
          stale: failed || old,
          usable: Boolean(last && isUsable(last, now))
        }
      })
      .sort(
        (a, b) =>
          Number(b.usable) - Number(a.usable) ||
          (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY)
      )
    const best = stores.find((s) => s.usable) ?? null
    let status: PartPriceStatus
    if (best) status = 'priced'
    else if (stores.length) status = 'noUsable'
    else if (matches.some((m) => m.status === 'candidate')) status = 'pending'
    else if (
      matches.length >= input.storeCount &&
      matches.every((m) => m.status === 'notFound' || m.status === 'rejected')
    ) {
      status = 'notFound'
    } else status = 'unmatched'
    const out = { partId, stores, best, status }
    cache.set(partId, out)
    return out
  }

  return {
    get,
    totals: (partIds) => computeTotals(partIds, latestByPart, now)
  }
}

/** "29.256,56 TL" */
export function formatTl(n: number): string {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
}
