import { describe, expect, it } from 'vitest'
import type { Part } from '../catalog/types'
import type { BenchmarkResult } from '../benchmark/types'
import { testPart } from '../compat/testParts'
import { compareBy, efficiencyTier, memoryLatencyNs, rankParts, SORT_OPTIONS } from './sorting'
import { engineeringScore } from './system'

// Test girdileri: değerler gerçek ölçüm değildir.

const cpu = (id: string, cores: number): Part => testPart('cpu', { cores }, id)
const gpu = (id: string, chip: string): Part => testPart('gpu', { gpuChip: chip, vramGb: 12 }, id)
const mem = (id: string, gb: number, speed: number, cl: number): Part =>
  testPart('memory', { capacityGb: gb, speedMts: speed, casLatency: cl, modules: 2 }, id)
const result = (subject: BenchmarkResult['subject'], value: number): BenchmarkResult => ({
  test: 'blender-cycles',
  subject,
  device: 'test',
  value,
  conditions: { blenderVersion: '0', computeType: 'CPU', statistic: 'median' },
  sampleCount: 5,
  source: 't'
})

const catalog = [cpu('c1', 8), cpu('c2', 16), cpu('c3', 6), gpu('g1', 'A'), gpu('g2', 'B'), mem('m1', 32, 6000, 30), mem('m2', 64, 6000, 30)]
const results = [result({ partId: 'c1' }, 300), result({ partId: 'c2' }, 600), result({ gpuChip: 'A' }, 4000), result({ gpuChip: 'B' }, 8000)]
const ctx = { results }

describe('sıralama', () => {
  it('ölçüme göre sıralar; ölçümü olmayan sona', () => {
    const cpus = catalog.filter((p) => p.category === 'cpu')
    const sorted = [...cpus].sort(compareBy(SORT_OPTIONS.cpu[0], ctx)).map((p) => p.id)
    expect(sorted).toEqual(['c2', 'c1', 'c3'])
    const ranks = rankParts(cpus, SORT_OPTIONS.cpu[0], ctx)
    expect(ranks.get('c2')).toMatchObject({ rank: 1, of: 2, relative: 100 })
    expect(ranks.get('c1')).toMatchObject({ rank: 2, relative: 50 })
    expect(ranks.has('c3')).toBe(false)
  })

  it('bellek gecikmesini formülle hesaplar ve düşük olanı öne alır', () => {
    expect(memoryLatencyNs(mem('x', 32, 6000, 30))).toBe(10)
    expect(memoryLatencyNs(mem('y', 32, 3200, 16))).toBe(10)
    expect(memoryLatencyNs(mem('z', 32, 5600, 40))).toBeCloseTo(14.29, 2)
    const ranks = rankParts([mem('a', 32, 6000, 30), mem('b', 32, 5600, 40)], SORT_OPTIONS.memory[0], ctx)
    expect(ranks.get('a')?.rank).toBe(1)
  })

  it('güç kaynağı sertifikasındaki en yüksek kademeyi alır', () => {
    const psu = (eff: string): Part => testPart('psu', { efficiency: eff })
    expect(efficiencyTier(psu('80 PLUS Gold · Cybenetics Platinum'))).toBeGreaterThan(efficiencyTier(psu('80 PLUS Gold')) as number)
    expect(efficiencyTier(psu('Cybenetics Gold'))).toBe(efficiencyTier(psu('80 PLUS Gold')))
    expect(efficiencyTier(psu('Bilinmeyen'))).toBeNull()
  })
})

describe('mühendislik puanı', () => {
  it('bileşenleri ağırlıklarıyla toplar; CAD puana katılmaz', () => {
    const s = engineeringScore({ cpu: catalog[0], gpu: catalog[4], memory: catalog[5], storage: [] }, catalog, results)
    // işlemci 300/600 = 50, ekran kartı 8000/8000 = 100, bellek 32/64 = 50
    expect(s.score).toBe(Math.round(0.4 * 50 + 0.3 * 100 + 0.3 * 50))
    expect(s.components.find((c) => c.id === 'cad')).toMatchObject({ weight: 0, value: null })
  })

  it('eksik bileşen varsa puan vermez ve nedenini yazar', () => {
    const s = engineeringScore({ cpu: catalog[2], memory: catalog[5], storage: [] }, catalog, results)
    expect(s.score).toBeNull()
    expect(s.components.find((c) => c.id === 'cpuRender')?.missingReason).toBe('Bu işlemcinin ölçümü yok')
    expect(s.components.find((c) => c.id === 'gpuRender')?.missingReason).toBe('Ekran kartı seçilmedi')
  })
})
