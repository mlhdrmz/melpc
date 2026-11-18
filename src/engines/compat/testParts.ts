import type { CategoryId, Part, SpecValue } from '../catalog/types'

// Yalnızca testler için: gerçek ürün değildir, değerler test senaryolarına göre seçilmiştir.

const TEST_SOURCE = { url: 'https://example.test/kaynak', retrieved: '2026-01-01' }

export function testPart(category: CategoryId, specs: Record<string, SpecValue | null>, id?: string): Part {
  return {
    id: id ?? `test-${category}`,
    category,
    brand: 'Test',
    model: `Test ${category}`,
    specs: Object.fromEntries(
      Object.entries(specs).map(([k, v]) => [k, { value: v, source: v === null ? null : TEST_SOURCE }])
    ),
    addedAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

export const cpuAm5 = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('cpu', { socket: 'AM5', tdpW: 120, memoryTypes: ['DDR5'], ...over })

export const boardAm5Atx = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('motherboard', {
    socket: 'AM5',
    formFactor: 'ATX',
    memoryType: 'DDR5',
    memorySlots: 4,
    maxMemoryGb: 192,
    m2Slots: 2,
    sataPorts: 4,
    ...over
  })

export const ramDdr5 = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('memory', { memoryType: 'DDR5', capacityGb: 32, modules: 2, ...over })

export const gpu = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('gpu', {
    lengthMm: 304,
    boardPowerW: 300,
    recommendedPsuW: 750,
    powerConnectors: { '16-pin': 1 },
    ...over
  })

export const psu = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('psu', { wattage: 850, lengthMm: 160, gpuConnectors: { '16-pin': 1, '8-pin': 3 }, ...over })

export const caseAtx = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('case', {
    motherboardSupport: ['ATX', 'Micro-ATX', 'Mini-ITX'],
    maxGpuLengthMm: 360,
    maxCoolerHeightMm: 165,
    maxPsuLengthMm: 200,
    radiatorMounts: [
      { position: 'top', sizesMm: [240, 280, 360] },
      { position: 'front', sizesMm: [240, 280] }
    ],
    ...over
  })

export const airCooler = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('cooler', { coolerType: 'air', sockets: ['AM5', 'AM4', 'LGA1851', 'LGA1700'], heightMm: 158, ...over })

export const liquidCooler = (over: Record<string, SpecValue | null> = {}): Part =>
  testPart('cooler', { coolerType: 'liquid', sockets: ['AM5', 'AM4'], radiatorSizeMm: 360, ...over })

export const nvme = (id = 'test-nvme'): Part => testPart('storage', { storageType: 'M.2 NVMe' }, id)
export const sataSsd = (id = 'test-sata'): Part => testPart('storage', { storageType: 'SATA SSD' }, id)
