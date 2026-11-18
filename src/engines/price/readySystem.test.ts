import { describe, expect, it } from 'vitest'
import type { CategoryId, Part } from '../catalog/types'
import { testPart } from '../compat/testParts'
import { scoreText, scoreUrl, TEXT_MATCH_MIN } from './match'
import {
  categoryFromLabel,
  isLikelyCode,
  matchSystemLine,
  matchSystemLines,
  parseGamingSystem,
  parseItopyaSystem,
  summarizeReadySystem,
  type LineMatch,
  type ReadySystemLine
} from './readySystem'
import { STORES, normalizeStoreUrl, storeForUrl } from './stores'
import type { Totals } from './totals'

// Sayfa parçaları mağazaların gerçek sayfa yapısına benzetilmiş test girdileridir; ürün kodları ve fiyatlar test değeridir.

const ITOPYA = 'https://www.itopya.com/'
const GAMING = 'https://www.gaming.gen.tr/'

const cpu: Part = { ...testPart('cpu', {}, 'cpu1'), brand: 'AMD', model: 'Ryzen 7 9800X3D', mpn: 'TEST-CPU-0001' }
const gpu: Part = { ...testPart('gpu', {}, 'gpu1'), brand: 'MSI', model: 'GeForce RTX 5070 12G Ventus 2X OC', mpn: 'TEST-GPU-0001' }
const ram: Part = {
  ...testPart('memory', {}, 'ram1'),
  brand: 'G.Skill',
  model: 'Flare X5 DDR5-6000 CL30 32 GB (2×16 GB)',
  mpn: 'TEST-RAM-6000-2X16'
}
const cooler: Part = { ...testPart('cooler', {}, 'cool1'), brand: 'Thermalright', model: 'Peerless Assassin 120 SE' }
const pc: Part = { ...testPart('case', {}, 'case1'), brand: 'Lian Li', model: 'Lancool 216' }
const parts = [cpu, gpu, ram, cooler, pc]

const card = (o: { active?: boolean; label: string; code?: string; href?: string; name: string }): string => `
  <div class="product-card${o.active ? ' active' : ''}" data-ana-urun="True" data-fiyat="1.00"${o.code ? ` data-stok-kodu="${o.code}"` : ''} data-kategori-adi="${o.label}">
    <div class="product-card-header">
      <a class="image" href="javascript:;"><img src="x.png" alt="" /></a>
      ${o.href ? `<a href="${o.href}" target="_blank" class="product-href"> Ürüne Git </a>` : ''}
    </div>
    <div class="product-card-body"><a class="name secLink" href="javascript:;"><h3 class="x">${o.name}</h3></a></div>
  </div>`

const itopyaPage = `<html><head>
  <script type="application/ld+json">{"@context":"http://schema.org","@type":"Product","name":"TEST SİSTEM &#8211; ECO","offers":{"@type":"Offer","priceCurrency":"TRY","price":"45.678,90"}}</script>
  </head><body>
  ${card({ active: true, label: 'İşlemci', code: 'TEST-CPU-0001', href: '/amd-ryzen-7-9800x3d-islemci_u1', name: 'AMD Ryzen 7 9800X3D 4.7GHz 96MB Önbellek 8 Çekirdek AM5 İşlemci' })}
  ${card({ label: 'İşlemci', code: 'TEST-CPU-0002', href: '/amd-ryzen-5-7600-islemci_u2', name: 'AMD Ryzen 5 7600 İşlemci' })}
  ${card({ active: true, label: 'Anakart', code: 'A620M H', href: '/gigabyte-a620m-h_u5', name: 'GIGABYTE A620M H DDR5 mATX Anakart' })}
  ${card({ active: true, label: 'Ekran Kartı', code: 'GV-TEST 99', href: '/msi-geforce-rtx-5070-12g-ventus-2x-oc-plus_u3', name: 'MSI GeForce RTX 5070 12G VENTUS 2X OC PLUS 12GB GDDR7 Ekran Kartı' })}
  ${card({ active: true, label: 'Bilgisayar Kasaları', href: '/lian-li-lancool-216-bilgisayar-kasasi_u7', name: 'Lian Li Lancool 216 Mesh Mid Tower Bilgisayar Kasası' })}
  ${card({ active: true, label: 'Kasa Fanları', code: 'FAN-TEST1', name: 'Test Fan 120mm &amp; Hub' })}
  ${card({ label: 'Monitör', name: 'Test Monitör' })}
  </body></html>`

