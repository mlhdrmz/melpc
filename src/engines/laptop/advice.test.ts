import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCatalogFiles } from '../catalog/loader'
import { resolvePart } from '../catalog/validate'
import { parseBenchmarkFiles } from '../benchmark/validate'
import type { HardwareReading, MemoryModule } from '../hardware/types'
import { buildLaptopAdvice, displayDeviceName, formatCapacity } from './advice'
import { parseLaptopFiles } from './validate'

// Gerçek katalog, ölçümler ve Dell G15 5520 profiliyle; okumalar test için kurulmuştur.

const root = join(__dirname, '..', '..', '..', 'data')
const read = (dir: string): { name: string; content: string }[] =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.json'))
    .map((name) => ({ name, content: readFileSync(join(root, dir, name), 'utf8') }))
const records = parseCatalogFiles(read('catalog')).records
const parts = records.map(resolvePart)
const results = parseBenchmarkFiles(read('benchmarks'), records).results
const profiles = parseLaptopFiles(read('laptops')).profiles

const mod = (capacityGb: number, slot: string): MemoryModule => ({
  capacityGb,
  speedMts: 4800,
  type: 'DDR5',
  formFactor: 'SO-DIMM',
  slot,
  partNumber: null
})

const g15 = (modules: MemoryModule[], disks = [{ name: 'Test NVMe 1024GB', sizeGb: 1024, bus: 'NVMe' as const, media: 'SSD' as const }]): HardwareReading => ({
  readAt: '2026-11-18T10:00:00.000Z',
  system: { manufacturer: 'Dell Inc.', model: 'Dell G15 5520', family: 'GSeries', isLaptop: true },
  cpus: [{ name: '12th Gen Intel(R) Core(TM) i7-12700H', cores: 14, threads: 20 }],
  gpus: [{ name: 'Intel(R) Iris(R) Xe Graphics' }, { name: 'NVIDIA GeForce RTX 3060 Laptop GPU' }],
  memory: { slots: 2, modules },
  disks,
  wifi: [{ name: 'Killer(R) Wi-Fi 6 AX1650i 160MHz Wireless Network Adapter (201NGW)' }],
  board: { manufacturer: 'Dell Inc.', product: 'TEST' }
})

