import { productFromJsonLd } from './jsonld'
import { looksLikeCode } from './text'
import type { ParsedProduct, StoreId } from './types'

// Her mağaza için okuyucu (adaptör) ayarları. Ağ isteği yapmazlar; yalnızca hangi adreslerin
// okunacağını ve ürün sayfasının nasıl çözüleceğini bilirler (ağ işleri ana süreçte).

export interface StoreConfig {
  id: StoreId
  name: string
  homepage: string
  robotsUrl: string
  /** Site haritası (dizin ya da doğrudan ürün listesi). */
  sitemapUrl: string
  /** Dizindeki alt haritalardan hangileri ürün içeriyor. */
  isProductSitemap: (url: string) => boolean
  /** Bir linkin tek bir ürünün sayfası olup olmadığı. */
  isProductUrl: (url: string) => boolean
  /** Bu mağazaya iki istek arasındaki en kısa süre (ms). */
  delayMs: number
  parse: (html: string) => ParsedProduct
}

/** HTML'i düz metne çevirir (etiketler ve betikler atılır). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/** Sayfa metninde "Üretici Kodu: XXX" gibi bir satırdan kodu çıkarır. */
export function codeFromText(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const m = new RegExp(`${label}\\s*:?\\s*([A-Za-z0-9][A-Za-z0-9\\-/._]{3,40})`, 'i').exec(text)
    if (m) return m[1].replace(/[.,]$/, '')
  }
  return undefined
}

/** Yapılandırılmış veri; üretici kodu orada yoksa (ya da kod değil de model adıysa) sayfadaki etiketten. */
function withTextCode(html: string, labels: string[]): ParsedProduct {
  const p = productFromJsonLd(html) ?? {}
  if (p.mpn && !looksLikeCode(p.mpn)) delete p.mpn
  if (!p.mpn) {
    const code = codeFromText(htmlToText(html), labels)
    if (code && looksLikeCode(code)) p.mpn = code
  }
  return p
}

export const STORES: Record<StoreId, StoreConfig> = {
  itopya: {
    id: 'itopya',
    name: 'İtopya',
    homepage: 'https://www.itopya.com/',
    robotsUrl: 'https://www.itopya.com/robots.txt',
    sitemapUrl: 'https://www.itopya.com/sitemap.xml',
    isProductSitemap: (u) => /itopya_products_\d+\.xml$/i.test(u),
    // Ürünler "_u123", hazır sistemler "_h123" ile biter.
    isProductUrl: (u) => /_u\d+$/i.test(u),
    delayMs: 6000,
    parse: (html) => withTextCode(html, ['Üretici Kodu', 'Ürün Kodu'])
  },
  gaming: {
    id: 'gaming',
    name: 'Gaming.gen.tr',
    homepage: 'https://www.gaming.gen.tr/',
    robotsUrl: 'https://www.gaming.gen.tr/robots.txt',
    sitemapUrl: 'https://www.gaming.gen.tr/wp-sitemap.xml',
    isProductSitemap: (u) => /wp-sitemap-posts-product-\d+\.xml$/i.test(u),
    isProductUrl: (u) => /\/urun\/\d+\//i.test(u),
    delayMs: 6000,
    parse: (html) => withTextCode(html, ['Üretici Kodu'])
  },
  vatan: {
    id: 'vatan',
    name: 'Vatan Bilgisayar',
    homepage: 'https://www.vatanbilgisayar.com/',
    robotsUrl: 'https://www.vatanbilgisayar.com/robots.txt',
    sitemapUrl: 'https://www.vatanbilgisayar.com/sitemap.axd',
    isProductSitemap: () => true,
    isProductUrl: (u) => /\.html$/i.test(u),
    // Cloudflare hız sınırı var: çok yavaş gidilir.
    delayMs: 15000,
    parse: (html) => withTextCode(html, ['Üretici Kodu', 'Üretici Parça No', 'Model Kodu'])
  }
}

/**
 * Elle girilen ürün linkini mağazanın biçimine getirir: https, mağazanın alan adı, sorgu ve # kısmı atılmış.
 * Mağazanın ürün sayfası değilse null.
 */
export function normalizeStoreUrl(raw: string, store: StoreConfig): string | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = new URL(store.homepage).host
  if (u.host !== host && `www.${u.host}` !== host) return null
  u.protocol = 'https:'
  u.host = host
  u.search = ''
  u.hash = ''
  const s = u.toString()
  return store.isProductUrl(s) ? s : null
}

/** Site haritası XML'inden linkler; dizinse alt haritalar, değilse sayfalar. */
export function parseSitemap(xml: string): { isIndex: boolean; urls: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml)
  const urls: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) urls.push(m[1].replace(/&amp;/g, '&'))
  return { isIndex, urls }
}