const gamingRow = (label: string, name: string, href?: string): string => `
  <tr>
    <td class="beta-parts-col-image"><a href="${href ?? '#'}" aria-label="${label}"><img src="x.png" /></a></td>
    <td class="beta-parts-col-component" data-label="Bileşen"><a href="#component_1" class="beta-parts-component-link" aria-label="${label} bölümüne git">${label}</a></td>
    <td data-label="Model"><a${href ? ` href="${href}"` : ''} target="_blank" rel="noopener noreferrer" class="beta-parts-model-link"> ${name} </a></td>
  </tr>`

const gamingPage = `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},{"@type":"Product","name":"TEST-5070 / Sistem Tavsiyesi","offers":[{"@type":"Offer","price":"103999.00","priceCurrency":"TRY","availability":"https://schema.org/InStock"}]}]}</script>
  </head><body>
  <table class="beta-parts-table"><thead><tr><th>Bileşen</th><th>Model</th></tr></thead><tbody>
  ${gamingRow('MONTAJ VE KARGO SEÇENEKLERİ', 'Standart Montaj (3 iş günü)', `${GAMING}urun/1/standart-montaj/`)}
  ${gamingRow('İŞLEMCİ', 'AMD Ryzen 7 9800X3D 4.70GHz 8 Çekirdek İşlemci', `${GAMING}urun/2/amd-ryzen-7-9800x3d-tray-islemci/`)}
  ${gamingRow('EKRAN KARTI', 'MSI GeForce RTX 5070 12G VENTUS 2X OC 12GB GDDR7 192 Bit Ekran Kartı (TEST-GPU-CODE1)', `${GAMING}urun/3/msi-geforce-rtx-5070-12g-ventus-2x-oc/`)}
  ${gamingRow('RAM', 'G.Skill Flare X5 32GB (2x16GB) 6000MHz CL30 DDR5 Ram (TEST-RAM-6000-2X16) - 2 Yıl Garanti', `${GAMING}urun/4/g-skill-flare-x5/`)}
  ${gamingRow('İŞLEMCİ SOĞUTUCU', 'Thermalright Assassin X 120 Refined SE AMD Hava Soğutucu', `${GAMING}urun/5/thermalright-assassin-x-120/`)}
  ${gamingRow('GÜÇ KAYNAĞI', 'Test PSU 650W 80+ Bronze (TP650W) – 2 Yıl Garanti', 'https://baska-site.example/psu')}
  </tbody></table>
  <table><tbody>${gamingRow('SSD', 'Başka tablodaki satır')}</tbody></table>
  </body></html>`

describe('hazır sistem: bileşen türü', () => {
  it('mağazanın bileşen adından kategori', () => {
    const cases: [string, string | undefined][] = [
      ['İşlemci', 'cpu'],
      ['İŞLEMCİ SOĞUTUCU', 'cooler'],
      ['İşlemci Soğutucular', 'cooler'],
      ['Anakart', 'motherboard'],
      ['Ekran Kartı', 'gpu'],
      ['RAM(Bellek)', 'memory'],
      ['RAM', 'memory'],
      ['SSD', 'storage'],
      ['Sabit Disk', 'storage'],
      ['HDD', 'storage'],
      ['GÜÇ KAYNAĞI', 'psu'],
      ['Güç Kaynakları', 'psu'],
      ['Bilgisayar Kasaları', 'case'],
      ['KASA', 'case'],
      ['Kasa Fanları', undefined],
      ['MONTAJ VE KARGO SEÇENEKLERİ', undefined],
      ['KABLOLAMA SEÇENEKLERİ', undefined],
      ['İşletim Sistemi', undefined],
      ['Monitör', undefined]
    ]
    for (const [label, category] of cases) expect([label, categoryFromLabel(label)]).toEqual([label, category])
  })

  it('ölçüleri ve boşluklu adları kod saymaz', () => {
    expect(isLikelyCode('GR165600U46RGB')).toBe(true)
    expect(isLikelyCode('EMP700W')).toBe(true)
    expect(isLikelyCode('100-100001015BOX')).toBe(true)
    expect(isLikelyCode('1x16GB')).toBe(false)
    expect(isLikelyCode('650W')).toBe(false)
    expect(isLikelyCode('A620M H')).toBe(false)
    expect(isLikelyCode('12345678')).toBe(false)
  })
})

