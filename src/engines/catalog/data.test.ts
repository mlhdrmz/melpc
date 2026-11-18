import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCatalogFiles } from './loader'
import { CATEGORY_IDS } from './types'

// data/catalog altındaki gerçek katalog dosyalarını doğrular: her kayıt kurallara uymalı.
const dir = join(__dirname, '..', '..', '..', 'data', 'catalog')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))

describe('katalog verisi', () => {
  const { records, errors } = parseCatalogFiles(files)

  it('bütün kayıtlar doğrulamadan geçer', () => {
    expect(errors).toEqual([])
  })

  it('her dosya yalnızca kendi kategorisindeki parçaları içerir', () => {
    for (const f of files) {
      const category = f.name.replace(/\.json$/, '')
      expect(CATEGORY_IDS).toContain(category)
      const inFile = (JSON.parse(f.content) as { category: string }[]).map((p) => p.category)
      expect(new Set(inFile).size <= 1 && (inFile.length === 0 || inFile[0] === category)).toBe(true)
    }
  })

  it('aynı üretici parça kodu iki kez girmez', () => {
    const mpns = records.map((r) => r.mpn).filter(Boolean)
    expect(new Set(mpns).size).toBe(mpns.length)
  })
})
