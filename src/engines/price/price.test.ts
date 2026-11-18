import { describe, expect, it } from 'vitest'
import { codesMatch, normalizeText, parsePrice } from './text'
import { isAllowed, parseRobots } from './robots'
import { availabilityToStock, productFromJsonLd } from './jsonld'
import { checkCode, findCandidates, scoreUrl } from './match'
import { bestOffer, computeTotals, STALE_AFTER_MS } from './totals'
import { canRunNow, nextAllowedAt, shouldAutoRun, WINDOW_MS } from './schedule'
import { codeFromText, parseSitemap, STORES } from './stores'
import type { OfferRecord } from './types'
import { testPart } from '../compat/testParts'

// Bu dosyadaki sayfa parçaları mağazaların gerçek sayfa yapısına benzetilmiş test girdileridir; fiyatlar test değeridir.

describe('metin', () => {
  it('Türkçe harfleri sadeleştirir', () => {
    expect(normalizeText('Önbellek Çekirdek İşlemci 2×16GB')).toBe('onbellek cekirdek islemci 2x16gb')
  })
  it('fiyatı farklı biçimlerden okur', () => {
    expect(parsePrice('29.256,56 TL')).toBe(29256.56)
    expect(parsePrice('29256.56')).toBe(29256.56)
    expect(parsePrice('31,899.00')).toBe(31899)
    expect(parsePrice('1.250')).toBe(1250)
    expect(parsePrice('')).toBeUndefined()
    expect(parsePrice('0')).toBeUndefined()
  })
  it('üretici kodlarını karşılaştırır', () => {
    expect(codesMatch('100-100001084WOF', '100100001084wof')).toBe(true)
    expect(codesMatch('WDS200T2X0E', 'WDS200T2X0E-00BCA0')).toBe(true)
    expect(codesMatch('100-100001084WOF', '100-000001084')).toBe(false)
    expect(codesMatch('B850', 'B850M')).toBe(false)
  })
})

describe('robots.txt', () => {
  const rules = parseRobots(`User-agent: *
Allow: /
Disallow: /arama/*
Disallow: /Urun/
Disallow: /*?page=*

User-agent: AhrefsBot
Disallow: /`)
  it('yasak yolları tanır', () => {
    expect(isAllowed(rules, '/arama/ryzen')).toBe(false)
    expect(isAllowed(rules, '/Urun/UrunOzellik')).toBe(false)
    expect(isAllowed(rules, '/islemciler?page=2')).toBe(false)
  })
  it('ürün sayfalarına izin verir', () => {
    expect(isAllowed(rules, '/amd-ryzen-7-9800x3d_u27208')).toBe(true)
    expect(isAllowed(rules, '/amd-ryzen-7-9800x3d.html')).toBe(true)
  })
  it('başka botların kuralları bizi bağlamaz', () => {
    expect(isAllowed(parseRobots('User-agent: AhrefsBot\nDisallow: /'), '/x')).toBe(true)
  })
})