describe('hazır sistem: İtopya sayfası', () => {
  const s = parseItopyaSystem(itopyaPage, ITOPYA)

  it('sistemin adı ve fiyatı; stok bilgisi yoksa boş', () => {
    expect(s.name).toBe('TEST SİSTEM – ECO')
    expect(s.price).toBe(45678.9)
    expect(s.inStock).toBeUndefined()
  })

  it('yalnızca seçili ("active") kartlar sistemin parçasıdır', () => {
    expect(s.lines.map((l) => [l.label, l.category ?? null])).toEqual([
      ['İşlemci', 'cpu'],
      ['Anakart', 'motherboard'],
      ['Ekran Kartı', 'gpu'],
      ['Bilgisayar Kasaları', 'case'],
      ['Kasa Fanları', null]
    ])
    expect(s.lines[0]).toEqual({
      label: 'İşlemci',
      category: 'cpu',
      name: 'AMD Ryzen 7 9800X3D 4.7GHz 96MB Önbellek 8 Çekirdek AM5 İşlemci',
      code: 'TEST-CPU-0001',
      url: 'https://www.itopya.com/amd-ryzen-7-9800x3d-islemci_u1'
    })
    // Boşluklu stok kodu (model adı) kod sayılmaz; karakter kodları çözülür.
    expect(s.lines[1].code).toBeUndefined()
    expect(s.lines[4]).toMatchObject({ name: 'Test Fan 120mm & Hub', code: 'FAN-TEST1' })
  })

  it('katalogla eşleştirme: kod, ad, sürüm farkı', () => {
    const m = matchSystemLines(s.lines, parts)
    expect(m[0]).toMatchObject({ partId: 'cpu1', by: 'code', codeCheck: 'match' })
    // Katalogda olmayan anakart; "Plus" sürümü ekran kartı katalogdaki kart sayılmaz.
    expect(m[1].partId).toBeUndefined()
    expect(m[2].partId).toBeUndefined()
    // "Bilgisayar Kasası" ceza almaz: adına göre tanınır.
    expect(m[3]).toMatchObject({ partId: 'case1', by: 'name', codeCheck: 'missing' })
    expect(m[4]).toEqual({ line: s.lines[4] })
  })
})

describe('hazır sistem: Gaming.gen.tr sayfası', () => {
  const s = parseGamingSystem(gamingPage, GAMING)

  it('sistemin adı, fiyatı ve stok durumu', () => {
    expect(s).toMatchObject({ name: 'TEST-5070 / Sistem Tavsiyesi', price: 103999, inStock: true })
  })

  it('parça tablosundaki satırlar; başka tablo okunmaz', () => {
    expect(s.lines.map((l) => [l.label, l.category ?? null, l.code ?? null])).toEqual([
      ['MONTAJ VE KARGO SEÇENEKLERİ', null, null],
      ['İŞLEMCİ', 'cpu', null],
      ['EKRAN KARTI', 'gpu', 'TEST-GPU-CODE1'],
      ['RAM', 'memory', 'TEST-RAM-6000-2X16'],
      ['İŞLEMCİ SOĞUTUCU', 'cooler', null],
      ['GÜÇ KAYNAĞI', 'psu', 'TP650W']
    ])
    expect(s.lines[0].url).toBe('https://www.gaming.gen.tr/urun/1/standart-montaj/')
    // Mağazanın dışına giden link alınmaz.
    expect(s.lines[5].url).toBeUndefined()
  })

  it('katalogla eşleştirme', () => {
    const m = matchSystemLines(s.lines, parts)
    // Linkte "tray" geçiyor: kutulu işlemciyle aynı ürün sayılmaz.
    expect(m[1].partId).toBeUndefined()
    // Adı tutuyor, mağazanın kodu katalogdakinden farklı: tanınır ama işaretlenir.
    expect(m[2]).toMatchObject({ partId: 'gpu1', by: 'name', codeCheck: 'mismatch' })
    expect(m[3]).toMatchObject({ partId: 'ram1', by: 'code' })
    // "Assassin X 120 Refined SE" katalogdaki "Peerless Assassin 120 SE" değildir.
    expect(m[4].partId).toBeUndefined()
    expect(m[5].partId).toBeUndefined()
  })
})