describe('Bilgisayarım: yükseltme önerileri', () => {
  it('iki yuva en büyük modülle dolu, tek SSD yuvası dolu', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')]), profiles, parts, results)
    expect(a.profile?.id).toBe('dell-g15-5520')
    const memory = a.items.find((i) => i.kind === 'memory')!
    expect(memory).toMatchObject({ status: 'Dolu', tone: 'full', sources: ['memory'] })
    expect(memory.lines).toEqual([
      'İki yuva da 32 GB modülle dolu. Dell yuva başına en çok 32 GB yazıyor; daha fazla eklenemez.',
      "Dell'in listelediği en büyük yapılandırma 32 GB; sende 64 GB takılı ve Windows 64 GB görüyor."
    ])
    const storage = a.items.find((i) => i.kind === 'storage')!
    expect(storage).toMatchObject({ status: 'Yerine takılabilir', tone: 'up' })
    expect(storage.lines[0]).toBe('Tek M.2 yuvası var ve dolu: ikinci SSD takılamaz; yükseltme mevcut diskin yerine.')
    expect(storage.lines[1]).toBe('Yuvaya takılabilenler: M.2 2280 (PCIe 4.0, en çok 2 TB) ya da M.2 2230 (PCIe 4.0, en çok 1 TB).')
  })

  it('SSD adayları: soğutucusuz olduğu bilinen, yuvaya uyan, mevcut diskten küçük olmayan M.2 NVMe SSD\'ler', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')]), profiles, parts, results)
    const ids = a.storageCandidates.map((c) => c.partId)
    expect(ids).toEqual(
      expect.arrayContaining(['storage-samsung-990-pro-2-tb', 'storage-samsung-990-pro-1-tb', 'storage-samsung-990-evo-plus-2-tb', 'storage-lexar-nm610pro-1-tb'])
    )
    // 500 GB mevcut diskten küçük; SN850X ve T705'in soğutucu bilgisi bilinmiyor; SATA ve 2,5 inç uymaz.
    for (const id of ['storage-lexar-nm610pro-500-gb', 'storage-sandisk-wd-black-sn850x-2-tb', 'storage-crucial-t705-2-tb', 'storage-samsung-870-evo-1-tb']) {
      expect(ids).not.toContain(id)
    }
    expect(a.unknownHeatsink).toBeGreaterThan(0)
    // PCIe 5.0 SSD önerilir ama yuvanın hızında çalışacağı yazılır.
    expect(a.storageCandidates.find((c) => c.partId === 'storage-samsung-9100-pro-2-tb')?.note).toBe(
      'PCIe 5.0 SSD bu yuvada PCIe 4.0 hızında çalışır; üreticinin okuma hızına ulaşamaz.'
    )
    expect(a.storageCandidates.find((c) => c.partId === 'storage-samsung-990-pro-2-tb')?.note).toBeUndefined()
  })

  it('boş yuva ve büyütülebilir bellek', () => {
    const one = buildLaptopAdvice(g15([mod(16, 'DIMM A')]), profiles, parts, results).items.find((i) => i.kind === 'memory')!
    expect(one).toMatchObject({ status: 'Boş yuva var', tone: 'up' })
    expect(one.lines[0]).toBe('2 yuvadan 1 tanesi boş. Dell yuva başına en çok 32 GB yazıyor.')
    const two = buildLaptopAdvice(g15([mod(16, 'DIMM A'), mod(16, 'DIMM B')]), profiles, parts, results).items.find((i) => i.kind === 'memory')!
    expect(two).toMatchObject({ status: 'Büyütülebilir', tone: 'up' })
    expect(two.lines[1]).toBe("Dell'in listelediği en büyük yapılandırma 32 GB; sende 32 GB takılı.")
  })

  it('SSD yuvası boşsa ikinci SSD önerilir', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')], []), profiles, parts, results)
    expect(a.items.find((i) => i.kind === 'storage')).toMatchObject({ status: 'Boş yuva var' })
    // Değiştirmiyorsa küçük SSD de uyar.
    expect(a.storageCandidates.map((c) => c.partId)).toContain('storage-lexar-nm610pro-500-gb')
  })

  it('okunan donanım: ekran kartı belleği kılavuzdan, öbürleri Windows\'tan', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')]), profiles, parts, results)
    expect(a.hardware.map((h) => [h.label, h.value, h.from])).toEqual([
      ['Bilgisayar', 'Dell G15 5520', 'windows'],
      ['İşlemci', 'Intel Core i7-12700H · 14 çekirdek / 20 izlek', 'windows'],
      ['Diğer ekran kartı', 'Intel Iris Xe Graphics', 'windows'],
      ['Ekran kartı', 'NVIDIA GeForce RTX 3060 Laptop GPU · 6 GB GDDR6', 'profile'],
      ['Bellek', '2 × 32 GB DDR5-4800 SO-DIMM · toplam 64 GB', 'windows'],
      ['Depolama', 'Test NVMe 1024GB · 1 TB · NVMe', 'windows'],
      ['Wi-Fi', 'Killer Wi-Fi 6 AX1650i 160MHz Wireless Network Adapter (201NGW)', 'windows']
    ])
  })

  it('Wi-Fi bilgi; işlemci lehimli (Intel paketi), ekran kartı değiştirilemez', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')]), profiles, parts, results)
    expect(a.items.find((i) => i.kind === 'wifi')).toMatchObject({
      status: 'Bilgi',
      lines: ["M.2 2230 kart. Dell'in seçenekleri: Intel AX201 ya da Killer 1650i. Sende: Killer Wi-Fi 6 AX1650i 160MHz Wireless Network Adapter (201NGW)."],
      sources: ['slots', 'wireless']
    })
    expect(a.items.find((i) => i.kind === 'cpu')).toMatchObject({ status: 'Lehimli', sources: ['intel', 'parts'] })
    expect(a.items.find((i) => i.kind === 'gpu')).toMatchObject({ status: 'Değiştirilemez', sources: ['parts'] })
  })

  it('performans: laptopun parçaları katalogla aynı ölçekte; oran hemen üstteki parçaya göre', () => {
    const a = buildLaptopAdvice(g15([mod(32, 'DIMM A'), mod(32, 'DIMM B')]), profiles, parts, results)
    const cpu = a.performance.find((p) => p.category === 'cpu')!
    expect(cpu.entries.find((e) => e.mine)).toMatchObject({ name: 'Intel Core i7-12700H', value: 176.79 })
    expect(cpu.entries.map((e) => e.value)).toEqual([...cpu.entries.map((e) => e.value)].sort((x, y) => y - x))
    expect(cpu.reference?.name).toBe('AMD Ryzen 5 7600')
    expect(Math.round((cpu.reference?.ratio ?? 0) * 100)).toBe(84)
    const gpu = a.performance.find((p) => p.category === 'gpu')!
    expect(gpu.entries.find((e) => e.mine)).toMatchObject({ name: 'NVIDIA GeForce RTX 3060 Laptop GPU', value: 1957.21 })
    expect(gpu.missing).toBeUndefined()
  })

  it('profili olmayan bilgisayar: yalnızca okunan donanım ve performans', () => {
    const r = g15([mod(8, 'DIMM A')])
    const a = buildLaptopAdvice({ ...r, system: { ...r.system, model: 'Test Laptop 9' } }, profiles, parts, results)
    expect(a.profile).toBeNull()
    expect(a.items).toEqual([])
    expect(a.hardware.find((h) => h.label === 'Ekran kartı')?.value).toBe('Intel Iris Xe Graphics')
  })

  it('gösterim yardımcıları', () => {
    expect(displayDeviceName('12th Gen Intel(R) Core(TM) i7-12700H')).toBe('Intel Core i7-12700H')
    expect(formatCapacity(1024)).toBe('1 TB')
    expect(formatCapacity(2000)).toBe('2 TB')
    expect(formatCapacity(1500)).toBe('1,5 TB')
    expect(formatCapacity(500)).toBe('500 GB')
  })
})