describe('yapılandırılmış veri (JSON-LD)', () => {
  const page = `<html><head>
<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"AMD Ryzen 7 9800X3D Tray İşlemci","sku":"27208","mpn":"100-000001084",
"offers":{"@type":"Offer","priceCurrency":"TRY","price":"29256.56","availability":"https://schema.org/InStock"}}</script>
</head></html>`
  it('ürün adını, kodu, fiyatı ve stoğu okur', () => {
    expect(productFromJsonLd(page)).toEqual({
      name: 'AMD Ryzen 7 9800X3D Tray İşlemci',
      mpn: '100-000001084',
      gtin: undefined,
      sku: '27208',
      price: 29256.56,
      currency: 'TRY',
      inStock: true,
      availability: 'InStock'
    })
  })
  it('priceSpecification içindeki fiyatı da okur', () => {
    const p = productFromJsonLd(`<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"X","gtin":"0730143315289",
      "offers":[{"@type":"Offer","priceSpecification":[{"price":"31899.00","priceCurrency":"TRY"}],"availability":"https://schema.org/Discontinued"}]}]}</script>`)
    expect(p?.price).toBe(31899)
    expect(p?.inStock).toBe(false)
    expect(p?.gtin).toBe('0730143315289')
  })
  it('ürün verisi yoksa null; bozuk blok sayfayı bozmaz', () => {
    expect(productFromJsonLd('<script type="application/ld+json">{bozuk</script>')).toBeNull()
  })
  it('stok durumlarını çevirir', () => {
    expect(availabilityToStock('https://schema.org/OutOfStock')).toBe(false)
    expect(availabilityToStock('InStock')).toBe(true)
    expect(availabilityToStock('Bilinmeyen')).toBeUndefined()
  })
  it('kodu sayfa metninden de bulur', () => {
    expect(codeFromText('Marka AMD Üretici Kodu 100-100001084WOF EAN 0730143315289', ['Üretici Kodu'])).toBe('100-100001084WOF')
    const gg = STORES.gaming.parse('<div>Üretici Kodu</div><div>100-100001084WOF</div>')
    expect(gg.mpn).toBe('100-100001084WOF')
  })
})

describe('site haritası', () => {
  it('dizini ve ürün listesini ayırır', () => {
    expect(parseSitemap('<sitemapindex><sitemap><loc>https://a/x_1.xml</loc></sitemap></sitemapindex>')).toEqual({
      isIndex: true,
      urls: ['https://a/x_1.xml']
    })
    expect(parseSitemap('<urlset><url><loc> https://a/p.html?a=1&amp;b=2 </loc></url></urlset>').urls).toEqual([
      'https://a/p.html?a=1&b=2'
    ])
  })
  it('mağaza ürün linklerini tanır', () => {
    expect(STORES.itopya.isProductUrl('https://www.itopya.com/amd-ryzen-7-9800x3d-islemci_u27208')).toBe(true)
    expect(STORES.itopya.isProductUrl('https://www.itopya.com/kartal-sistem_h32819')).toBe(false)
    expect(STORES.gaming.isProductUrl('https://www.gaming.gen.tr/urun/542784/amd-ryzen-7-9800x3d/')).toBe(true)
    expect(STORES.vatan.isProductUrl('https://www.vatanbilgisayar.com/amd-ryzen-7-9800x3d.html')).toBe(true)
  })
})

describe('aday bulma', () => {
  const cpu = { ...testPart('cpu', {}), brand: 'AMD', model: 'Ryzen 7 9800X3D', mpn: '100-100001084WOF' }
  const gpu = { ...testPart('gpu', {}), brand: 'MSI', model: 'GeForce RTX 5070 12G Ventus 2X OC' }
  it('anahtar kelimesi (model numarası) olmayan linki elemez', () => {
    expect(scoreUrl(cpu, 'https://x.com/amd-ryzen-7-9700x-islemci_u1')).toBeNull()
  })
  it('hazır sistemleri ve farklı sürümleri geriye atar', () => {
    const urls = [
      'https://x.com/kartal-sistem-amd-ryzen-7-9800x3d-rtx-5070-masaustu-bilgisayar_u5',
      'https://x.com/amd-ryzen-7-9800x3d-tray-islemci_u2',
      'https://x.com/amd-ryzen-7-9800x3d-47ghz-am5-islemci_u3'
    ]
    expect(findCandidates(cpu, urls).map((c) => c.url)).toEqual([urls[2], urls[1]])
  })
  it('5070 ararken 5070 Ti linkini öne almaz', () => {
    const urls = [
      'https://x.com/msi-geforce-rtx-5070-ti-16g-ventus-3x-oc_u8',
      'https://x.com/msi-geforce-rtx-5070-12g-ventus-2x-oc-ekran-karti_u9'
    ]
    expect(findCandidates(gpu, urls)[0].url).toBe(urls[1])
  })
  it('linkte üretici kodu varsa öne alır', () => {
    const urls = ['https://x.com/amd-ryzen-7-9800x3d-islemci_u1', 'https://x.com/amd-ryzen-7-9800x3d-100-100001084wof_u2']
    expect(findCandidates(cpu, urls)[0].url).toBe(urls[1])
  })
  it('üretici kodu karşılaştırması', () => {
    expect(checkCode(cpu, { mpn: '100-100001084WOF' })).toBe('match')
    expect(checkCode(cpu, { mpn: '100-000001084' })).toBe('mismatch')
    expect(checkCode(cpu, {})).toBe('missing')
  })
})