describe('hazır sistem: eşleştirme kuralları', () => {
  const line = (o: Partial<ReadySystemLine> & { name: string }): ReadySystemLine => ({ label: 'x', category: 'cpu', ...o })

  it('aynı ölçüde benzeyen iki parça varsa tanınmış sayılmaz', () => {
    const twin: Part = { ...cpu, id: 'cpu2', mpn: undefined }
    const one: Part = { ...cpu, mpn: undefined }
    expect(matchSystemLine(line({ name: 'AMD Ryzen 7 9800X3D İşlemci' }), [one, twin])).toMatchObject({ ambiguous: ['cpu1', 'cpu2'] })
  })

  it('ad karşılaştırması link eşleştirmesinden katıdır', () => {
    // Linkte bir kelimesi eksik olan aday olabilir; üründen okunan adda bütün kelimeler geçmeli.
    expect(scoreUrl(cooler, 'https://www.gaming.gen.tr/urun/9/thermalright-assassin-120-se/')).not.toBeNull()
    expect(scoreText(cooler, 'Thermalright Assassin 120 SE Hava Soğutucu')).toBeNull()
    expect(scoreText(cooler, 'Thermalright Peerless Assassin 120 SE Hava Soğutucu')).toBeGreaterThanOrEqual(TEXT_MATCH_MIN)
    // Parçanın adında olmayan sürüm kelimesi eşiğin altına düşürür.
    expect(scoreText(cooler, 'Thermalright Peerless Assassin 120 SE ARGB Hava Soğutucu')!).toBeLessThan(TEXT_MATCH_MIN)
    // Resmî adda olup mağazanın yazmadığı "Edition" zorunlu değil; "OC" ise zorunlu kalır.
    const dual: Part = { ...testPart('gpu', {}, 'gpu9'), brand: 'ASUS', model: 'Dual GeForce RTX 5070 12GB GDDR7 OC Edition' }
    expect(scoreText(dual, 'ASUS DUAL GeForce RTX 5070 OC 12GB GDDR7 192 Bit Ekran Kartı')).toBeGreaterThanOrEqual(TEXT_MATCH_MIN)
    expect(scoreText(dual, 'ASUS DUAL GeForce RTX 5070 12GB GDDR7 Ekran Kartı')).toBeNull()
    // Koddan sonra boşlukla gelen tek harf modelin parçasıdır: "A620M H" ile "A620M S2H" ayrı kartlar.
    const a620: Part = { ...testPart('motherboard', {}, 'mb2'), brand: 'Gigabyte', model: 'A620M H (rev. 1.x/2.x)' }
    expect(scoreText(a620, 'GIGABYTE A620M H 6400MHz(OC) DDR5 Soket AM5 mATX Anakart')).toBeGreaterThanOrEqual(TEXT_MATCH_MIN)
    expect(scoreText(a620, 'GIGABYTE A620M S2H DDR5 Soket AM5 mATX Anakart')).toBeNull()
    // Ürün adındaki "Gaming Anakart" gibi tanımlar sürüm sayılmaz.
    const board: Part = { ...testPart('motherboard', {}, 'mb1'), brand: 'MSI', model: 'MAG B850 Tomahawk Max WiFi' }
    expect(scoreText(board, 'MSI MAG B850 TOMAHAWK MAX WIFI DDR5 AM5 ATX Gaming Anakart')).toBeGreaterThanOrEqual(TEXT_MATCH_MIN)
  })

  it('onaylı mağaza linki parçayı kesin tanır; başka kategorideki parçaya bağlı link yok sayılır', () => {
    const board: Part = { ...testPart('motherboard', {}, 'mb1'), brand: 'Gigabyte', model: 'B650 Test' }
    const url = 'https://www.itopya.com/gigabyte-a620m-h_u5'
    const l: ReadySystemLine = { label: 'Anakart', category: 'motherboard', name: 'GIGABYTE A620M H DDR5 mATX Anakart', url }
    expect(matchSystemLine(l, [board])).toEqual({ line: l })
    expect(matchSystemLine(l, [board], new Map([[url, 'mb1']]))).toMatchObject({ partId: 'mb1', by: 'link', codeCheck: 'missing' })
    expect(matchSystemLine(l, [board, cpu], new Map([[url, 'cpu1']])).partId).toBeUndefined()
  })

  it('kategorisiz satır eşleştirilmez', () => {
    expect(matchSystemLine({ label: 'Kasa Fanları', name: 'AMD Ryzen 7 9800X3D' }, parts)).toEqual({
      line: { label: 'Kasa Fanları', name: 'AMD Ryzen 7 9800X3D' }
    })
  })
})

