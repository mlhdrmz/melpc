import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Part } from '../../engines/catalog/types'
import { testPart } from '../../engines/compat/testParts'
import { MelpcDb } from '../db'
import { StoreFetcher, type FetchLike } from './fetcher'
import { PriceService } from './service'

// Sahte mağaza sayfalarıyla eşleştirme ve güncelleme akışı. Ürün kodları ve fiyatlar test değeridir.

const wasmDir = dirname(createRequire(import.meta.url).resolve('sql.js'))
const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'melpc-price-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const cpu: Part = { ...testPart('cpu', {}, 'cpu1'), brand: 'AMD', model: 'Ryzen 7 9800X3D', mpn: 'TEST-CPU-0001' }
const gpu: Part = { ...testPart('gpu', {}, 'gpu1'), brand: 'MSI', model: 'GeForce RTX 5070 12G Ventus 2X OC' }

const ld = (o: object): string =>
  `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', ...o })}</script></html>`
const offer = (price: string, stock = 'InStock') => ({ price, priceCurrency: 'TRY', availability: `https://schema.org/${stock}` })
const urlset = (urls: string[]): string => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`

const IT = 'https://www.itopya.com'
type Page = string | { status: number; body: string } | (() => string | { status: number; body: string })

function site(): { pages: Record<string, Page>; calls: string[]; impl: FetchLike } {
  const pages: Record<string, Page> = {
    [`${IT}/robots.txt`]: 'User-agent: *\nAllow: /\n',
    [`${IT}/sitemap.xml`]: `<sitemapindex><sitemap><loc>${IT}/itopya_products_0.xml</loc></sitemap></sitemapindex>`,
    [`${IT}/itopya_products_0.xml`]: urlset([
      `${IT}/amd-ryzen-7-9800x3d-tray-islemci_u2`,
      `${IT}/amd-ryzen-7-9800x3d-islemci_u1`,
      `${IT}/msi-geforce-rtx-5070-12g-ventus-2x-oc_u3`,
      `${IT}/kartal-sistem_h9`
    ]),
    // İlk aday (tray) farklı kodlu; ikinci aday kodu tutuyor.
    [`${IT}/amd-ryzen-7-9800x3d-islemci_u1`]: ld({ name: 'AMD Ryzen 7 9800X3D', mpn: 'TEST-CPU-0001', offers: offer('20000.00') }),
    [`${IT}/amd-ryzen-7-9800x3d-tray-islemci_u2`]: ld({ name: 'AMD Ryzen 7 9800X3D Tray', mpn: 'TEST-CPU-TRAY', offers: offer('18000.00') }),
    [`${IT}/msi-geforce-rtx-5070-12g-ventus-2x-oc_u3`]: ld({ name: 'MSI RTX 5070 Ventus', offers: offer('30000.00', 'OutOfStock') }),
    // Gaming.gen.tr hız sınırında.
    'https://www.gaming.gen.tr/robots.txt': { status: 429, body: 'error code: 1015' },
    // Vatan'da bu parçalar yok.
    'https://www.vatanbilgisayar.com/robots.txt': 'User-agent: *\nDisallow: /arama/\n',
    'https://www.vatanbilgisayar.com/sitemap.axd': urlset(['https://www.vatanbilgisayar.com/baska-bir-urun.html'])
  }
  const calls: string[] = []
  const impl: FetchLike = async (url) => {
    calls.push(url)
    let p = pages[url]
    if (typeof p === 'function') p = p()
    const r = p === undefined ? { status: 404, body: '' } : typeof p === 'string' ? { status: 200, body: p } : p
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body }
  }
  return { pages, calls, impl }
}

async function setup(impl: FetchLike) {
  let clock = Date.parse('2026-11-18T10:00:00Z')
  const db = await MelpcDb.open(join(tempDir(), 'melpc.sqlite'), wasmDir)
  const service = new PriceService({
    db,
    parts: () => [cpu, gpu],
    cacheDir: tempDir(),
    now: () => clock,
    makeFetcher: (s) => new StoreFetcher(s, impl, async () => undefined, () => clock)
  })
  return { db, service, advance: (h: number) => (clock += h * 3600_000) }
}

const match = (s: PriceService, partId: string, storeId: string) =>
  s.state().matches.find((m) => m.partId === partId && m.storeId === storeId)

describe('fiyat servisi', () => {
  it('aday bulur; kodu tutanı öne alır; erişimi sınırlayan mağazayı bırakır', async () => {
    const { impl, calls } = site()
    const { service } = await setup(impl)
    expect(service.findMatches()).toEqual({ ok: true })
    await service.whenIdle()

    expect(match(service, 'cpu1', 'itopya')).toMatchObject({ status: 'candidate', url: `${IT}/amd-ryzen-7-9800x3d-islemci_u1`, codeCheck: 'match' })
    expect(match(service, 'gpu1', 'itopya')).toMatchObject({ status: 'candidate', codeCheck: 'missing' })
    expect(match(service, 'cpu1', 'vatan')).toMatchObject({ status: 'notFound' })
    expect(match(service, 'cpu1', 'gaming')).toBeUndefined()
    expect(calls.filter((c) => c.includes('gaming'))).toEqual(['https://www.gaming.gen.tr/robots.txt'])
    // Hazır sistem sayfası hiç okunmadı.
    expect(calls).not.toContain(`${IT}/kartal-sistem_h9`)
    const r = service.state().lastResult
    expect(r?.summary).toContain('İtopya: 2 aday bulundu')
    expect(r?.summary).toContain('Gaming.gen.tr erişimi sınırladı')
  })

  it('onay, ret ve elle link', async () => {
    const { impl, calls } = site()
    const { service } = await setup(impl)
    service.findMatches()
    await service.whenIdle()

    // Kodu tutanlar toplu onaylanır; adayın okunduğu fiyat ilk kayıt olur.
    expect(service.confirmCodeMatches()).toMatchObject({ ok: true, message: '1 eşleşme onaylandı.' })
    expect(match(service, 'cpu1', 'itopya')?.status).toBe('confirmed')
    expect(service.state().lastPriced).toMatchObject([{ partId: 'cpu1', storeId: 'itopya', price: 20000, inStock: true }])

    // Ekran kartı adayı reddedilir; yeniden aramada aynı link önerilmez, başka aday da yok.
    expect(service.decide('gpu1', 'itopya', 'reject')).toEqual({ ok: true })
    service.findMatches(['gpu1'])
    await service.whenIdle()
    expect(match(service, 'gpu1', 'itopya')?.status).toBe('notFound')
    // Site haritası önbellekten geldi: bir kez indirildi.
    expect(calls.filter((c) => c === `${IT}/sitemap.xml`)).toHaveLength(1)

    // Elle girilen link: başka mağazanın linki kabul edilmez; doğru link aday olur ve reddedilenlerden çıkar.
    expect(await service.setUrl('gpu1', 'itopya', 'https://www.vatanbilgisayar.com/x.html')).toMatchObject({ ok: false })
    const res = await service.setUrl('gpu1', 'itopya', 'itopya.com/msi-geforce-rtx-5070-12g-ventus-2x-oc_u3?ref=x'.replace(/^/, 'https://'))
    expect(res.ok).toBe(true)
    expect(match(service, 'gpu1', 'itopya')).toMatchObject({ status: 'candidate', url: `${IT}/msi-geforce-rtx-5070-12g-ventus-2x-oc_u3` })
    expect(service.decide('gpu1', 'itopya', 'confirm')).toEqual({ ok: true })
    // Stokta olmayan ürünün fiyatı da kaydedilir (toplama katılmaz, ama görünür).
    expect(service.state().lastPriced.find((o) => o.partId === 'gpu1')).toMatchObject({ price: 30000, inStock: false })
  })

  it('güncelleme: onaylı linklerden okur, 24 saatte en fazla 2 kez', async () => {
    const { impl, pages } = site()
    const { service, advance } = await setup(impl)
    service.findMatches()
    await service.whenIdle()
    service.confirmCodeMatches()

    pages[`${IT}/amd-ryzen-7-9800x3d-islemci_u1`] = ld({ name: 'AMD Ryzen 7 9800X3D', offers: offer('19500.00') })
    advance(1)
    expect(service.update('manual')).toEqual({ ok: true })
    await service.whenIdle()
    expect(service.state().lastPriced.find((o) => o.partId === 'cpu1')?.price).toBe(19500)
    expect(service.state().lastUpdate?.summary).toBe('İtopya: 1 fiyat okundu')

    // Okunamayan fiyat tahmin edilmez: son okuma hata olarak kaydedilir, son okunan fiyat ayrıca durur.
    pages[`${IT}/amd-ryzen-7-9800x3d-islemci_u1`] = '<html>bakımda</html>'
    advance(1)
    expect(service.update('manual')).toEqual({ ok: true })
    await service.whenIdle()
    const s = service.state()
    expect(s.latest.find((o) => o.partId === 'cpu1')).toMatchObject({ price: null, error: 'Sayfada fiyat okunamadı' })
    expect(s.lastPriced.find((o) => o.partId === 'cpu1')?.price).toBe(19500)
    expect(service.history('cpu1').map((o) => o.price)).toEqual([20000, 19500])

    // Üçüncü güncelleme ve otomatik çekim 24 saat dolmadan yapılmaz.
    advance(1)
    expect(s.canUpdateNow).toBe(false)
    expect(service.update('manual')).toMatchObject({ ok: false })
    expect(service.update('auto')).toEqual({ ok: true })
    expect(service.state().job).toBeNull()
    advance(22)
    expect(service.state().canUpdateNow).toBe(true)
  })

  it('internet yoksa deneme günlük sınırdan düşülmez', async () => {
    const offline: FetchLike = async () => {
      throw new TypeError('fetch failed')
    }
    const { service, db } = await setup(offline)
    db.upsertMatch({ partId: 'cpu1', storeId: 'itopya', status: 'confirmed', url: `${IT}/amd-ryzen-7-9800x3d-islemci_u1`, updatedAt: '2026-11-18T09:00:00Z' })
    expect(service.update('manual')).toEqual({ ok: true })
    await service.whenIdle()
    expect(db.listRuns('update')).toEqual([])
    expect(service.state().lastResult?.summary).toContain('Hiçbir mağazaya ulaşılamadı')
    expect(service.state().latest).toEqual([])
  })

  it('hazır sistem: link denetlenir, sayfa bir kez okunur, hiçbir şey kaydedilmez', async () => {
    const { impl, pages, calls } = site()
    pages[`${IT}/kartal-sistem_h9`] = `<html>
      <script type="application/ld+json">{"@type":"Product","name":"KARTAL TEST","offers":{"price":"50.000,00","priceCurrency":"TRY"}}</script>
      <div class="product-card active" data-stok-kodu="TEST-CPU-0001" data-kategori-adi="İşlemci">
        <a href="/amd-ryzen-7-9800x3d-islemci_u1" class="product-href">Ürüne Git</a><h3>AMD Ryzen 7 9800X3D</h3>
      </div></html>`
    pages[`${IT}/bos-sistem_h10`] = '<html>parça listesi yok</html>'
    const { service } = await setup(impl)

    expect(await service.readSystem('https://example.com/sistem_h1')).toMatchObject({ ok: false })
    expect(await service.readSystem('https://www.vatanbilgisayar.com/sistem.html')).toMatchObject({
      ok: false,
      message: expect.stringContaining('Vatan Bilgisayar hazır sistemleri okunmuyor')
    })
    expect(await service.readSystem(`${IT}/amd-ryzen-7-9800x3d-islemci_u1`)).toMatchObject({ ok: false })
    expect(calls).toEqual([])

    const r = await service.readSystem('itopya.com/kartal-sistem_h9?utm_source=x')
    expect(r).toMatchObject({
      ok: true,
      system: { storeId: 'itopya', url: `${IT}/kartal-sistem_h9`, name: 'KARTAL TEST', price: 50000, fetchedAt: '2026-11-18T10:00:00.000Z' }
    })
    expect(r.ok && r.system.lines).toEqual([
      {
        label: 'İşlemci',
        category: 'cpu',
        name: 'AMD Ryzen 7 9800X3D',
        code: 'TEST-CPU-0001',
        url: `${IT}/amd-ryzen-7-9800x3d-islemci_u1`
      }
    ])
    expect(calls).toEqual([`${IT}/robots.txt`, `${IT}/kartal-sistem_h9`])

    expect(await service.readSystem(`${IT}/bos-sistem_h10`)).toMatchObject({
      ok: false,
      message: expect.stringContaining('parça listesi bulunamadı')
    })
    expect(service.state().lastResult?.kind).toBe('system')
    expect(service.state().matches).toEqual([])
    expect(service.state().latest).toEqual([])
  })

  it('iş sürerken ikinci iş başlamaz; durdurulabilir', async () => {
    const { impl } = site()
    const { service } = await setup(impl)
    service.findMatches()
    expect(service.findMatches()).toMatchObject({ ok: false })
    expect(service.update('manual')).toMatchObject({ ok: false })
    expect(await service.readSystem(`${IT}/kartal-sistem_h9`)).toMatchObject({ ok: false })
    service.cancel()
    await service.whenIdle()
    expect(service.state().job).toBeNull()
    expect(service.state().lastResult?.summary).toContain('Durduruldu')
  })
})