describe('toplamlar', () => {
  const now = Date.parse('2026-11-18T12:00:00Z')
  const at = (hoursAgo: number): string => new Date(now - hoursAgo * 3600_000).toISOString()
  const offer = (partId: string, storeId: OfferRecord['storeId'], price: number | null, inStock: boolean | null, hoursAgo = 1): OfferRecord => ({
    partId,
    storeId,
    url: `https://${storeId}/${partId}`,
    price,
    inStock,
    fetchedAt: at(hoursAgo)
  })
  it('en ucuz güncel ve stokta olanı seçer', () => {
    const offers = [offer('a', 'itopya', 100, true), offer('a', 'gaming', 90, false), offer('a', 'vatan', 95, true, 80)]
    expect(bestOffer(offers, now)?.storeId).toBe('itopya')
  })
  it('3 günden eski fiyat toplama girmez', () => {
    expect(bestOffer([offer('a', 'vatan', 95, true, STALE_AFTER_MS / 3600_000 + 1)], now)).toBeNull()
  })
  it('en ucuz kombinasyon ve tek mağaza toplamı', () => {
    const latest = new Map<string, OfferRecord[]>([
      ['cpu', [offer('cpu', 'itopya', 1000, true), offer('cpu', 'gaming', 900, true)]],
      ['gpu', [offer('gpu', 'itopya', 2000, true), offer('gpu', 'gaming', 2100, true)]],
      ['ssd', [offer('ssd', 'itopya', 300, true), offer('ssd', 'gaming', null, null)]]
    ])
    const t = computeTotals(['cpu', 'gpu', 'ssd', 'ssd'], latest, now)
    expect(t.cheapest).toBe(900 + 2000 + 300 + 300)
    expect(t.missing).toEqual([])
    // Gaming'de SSD fiyatı okunamadı → tek mağaza yalnızca İtopya
    expect(t.singleStore).toEqual({ storeId: 'itopya', total: 1000 + 2000 + 300 + 300 })
  })
  it('fiyatı olmayan parça eksik listesine girer', () => {
    const t = computeTotals(['cpu', 'yok'], new Map([['cpu', [offer('cpu', 'itopya', 1000, true)]]]), now)
    expect(t).toEqual({ cheapest: 1000, missing: ['yok'], singleStore: null })
  })
})

describe('çekim sınırı', () => {
  const now = Date.parse('2026-11-18T12:00:00Z')
  const ago = (h: number): string => new Date(now - h * 3600_000).toISOString()
  it('hiç çekim yoksa otomatik çeker', () => {
    expect(shouldAutoRun([], now)).toBe(true)
  })
  it('12 saatten yeni çekim varsa otomatik çekmez', () => {
    expect(shouldAutoRun([ago(3)], now)).toBe(false)
    expect(shouldAutoRun([ago(13)], now)).toBe(true)
  })
  it('24 saatte en fazla 2 çekim', () => {
    expect(canRunNow([ago(1), ago(20)], now)).toBe(false)
    expect(canRunNow([ago(1), ago(25)], now)).toBe(true)
    expect(nextAllowedAt([ago(1), ago(20)], now)).toBe(Date.parse(ago(20)) + WINDOW_MS)
  })
})
