import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PartRecord } from '../engines/catalog/types'
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
