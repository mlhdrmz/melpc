import { parsePrice } from './text'
import type { ParsedProduct } from './types'

// Ürün sayfalarındaki schema.org "Product" yapılandırılmış verisini (JSON-LD) okur.

type Json = Record<string, unknown>

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]
}

function isType(obj: Json, type: string): boolean {
  return asArray(obj['@type'] as string | string[]).some((t) => String(t).toLowerCase() === type.toLowerCase())
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number') return String(v)
  return undefined
}

/** Sayfadaki bütün JSON-LD nesneleri (@graph ve diziler açılmış). Bozuk bloklar atlanır. */
export function extractJsonLd(html: string): Json[] {
  const out: Json[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown
      const stack = asArray(data as Json | Json[])
      while (stack.length) {
        const item = stack.shift()
        if (!item || typeof item !== 'object') continue
        out.push(item)
        if (Array.isArray(item['@graph'])) stack.push(...(item['@graph'] as Json[]))
      }
    } catch {
      // bozuk JSON-LD bloğu: atla
    }
  }
  return out
}

/** schema.org availability → stokta mı. Bilinmeyen değerde undefined. */
export function availabilityToStock(availability: string | undefined): boolean | undefined {
  if (!availability) return undefined
  const v = availability.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase()
  if (['instock', 'limitedavailability', 'onlineonly', 'instoreonly'].includes(v)) return true
  if (['outofstock', 'soldout', 'discontinued', 'preorder', 'presale', 'backorder'].includes(v)) return false
  return undefined
}

/** Sayfadaki ilk "Product" nesnesinden kimlik, fiyat ve stok bilgisi. */
export function productFromJsonLd(html: string): ParsedProduct | null {
  const product = extractJsonLd(html).find((o) => isType(o, 'Product'))
  if (!product) return null
  const offers = asArray(product.offers as Json | Json[])
  const offer = offers[0] ?? {}
  const spec = asArray(offer.priceSpecification as Json | Json[])[0] ?? {}
  const rawPrice = str(offer.price) ?? str(spec.price) ?? str(offer.lowPrice)
  const availability = str(offer.availability)?.replace(/^https?:\/\/schema\.org\//i, '')
  return {
    name: str(product.name),
    mpn: str(product.mpn),
    gtin: str(product.gtin13) ?? str(product.gtin) ?? str(product.gtin12) ?? str(product.gtin14),
    sku: str(product.sku),
    price: parsePrice(rawPrice),
    currency: str(offer.priceCurrency) ?? str(spec.priceCurrency),
    inStock: availabilityToStock(availability),
    availability
  }
}
