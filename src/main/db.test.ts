import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PartRecord } from '../engines/catalog/types'
import type { HardwareReading } from '../engines/hardware/types'
import { MelpcDb } from './db'

const wasmDir = dirname(createRequire(import.meta.url).resolve('sql.js'))
const dirs: string[] = []
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'melpc-test-'))
  dirs.push(dir)
  return join(dir, 'melpc.sqlite')
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

// Test kaydı: gerçek ürün değildir.
const rec: PartRecord = {
  id: 'test-case',
  category: 'case',
  brand: 'Test',
  model: 'Test Kasa',
  mpn: 'T-1',
  sources: { maker: { url: 'https://example.test/kasa', retrieved: '2026-11-17', title: 'Ürün sayfası' } },
  specs: {
    maxGpuLengthMm: { value: 360, source: 'maker' },
    radiatorMounts: { value: [{ position: 'top', sizesMm: [240, 360] }], source: 'maker' },
    maxPsuLengthMm: { value: null, note: 'üretici yazmıyor' }
  },
  addedAt: '2026-11-17',
  updatedAt: '2026-11-17'
}

describe('veritabanı', () => {
  it('katalog yazılıp aynen geri okunur', async () => {
    const db = await MelpcDb.open(tempFile(), wasmDir)
    db.replaceCatalog([rec])
    expect(db.readCatalog()).toEqual([rec])
    db.replaceCatalog([])
    expect(db.readCatalog()).toEqual([])
  })

  it('toplamalar dosyaya kaydedilir ve yeniden açınca durur; katalog yenilenince silinmez', async () => {
    const file = tempFile()
    const db = await MelpcDb.open(file, wasmDir)
    const saved = db.saveBuild({ name: 'Oyun', selection: { storage: ['a'], cpu: 'x' } })
    db.saveBuild({ id: saved.id, name: 'Oyun 2', selection: { storage: [] } })

    const again = await MelpcDb.open(file, wasmDir)
    again.replaceCatalog([rec])
    const builds = again.listBuilds()
    expect(builds).toHaveLength(1)
    expect(builds[0].name).toBe('Oyun 2')
    expect(builds[0].selection).toEqual({ storage: [] })

    again.deleteBuild(saved.id)
    expect((await MelpcDb.open(file, wasmDir)).listBuilds()).toEqual([])
  })
})