describe('hazır sistem: kendin toplasan', () => {
  const l = (category: CategoryId | undefined, partId?: string, extra: Partial<LineMatch> = {}): LineMatch => ({
    line: { label: 'x', name: 'y', ...(category ? { category } : {}) },
    ...(partId ? { partId, by: 'code' as const, codeCheck: 'match' as const } : {}),
    ...extra
  })
  const totals =
    (cheapest: number, missing: string[] = [], singleStore: Totals['singleStore'] = null) =>
    (): Totals => ({ cheapest, missing, singleStore })

  it('bütün parçalar tanınıp fiyatlıysa fark hesaplanır', () => {
    const s = summarizeReadySystem(35000, [l('cpu', 'a'), l('gpu', 'b'), l(undefined)], totals(30000, [], { storeId: 'itopya', total: 31000 }))
    expect(s).toMatchObject({
      complete: true,
      priced: 2,
      selfBuild: 30000,
      difference: 5000,
      remainder: null,
      singleStore: { storeId: 'itopya', total: 31000 }
    })
    expect(s.others).toHaveLength(1)
  })

  it('tanınmayan ya da fiyatı olmayan parça varsa fark yok, fiyatı bilinenlerden sonra kalan verilir', () => {
    const s = summarizeReadySystem(35000, [l('cpu', 'a'), l('gpu', 'b'), l('case')], totals(10000, ['b']))
    expect(s).toMatchObject({ complete: false, priced: 1, selfBuild: 10000, difference: null, remainder: 25000, singleStore: null })
  })

  it('hiç fiyat yoksa ya da sistemin fiyatı okunamadıysa fark ve kalan yok', () => {
    expect(summarizeReadySystem(35000, [l('cpu', 'a')], totals(0, ['a']))).toMatchObject({ selfBuild: null, difference: null, remainder: null })
    expect(summarizeReadySystem(undefined, [l('cpu', 'a')], totals(9000))).toMatchObject({
      complete: true,
      selfBuild: 9000,
      difference: null,
      remainder: null
    })
  })

  it('adına göre tanınıp kodu farklı olanlar sayılır; onaylı linkle tanınanlar sayılmaz', () => {
    const s = summarizeReadySystem(
      1,
      [l('cpu', 'a', { by: 'name', codeCheck: 'mismatch' }), l('gpu', 'b', { by: 'link', codeCheck: 'mismatch' })],
      totals(0, ['a', 'b'])
    )
    expect(s.codeMismatches).toBe(1)
  })
})

describe('hazır sistem: linkler', () => {
  it('mağazayı alan adından bulur; hazır sistem sayfası değilse kabul etmez', () => {
    expect(storeForUrl('https://itopya.com/kartal-sistem_h32820')?.id).toBe('itopya')
    expect(storeForUrl('https://www.vatanbilgisayar.com/x.html')?.id).toBe('vatan')
    expect(storeForUrl('https://example.com/x')).toBeNull()
    expect(storeForUrl('bozuk link')).toBeNull()
    const itopya = STORES.itopya
    expect(normalizeStoreUrl('http://itopya.com/kartal-sistem_h32820?ref=1#x', itopya, itopya.readySystem!.isUrl)).toBe(
      'https://www.itopya.com/kartal-sistem_h32820'
    )
    expect(normalizeStoreUrl('https://www.itopya.com/amd-ryzen-islemci_u1', itopya, itopya.readySystem!.isUrl)).toBeNull()
    expect(STORES.vatan.readySystem).toBeUndefined()
  })
})
