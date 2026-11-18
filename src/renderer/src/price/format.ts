import { STORE_IDS, type StoreId, type StoreMatch } from '@engines/price/types'
import { formatTl, type PartPrices, type StorePrice } from '@engines/price/view'

export { formatTl }

/** Fiyatların neyi kapsadığı (Melih onayladı); fiyat gösterilen her yerde yazılır. */
export const PRICE_NOTE =
  'Ürün sayfasındaki KDV dahil peşin fiyat. Kargo, sepet indirimi, kupon ve taksit farkı dahil değil. Son çekimde okunamayan, 3 günden eski ya da stokta olmayan fiyat toplama katılmaz.'

/** Fiyat geçmişi çizgisinde mağazanın rengi (tokens.css: --series-1..3). Yazıda kullanılmaz. */
export function seriesColor(storeId: StoreId): string {
  return `var(--series-${STORE_IDS.indexOf(storeId) + 1})`
}

const dateTime = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fullDateTime = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

/** "18.11 14:05" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** "18.11.2026 14:05" */
export function formatFullDateTime(iso: string): string {
  return fullDateTime.format(new Date(iso))
}

/** "az önce", "12 dk önce", "5 sa önce", 24 saatten eskiyse "16.11 09:30". */
export function formatWhen(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dk önce`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} sa önce`
  return formatDateTime(iso)
}

export function stockText(inStock: boolean | null): string {
  if (inStock === true) return 'Stokta'
  if (inStock === false) return 'Stokta yok'
  return 'Stok bilgisi yok'
}

export type Tone = 'ok' | 'warn' | 'muted'

export interface PriceLabel {
  text: string
  detail?: string
  tone: Tone
}

/** Parça listesinde ve seçme penceresinde tek satırlık fiyat bilgisi. */
export function partPriceLabel(
  pp: PartPrices,
  storeName: (id: StoreId) => string,
  now: number,
  showCount = true
): PriceLabel {
  switch (pp.status) {
    case 'priced': {
      const best = pp.best as StorePrice
      const others = pp.stores.filter((s) => s.usable).length - 1
      return {
        text: formatTl(best.price as number),
        detail: `${storeName(best.storeId)}${showCount && others > 0 ? ` · ${others + 1} mağazada` : ''}${best.stale ? ' · güncel değil' : ''}`,
        tone: best.stale ? 'warn' : 'ok'
      }
    }
    case 'noUsable': {
      const withPrice = pp.stores.filter((s) => s.price !== null)
      const fresh = withPrice.filter((s) => s.pricedAt && now - Date.parse(s.pricedAt) <= 3 * 24 * 3600_000)
      if (fresh.length && fresh.every((s) => s.inStock === false)) return { text: 'Stokta yok', tone: 'warn' }
      const last = [...withPrice].sort((a, b) => Date.parse(b.pricedAt as string) - Date.parse(a.pricedAt as string))[0]
      if (last) {
        return {
          text: 'Güncel değil',
          detail: `son fiyat ${formatTl(last.price as number)} · ${formatDateTime(last.pricedAt as string)}`,
          tone: 'warn'
        }
      }
      return { text: 'Fiyat okunamadı', tone: 'warn' }
    }
    case 'pending':
      return { text: 'Mağaza eşleşmesi onay bekliyor', tone: 'muted' }
    case 'notFound':
      return { text: 'Mağazalarda bulunamadı', tone: 'muted' }
    default:
      return { text: 'Mağazalarla eşleştirilmedi', tone: 'muted' }
  }
}

/** Onaylı eşleşmesi olmayan bir mağazanın durumu. */
export function matchStatusText(match: StoreMatch | undefined): string {
  switch (match?.status) {
    case 'candidate':
      return 'Eşleşme onay bekliyor'
    case 'notFound':
      return 'Bu mağazada bulunamadı'
    case 'rejected':
      return 'Eşleşme reddedildi'
    default:
      return 'Eşleştirilmedi'
  }
}
