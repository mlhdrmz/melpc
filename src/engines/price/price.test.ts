import { describe, expect, it } from 'vitest'
import { codesMatch, normalizeText, parsePrice } from './text'
import { isAllowed, parseRobots } from './robots'
import { availabilityToStock, productFromJsonLd } from './jsonld'
import { checkCode, findCandidates, scoreUrl } from './match'
import { bestOffer, computeTotals, STALE_AFTER_MS } from './totals'
import { canRunNow, nextAllowedAt, shouldAutoRun, WINDOW_MS } from './schedule'
import { codeFromText, normalizeStoreUrl, parseSitemap, STORES } from './stores'
import { buildPriceIndex, formatTl } from './view'
import type { OfferRecord } from './types'
import type { Part } from '../catalog/types'
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
  it('kod alanındaki model adını ya da barkodu kod saymaz', () => {
    const ld = (mpn: string): string =>
      `<script type="application/ld+json">{"@type":"Product","name":"X","mpn":"${mpn}","offers":{"price":"10"}}</script>`
    expect(STORES.itopya.parse(ld('RTX 5070 12G VENTUS 2X OC')).mpn).toBeUndefined()
    expect(STORES.itopya.parse(ld('0730143315289')).mpn).toBeUndefined()
    expect(STORES.itopya.parse(ld('100-000001084')).mpn).toBe('100-000001084')
    expect(STORES.gaming.parse('<div>Üretici Kodu</div><div>GEFORCE RTX 5070</div>').mpn).toBeUndefined()
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
  it('elle girilen linki mağaza biçimine getirir', () => {
    expect(normalizeStoreUrl(' http://itopya.com/amd-ryzen-7-9800x3d_u27208?utm_source=x#yorum ', STORES.itopya)).toBe(
      'https://www.itopya.com/amd-ryzen-7-9800x3d_u27208'
    )
    expect(normalizeStoreUrl('https://www.gaming.gen.tr/urun/542784/amd-ryzen-7-9800x3d/', STORES.gaming)).toBe(
      'https://www.gaming.gen.tr/urun/542784/amd-ryzen-7-9800x3d/'
    )
    // başka mağaza, ürün olmayan sayfa, link olmayan metin
    expect(normalizeStoreUrl('https://www.itopya.com/amd-ryzen-7-9800x3d_u27208', STORES.vatan)).toBeNull()
    expect(normalizeStoreUrl('https://www.itopya.com/islemci', STORES.itopya)).toBeNull()
    expect(normalizeStoreUrl('9800x3d', STORES.itopya)).toBeNull()
    expect(normalizeStoreUrl('javascript:alert(1)', STORES.itopya)).toBeNull()
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
  // Aşağıdaki linkler mağaza linklerinin biçimine benzetilmiş test girdileridir.
  const part = (category: Part['category'], brand: string, model: string, specs: Record<string, string> = {}, mpn?: string): Part => ({
    ...testPart(category, specs),
    brand,
    model,
    ...(mpn ? { mpn } : {})
  })
  const u = (slug: string): string => `https://x.com/${slug}_u1`

  it('kapasiteyi ayırır (1 TB ≠ 2 TB)', () => {
    const ssd = part('storage', 'Samsung', '990 Pro 2 TB')
    const urls = ['samsung-1tb-990-pro-nvme-m2-ssd', 'samsung-2tb-990-pro-nvme-m2-ssd', 'samsung-990-pro-4tb-pcie-ssd'].map(u)
    expect(findCandidates(ssd, urls).map((c) => c.url)).toEqual([urls[1]])
  })

  it('model sonekini ayırır (B850 ≠ B850M, 245K ≠ 245KF, B650-Plus ≠ B650-E, X870E-E ≠ X870E-A)', () => {
    expect(scoreUrl(part('motherboard', 'MSI', 'MAG B850 Tomahawk Max WiFi'), u('msi-mag-b850m-mortar-max-wifi-anakart'))).toBeNull()
    expect(scoreUrl(part('cpu', 'Intel', 'Core Ultra 5 245K'), u('intel-core-ultra-5-245kf-42ghz-islemci'))).toBeNull()
    expect(scoreUrl(part('motherboard', 'ASUS', 'TUF Gaming B650-Plus WiFi'), u('asus-tuf-gaming-b650-e-wifi-atx-anakart'))).toBeNull()
    const x870 = part('motherboard', 'ASUS', 'ROG Strix X870E-E Gaming WiFi')
    expect(scoreUrl(x870, u('asus-rog-strix-x870e-a-gaming-wifi7-anakart'))).toBeNull()
    expect(scoreUrl(x870, u('asus-rog-strix-x870e-e-gaming-wifi-ddr5-anakart'))).toBeGreaterThan(0.5)
  })

  it('başka markanın ürününü aday göstermez', () => {
    const ram = part('memory', 'Corsair', 'Vengeance DDR5-6000 CL30 32 GB (2×16 GB)')
    expect(scoreUrl(ram, u('kingston-32gb-2x16gb-beast-6000mhz-cl30-ddr5-ram'))).toBeNull()
  })

  it('bellek kitinde modül düzenine bakar (2×16 ≠ 1×32)', () => {
    const ram = part('memory', 'Kingston', 'FURY Beast DDR5-6000 CL30 32 GB (2×16 GB)')
    expect(scoreUrl(ram, u('kingston-32gb1x32gb-beast-6000-mhz-cl30-ddr5-single-kit-ram'))).toBeNull()
    expect(scoreUrl(ram, u('kingston-32gb2x16gb-beast-black-6000mhz-cl30-ddr5-dual-kit-ram'))).toBeGreaterThan(0.5)
  })

  it('paketleri geriye atar; "mini-itx" ve "8400mhz-oc" sürüm sayılmaz', () => {
    const gpu5080 = part('gpu', 'ASUS', 'TUF Gaming GeForce RTX 5080 16GB GDDR7 OC Edition', {}, 'TUF-RTX5080-O16G-GAMING')
    expect(findCandidates(gpu5080, [u('2li-paket-asus-tuf-rtx5080-o16g-gaming-16gb-ekran-karti-asus-psu')])).toEqual([])
    const itx = part('motherboard', 'ASUS', 'ROG Strix B850-I Gaming WiFi', { memoryType: 'DDR5' })
    expect(scoreUrl(itx, u('asus-rog-strix-b850-i-gaming-wifi-8400mhz-oc-ddr5-soket-am5-mini-itx-anakart'))).toBeGreaterThan(1)
  })

  it('DDR5 anakart ararken DDR4 sürümünü geriye atar', () => {
    const board = part('motherboard', 'MSI', 'PRO B760M-A WiFi', { memoryType: 'DDR5' })
    const urls = [u('msi-pro-b760m-a-wifi-5333mhzoc-ddr4-matx-anakart'), u('msi-pro-b760m-a-wifi-6800mhz-oc-ddr5-matx-anakart')]
    expect(findCandidates(board, urls).map((c) => c.url)).toEqual([urls[1], urls[0]])
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

describe('fiyat görünümü', () => {
  const now = Date.parse('2026-11-18T12:00:00Z')
  const at = (hoursAgo: number): string => new Date(now - hoursAgo * 3600_000).toISOString()
  const confirmed = (partId: string, storeId: OfferRecord['storeId']) =>
    ({ partId, storeId, status: 'confirmed', url: `https://${storeId}/${partId}`, updatedAt: at(100) }) as const
  const o = (partId: string, storeId: OfferRecord['storeId'], price: number | null, inStock: boolean | null, hoursAgo: number, error?: string): OfferRecord => ({
    partId,
    storeId,
    url: `https://${storeId}/${partId}`,
    price,
    inStock,
    fetchedAt: at(hoursAgo),
    ...(error ? { error } : {})
  })

  it('en ucuzu, güncel olmayanı ve stokta olmayanı ayırır', () => {
    const idx = buildPriceIndex(
      {
        matches: [confirmed('cpu', 'itopya'), confirmed('cpu', 'gaming'), confirmed('cpu', 'vatan')],
        // Gaming son çekimde okunamadı; Vatan'da stok yok.
        latest: [o('cpu', 'itopya', 1000, true, 2), o('cpu', 'gaming', null, null, 2, 'Zaman aşımı'), o('cpu', 'vatan', 900, false, 2)],
        lastPriced: [o('cpu', 'itopya', 1000, true, 2), o('cpu', 'gaming', 950, true, 26), o('cpu', 'vatan', 900, false, 2)],
        storeCount: 3
      },
      now
    )
    const p = idx.get('cpu')
    expect(p.status).toBe('priced')
    // Gaming'in dünkü fiyatı (3 günden yeni) hâlâ en ucuz; ama "güncel değil" diye işaretli.
    expect(p.best).toMatchObject({ storeId: 'gaming', price: 950, stale: true, error: 'Zaman aşımı' })
    expect(p.stores.map((s) => s.storeId)).toEqual(['gaming', 'itopya', 'vatan'])
    expect(p.stores[2]).toMatchObject({ usable: false, inStock: false, stale: false })
    expect(idx.totals(['cpu']).cheapest).toBe(950)
  })

  it('3 günden eski fiyat toplama girmez; eşleşme durumları', () => {
    const idx = buildPriceIndex(
      {
        matches: [
          confirmed('gpu', 'itopya'),
          { partId: 'ssd', storeId: 'itopya', status: 'candidate', url: 'https://x', updatedAt: at(1) },
          { partId: 'psu', storeId: 'itopya', status: 'notFound', updatedAt: at(1) },
          { partId: 'psu', storeId: 'gaming', status: 'rejected', updatedAt: at(1) },
          { partId: 'psu', storeId: 'vatan', status: 'notFound', updatedAt: at(1) },
          { partId: 'case', storeId: 'itopya', status: 'notFound', updatedAt: at(1) }
        ],
        latest: [o('gpu', 'itopya', 5000, true, 80)],
        lastPriced: [o('gpu', 'itopya', 5000, true, 80)],
        storeCount: 3
      },
      now
    )
    expect(idx.get('gpu')).toMatchObject({ status: 'noUsable', best: null, stores: [{ stale: true, usable: false }] })
    expect(idx.get('ssd').status).toBe('pending')
    expect(idx.get('psu').status).toBe('notFound')
    expect(idx.get('case').status).toBe('unmatched')
    expect(idx.get('yok').status).toBe('unmatched')
    expect(idx.totals(['gpu'])).toEqual({ cheapest: 0, missing: ['gpu'], singleStore: null })
  })

  it('TL biçimi', () => {
    expect(formatTl(29256.56)).toBe('29.256,56 TL')
    expect(formatTl(1250)).toBe('1.250,00 TL')
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
