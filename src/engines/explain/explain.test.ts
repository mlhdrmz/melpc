import { describe, expect, it } from 'vitest'
import type { Part } from '../catalog/types'
import type { BenchmarkResult } from '../benchmark/types'
import { testPart } from '../compat/testParts'
import { checkBuild } from '../compat'
import { explainBuild } from './index'

// Test girdileri: değerler gerçek ölçüm değildir.

const cpus = [1, 2, 3, 4, 5, 6].map((i) => testPart('cpu', { socket: 'AM5', tdpW: 65, memoryTypes: ['DDR5'] }, `c${i}`))
const results: BenchmarkResult[] = cpus.map((c, i) => ({
  test: 'blender-cycles',
  subject: { partId: c.id },
  device: c.id,
  value: (i + 1) * 100,
  conditions: { blenderVersion: '0', computeType: 'CPU', statistic: 'median' },
  sampleCount: 10,
  source: 't'
}))
const mem = (gb: number, modules: number): Part => testPart('memory', { memoryType: 'DDR5', capacityGb: gb, modules, speedMts: 6000, casLatency: 30 })
const catalog = [...cpus, mem(64, 2)]

describe('açıklamalar', () => {
  it('işlemcinin sırasına göre iyi ya da kötü der, ölçümü ve sayısını yazar', () => {
    const top = explainBuild({ cpu: cpus[5], storage: [] }, [], catalog, results).find((e) => e.id === 'cpu-render')
    expect(top).toMatchObject({ tone: 'good' })
    expect(top?.detail).toContain('6 işlemci arasında 1. sırada')
    expect(top?.detail).toContain('10 ölçüm')
    const bottom = explainBuild({ cpu: cpus[0], storage: [] }, [], catalog, results).find((e) => e.id === 'cpu-render')
    expect(bottom?.tone).toBe('bad')
  })

  it('tek modülü ve NVMe olmayan diski kötü sayar; gecikmeyi formülle yazar', () => {
    const sata = testPart('storage', { storageType: 'SATA SSD', seqReadMbps: 560 })
    const e = explainBuild({ memory: mem(16, 1), storage: [sata] }, [], catalog, results)
    expect(e.find((x) => x.id === 'memory-channels')?.tone).toBe('bad')
    expect(e.find((x) => x.id === 'storage-nvme')?.detail).toContain('560 MB/s')
    expect(e.find((x) => x.id === 'memory-latency')?.title).toBe('Bellek gecikmesi 10 ns')
  })

  it('uyumsuzluk varsa özetler; parça yoksa bir şey yazmaz', () => {
    expect(explainBuild({ storage: [] }, [], catalog, results)).toEqual([])
    const board = testPart('motherboard', { socket: 'LGA1851', formFactor: 'ATX', memoryType: 'DDR5' })
    const build = { cpu: cpus[0], motherboard: board, storage: [] }
    const e = explainBuild(build, checkBuild(build), catalog, results)
    expect(e[0]).toMatchObject({ id: 'compat', tone: 'bad' })
  })
})
