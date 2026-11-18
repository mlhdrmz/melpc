import type { OfferRecord, StoreId } from './types'

// Toplam hesapları. Kurallar (Melih onayladı):
// - 3 günden eski fiyat "güncel değil" sayılır ve toplamlara katılmaz.
// - Stokta olmayan ürün toplamlara katılmaz.

export const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export function isFresh(offer: OfferRecord, now: number): boolean {
  return offer.price !== null && now - Date.parse(offer.fetchedAt) <= STALE_AFTER_MS
}

/** Toplama girebilecek fiyat: güncel ve stokta. */
export function isUsable(offer: OfferRecord, now: number): boolean {
  return isFresh(offer, now) && offer.inStock === true
}

/** Bir parçanın mağazalardaki son okumalarından en ucuzu (güncel ve stokta olanlar arasında). */
export function bestOffer(offers: OfferRecord[], now: number): OfferRecord | null {
  let best: OfferRecord | null = null
  for (const o of offers) {
    if (!isUsable(o, now)) continue
    if (!best || (o.price as number) < (best.price as number)) best = o
  }
  return best
}

export interface Totals {
  /** Her parça en ucuz mağazasından. Fiyatı olmayan parça varsa yalnızca bulunanların toplamı. */
  cheapest: number
  /** Toplama giremeyen parçaların id'leri (güncel ve stokta fiyatı yok). */
  missing: string[]
  /** Bütün parçalar tek mağazada stoktaysa en ucuz tek mağaza toplamı. */
  singleStore: { storeId: StoreId; total: number } | null
}

/**
 * partIds: toplamadaki parçalar (aynı disk iki kez seçildiyse iki kez geçer).
 * latestOffers: parça → her mağazadaki son okuma.
 */
export function computeTotals(partIds: string[], latestOffers: Map<string, OfferRecord[]>, now: number): Totals {
  let cheapest = 0
  const missing: string[] = []
  for (const id of partIds) {
    const best = bestOffer(latestOffers.get(id) ?? [], now)
    if (best) cheapest += best.price as number
    else missing.push(id)
  }

  let singleStore: Totals['singleStore'] = null
  if (partIds.length) {
    const stores = new Set<StoreId>()
    for (const id of partIds) for (const o of latestOffers.get(id) ?? []) stores.add(o.storeId)
    for (const storeId of stores) {
      let total = 0
      let complete = true
      for (const id of partIds) {
        const o = (latestOffers.get(id) ?? []).find((x) => x.storeId === storeId)
        if (!o || !isUsable(o, now)) {
          complete = false
          break
        }
        total += o.price as number
      }
      if (complete && (!singleStore || total < singleStore.total)) singleStore = { storeId, total }
    }
  }
  return { cheapest, missing, singleStore }
}
