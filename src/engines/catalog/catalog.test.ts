import { describe, expect, it } from 'vitest'
import { parseCatalogFiles } from './loader'
import { resolvePart, validatePartRecord } from './validate'
import { formatSpecValue, getSpecDef } from './specDefs'
import { partSummary } from './summary'
import type { PartRecord } from './types'

// Test kaydı: gerçek ürün değildir.
function record(over: Partial<PartRecord> = {}): PartRecord {
  return {
    id: 'test-cpu',
    category: 'cpu',
    brand: 'Test',
    model: 'Test İşlemci',
    sources: { maker: { url: 'https://example.test/cpu', retrieved: '2026-11-17' } },
    specs: {
      socket: { value: 'AM5', source: 'maker' },
      cores: { value: 8, source: 'maker' },
      tdpW: { value: 120, source: 'maker' }
    },
    addedAt: '2026-11-17',
    updatedAt: '2026-11-17',
    ...over
  }
}

describe('doğrulama', () => {
  it('geçerli kayıt hatasız', () => {
    expect(validatePartRecord(record())).toEqual([])
  })
  it('kaynağı olmayan değer kataloğa girmez', () => {
    const r = record({ specs: { socket: { value: 'AM5' } } })
    expect(validatePartRecord(r).join()).toContain('kaynak gösterilmemiş')
  })
  it('tanımlı olmayan kaynak anahtarı hata', () => {
    const r = record({ specs: { socket: { value: 'AM5', source: 'yok' } } })
    expect(validatePartRecord(r).join()).toContain('tanımlı değil')
  })
  it('bilinmeyen alan hata', () => {
    const r = record({ specs: { renk: { value: 'mor', source: 'maker' } } })
    expect(validatePartRecord(r).join()).toContain('tanımlı bir alan değil')
  })
  it('yanlış tip ve geçersiz seçenek hata', () => {
    expect(validatePartRecord(record({ specs: { cores: { value: '8', source: 'maker' } } }))).toHaveLength(1)
    expect(validatePartRecord(record({ specs: { socket: { value: 'AM3', source: 'maker' } } }))).toHaveLength(1)
  })
  it('bilinmeyen değer (null) kaynaksız olabilir', () => {
    expect(validatePartRecord(record({ specs: { cores: { value: null } } }))).toEqual([])
  })
  it('tarih biçimi kontrol edilir', () => {
    expect(validatePartRecord(record({ addedAt: '17.11.2026' })).join()).toContain('addedAt')
  })
})

describe('yükleme', () => {
  it('hatalı kayıt atlanır, diğerleri yüklenir; aynı id iki kez girmez', () => {
    const files = [
      {
        name: 'cpu.json',
        content: JSON.stringify([record(), record({ id: 'test-cpu-2', brand: '' }), record()])
      },
      { name: 'bozuk.json', content: '{' }
    ]
    const { records, errors } = parseCatalogFiles(files)
    expect(records.map((r) => r.id)).toEqual(['test-cpu'])
    expect(errors.some((e) => e.partId === 'test-cpu-2')).toBe(true)
    expect(errors.some((e) => e.message.includes('aynı id'))).toBe(true)
    expect(errors.some((e) => e.file === 'bozuk.json')).toBe(true)
  })
})

describe('çözümleme ve gösterim', () => {
  it('eksik zorunlu alan "bilinmiyor" olur, eksik isteğe bağlı alan hiç görünmez', () => {
    const part = resolvePart(record())
    expect(part.specs.threads).toEqual({ value: null, source: null })
    expect(part.specs.maxTurboPowerW).toBeUndefined()
    expect(part.specs.socket.source?.url).toBe('https://example.test/cpu')
  })
  it('değerler Türkçe biçimlenir', () => {
    expect(formatSpecValue(getSpecDef('gpu', 'lengthMm')!, 304)).toBe('304 mm')
    expect(formatSpecValue(getSpecDef('cpu', 'baseClockGhz')!, 4.7)).toBe('4,7 GHz')
    expect(formatSpecValue(getSpecDef('cpu', 'cores')!, null)).toBe('bilinmiyor')
    expect(formatSpecValue(getSpecDef('psu', 'modularity')!, 'full')).toBe('Tam modüler')
    expect(formatSpecValue(getSpecDef('gpu', 'powerConnectors')!, { '8-pin': 2 })).toBe('2 × 8-pin')
    expect(
      formatSpecValue(getSpecDef('case', 'radiatorMounts')!, [{ position: 'top', sizesMm: [240, 360] }])
    ).toBe('Üst: 240 / 360 mm')
  })
  it('kısa özet bilinmeyenleri atlar', () => {
    expect(partSummary(resolvePart(record()))).toBe('8 çekirdek · AM5')
  })
})