// Fiyatlar test değeridir.
describe('fiyat tabloları', () => {
  it('eşleştirme eklenir, güncellenir ve silinir', async () => {
    const db = await MelpcDb.open(tempFile(), wasmDir)
    db.upsertMatch({ partId: 'p', storeId: 'itopya', status: 'candidate', url: 'https://x/p_u1', product: { name: 'P', mpn: 'T-1' }, codeCheck: 'match', updatedAt: '2026-11-18T10:00:00Z' })
    db.upsertMatch({ partId: 'p', storeId: 'itopya', status: 'confirmed', url: 'https://x/p_u1', product: { name: 'P', mpn: 'T-1' }, codeCheck: 'match', updatedAt: '2026-11-18T11:00:00Z' })
    db.upsertMatch({ partId: 'p', storeId: 'gaming', status: 'notFound', updatedAt: '2026-11-18T11:00:00Z' })
    const all = db.listMatches()
    expect(all).toHaveLength(2)
    expect(all.find((m) => m.storeId === 'itopya')).toMatchObject({ status: 'confirmed', product: { mpn: 'T-1' } })
    expect(all.find((m) => m.storeId === 'gaming')).toEqual({ partId: 'p', storeId: 'gaming', status: 'notFound', updatedAt: '2026-11-18T11:00:00Z' })
    db.deleteMatch('p', 'gaming')
    expect(db.listMatches()).toHaveLength(1)
  })

  it('son okuma, fiyatı okunmuş son okuma ve geçmiş', async () => {
    const file = tempFile()
    const db = await MelpcDb.open(file, wasmDir)
    const base = { partId: 'p', storeId: 'itopya' as const, url: 'https://x/p_u1' }
    db.upsertMatch({ partId: 'p', storeId: 'itopya', status: 'confirmed', url: base.url, updatedAt: '2026-11-16T09:00:00Z' })
    db.addOffer({ ...base, price: 1000, inStock: true, fetchedAt: '2026-11-16T10:00:00Z' })
    db.addOffer({ ...base, price: 950, inStock: false, fetchedAt: '2026-11-17T10:00:00Z' })
    db.addOffer({ ...base, price: null, inStock: null, fetchedAt: '2026-11-18T10:00:00Z', error: 'Zaman aşımı' }, true)

    const again = await MelpcDb.open(file, wasmDir)
    expect(again.latestOffers()).toEqual([{ ...base, price: null, inStock: null, fetchedAt: '2026-11-18T10:00:00Z', error: 'Zaman aşımı' }])
    expect(again.latestPricedOffers()).toEqual([{ ...base, price: 950, inStock: false, fetchedAt: '2026-11-17T10:00:00Z' }])
    expect(again.offerHistory('p').map((o) => o.price)).toEqual([1000, 950])
  })

  it('eşleşme başka linke geçince eski linkin fiyatları görünmez', async () => {
    const db = await MelpcDb.open(tempFile(), wasmDir)
    db.upsertMatch({ partId: 'p', storeId: 'gaming', status: 'confirmed', url: 'https://x/eski', updatedAt: '2026-11-16T09:00:00Z' })
    db.addOffer({ partId: 'p', storeId: 'gaming', url: 'https://x/eski', price: 500, inStock: true, fetchedAt: '2026-11-16T10:00:00Z' })
    db.upsertMatch({ partId: 'p', storeId: 'gaming', status: 'candidate', url: 'https://x/yeni', updatedAt: '2026-11-17T09:00:00Z' })
    expect(db.latestOffers()).toEqual([])
    expect(db.offerHistory('p')).toEqual([])
    db.upsertMatch({ partId: 'p', storeId: 'gaming', status: 'confirmed', url: 'https://x/yeni', updatedAt: '2026-11-17T09:05:00Z' })
    db.addOffer({ partId: 'p', storeId: 'gaming', url: 'https://x/yeni', price: 700, inStock: true, fetchedAt: '2026-11-17T09:00:00Z' })
    expect(db.latestPricedOffers().map((o) => o.price)).toEqual([700])
    expect(db.offerHistory('p').map((o) => o.price)).toEqual([700])
  })

  it('reddedilen linkler', async () => {
    const db = await MelpcDb.open(tempFile(), wasmDir)
    db.addRejected('p', 'vatan', 'https://x/a.html', '2026-11-18T10:00:00Z')
    db.addRejected('p', 'vatan', 'https://x/b.html', '2026-11-18T10:00:00Z')
    db.removeRejected('p', 'vatan', 'https://x/a.html')
    expect(db.rejectedUrls('p', 'vatan')).toEqual(['https://x/b.html'])
    expect(db.rejectedUrls('p', 'itopya')).toEqual([])
  })

  it('çekim kayıtları', async () => {
    const db = await MelpcDb.open(tempFile(), wasmDir)
    const id = db.startRun('update', '2026-11-18T10:00:00Z')
    db.startRun('match', '2026-11-18T10:05:00Z')
    db.finishRun(id, '2026-11-18T10:20:00Z', '12 fiyat okundu')
    expect(db.listRuns('update')).toEqual([{ startedAt: '2026-11-18T10:00:00Z', finishedAt: '2026-11-18T10:20:00Z', summary: '12 fiyat okundu' }])
    expect(db.listRuns('match')).toHaveLength(1)
    db.deleteRun(id)
    expect(db.listRuns('update')).toEqual([])
  })
})

describe('Bilgisayarım', () => {
  it('yalnızca son donanım okuması saklanır ve yeniden açınca durur', async () => {
    const file = tempFile()
    const db = await MelpcDb.open(file, wasmDir)
    expect(db.lastHardwareReading()).toBeNull()
    const reading = (readAt: string, model: string): HardwareReading => ({
      readAt,
      system: { manufacturer: 'Test', model, family: null, isLaptop: true },
      cpus: [{ name: 'Test CPU', cores: 8, threads: 16 }],
      gpus: [],
      memory: { slots: 2, modules: [] },
      disks: [],
      wifi: [],
      board: { manufacturer: null, product: null }
    })
    db.saveHardwareReading(reading('2026-11-18T10:00:00.000Z', 'Test Laptop 1'))
    db.saveHardwareReading(reading('2026-11-18T11:00:00.000Z', 'Test Laptop 2'))
    const again = await MelpcDb.open(file, wasmDir)
    expect(again.lastHardwareReading()).toEqual(reading('2026-11-18T11:00:00.000Z', 'Test Laptop 2'))
  })
})
