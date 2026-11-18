import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PartRecord } from '../catalog/types'
import { parseBenchmarkFiles, resultsForDevice, resultsForPart } from './validate'

// Ölçüm dosyalarının biçimi ve gerçek veri dosyalarının katalogla tutarlılığı.

const root = join(__dirname, '..', '..', '..', 'data')
const catalog: PartRecord[] = readdirSync(join(root, 'catalog'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(root, 'catalog', f), 'utf8')) as PartRecord[])

// Test girdisi: değerler ve linkler gerçek değildir.
const source = { t: { url: 'https://example.test/olcum', retrieved: '2026-11-18', license: 'CC0' } }
const ok = {
  test: 'blender-cycles',
  subject: { partId: 'cpu-amd-ryzen-7-9800x3d' },
  device: 'Test CPU',
  value: 100,
  conditions: { blenderVersion: '0.0.0', computeType: 'CPU', statistic: 'median' },
  sampleCount: 3,
  source: 't'
}
const file = (results: unknown[]): { name: string; content: string } => ({
  name: 'test.json',
  content: JSON.stringify({ sources: source, results })
})

describe('performans ölçümleri', () => {
  it('geçerli ölçümü yükler', () => {
    const r = parseBenchmarkFiles([file([ok])], catalog)
    expect(r.errors).toEqual([])
    expect(r.results).toHaveLength(1)
  })

  it('kaynağı, koşulu ya da parçası eksik ölçümü yüklemez', () => {
    const bad = [
      { ...ok, source: 'yok' },
      { ...ok, conditions: { blenderVersion: '0.0.0' } },
      { ...ok, subject: { partId: 'yok' } },
      { ...ok, subject: { gpuChip: 'Yok GPU' } },
      { ...ok, value: 0 },
      { ...ok, test: 'bilinmeyen' }
    ]
    const r = parseBenchmarkFiles([file(bad)], catalog)
    expect(r.results).toEqual([])
    expect(r.errors.map((e) => e.index)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5]))
  })

  it('aynı test, parça ve koşulla ikinci ölçümü kabul etmez', () => {
    const r = parseBenchmarkFiles([file([ok, { ...ok, value: 200 }])], catalog)
    expect(r.results).toHaveLength(1)
    expect(r.errors[0].message).toContain('ikinci ölçüm')
  })

  it('ekran kartı ölçümü aynı grafik işlemcisini kullanan bütün kartlara uygulanır', () => {
    const chip = { ...ok, subject: { gpuChip: 'GeForce RTX 5070' }, conditions: { ...ok.conditions, computeType: 'OPTIX' } }
    const r = parseBenchmarkFiles([file([chip])], catalog)
    const cards = catalog.filter((p) => p.category === 'gpu' && p.specs.gpuChip?.value === 'GeForce RTX 5070')
    expect(cards.length).toBeGreaterThan(1)
    for (const card of cards) expect(resultsForPart(r.results, card)).toHaveLength(1)
  })

  it('katalogda olmayan cihazın ölçümü Windows\'un okuduğu adla bulunur', () => {
    const laptopCpu = { ...ok, subject: { deviceName: 'Test Core i7-0000H', category: 'cpu' } }
    const laptopGpu = { ...ok, subject: { deviceName: 'Test GeForce 0000 Laptop GPU', category: 'gpu' }, conditions: { ...ok.conditions, computeType: 'OPTIX' } }
    const r = parseBenchmarkFiles([file([laptopCpu, laptopGpu])], catalog)
    expect(r.errors).toEqual([])
    expect(resultsForDevice(r.results, '12th Gen Test(R) Core(TM) i7-0000H', 'cpu')).toHaveLength(1)
    expect(resultsForDevice(r.results, 'Test Core i7-0000H', 'gpu')).toEqual([])
    expect(resultsForDevice(r.results, 'Test GeForce 0000 Laptop GPU', 'gpu')).toHaveLength(1)
    // Katalog parçalarına karışmaz.
    expect(r.results.flatMap((x) => resultsForPart([x], catalog[0] as never))).toEqual([])
    // Kategori zorunlu; aynı cihaz iki kez yüklenmez.
    const bad = parseBenchmarkFiles([file([{ ...ok, subject: { deviceName: 'Test X' } }, laptopCpu, laptopCpu])], catalog)
    expect(bad.errors.map((e) => e.message)).toEqual([
      'deviceName ile category (cpu ya da gpu) gerekli',
      'aynı test, parça ve koşulla ikinci ölçüm'
    ])
  })

  it('data/benchmarks altındaki gerçek ölçümler katalogla tutarlı', () => {
    const dir = join(root, 'benchmarks')
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))
    const r = parseBenchmarkFiles(files, catalog)
    expect(r.errors).toEqual([])
    expect(r.results.length).toBeGreaterThan(0)
  })
})
