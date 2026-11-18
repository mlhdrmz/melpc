import type { CategoryId, RadiatorMount, RadiatorPosition, SpecValue } from './types'

// Her kategorinin teknik özellik alanları. Doğrulama, filtreler ve arayüzdeki etiketler buradan gelir.

export type SpecKind =
  | 'number'
  | 'integer'
  | 'text'
  | 'enum'
  | 'boolean'
  | 'enumList'
  | 'connectorMap'
  | 'radiatorMounts'

export interface SpecDef {
  key: string
  /** Arayüzde görünen ad (Türkçe). */
  label: string
  kind: SpecKind
  unit?: string
  /** enum ve enumList için geçerli değerler. */
  options?: readonly string[]
  /** Seçeneklerin Türkçe görünen adları (değer farklıysa). */
  optionLabels?: Record<string, string>
  /**
   * Her üründe olmayan alan (ör. AMD "en yüksek turbo gücü" yayımlamaz, hava soğutucunun radyatörü yoktur).
   * Boşsa "bilinmiyor" yerine hiç gösterilmez.
   */
  optional?: boolean
  /** Parça seçme penceresinde filtre olarak sunulur. */
  filter?: boolean
}

export const SOCKETS = ['AM5', 'AM4', 'LGA1851', 'LGA1700'] as const
export const MEMORY_TYPES = ['DDR5', 'DDR4'] as const
export const BOARD_FORM_FACTORS = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'] as const
export const GPU_CONNECTORS = ['16-pin', '8-pin', '6-pin'] as const
export const RADIATOR_POSITIONS: readonly RadiatorPosition[] = ['front', 'top', 'rear', 'bottom', 'side']

export const RADIATOR_POSITION_LABELS: Record<RadiatorPosition, string> = {
  front: 'Ön',
  top: 'Üst',
  rear: 'Arka',
  bottom: 'Alt',
  side: 'Yan'
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  cpu: 'İşlemci',
  motherboard: 'Anakart',
  memory: 'Bellek (RAM)',
  gpu: 'Ekran kartı',
  storage: 'Depolama',
  psu: 'Güç kaynağı',
  case: 'Kasa',
  cooler: 'İşlemci soğutucu'
}

export const SPEC_DEFS: Record<CategoryId, SpecDef[]> = {
  cpu: [
    { key: 'socket', label: 'Soket', kind: 'enum', options: SOCKETS, filter: true },
    { key: 'cores', label: 'Çekirdek', kind: 'integer' },
    { key: 'threads', label: 'İzlek', kind: 'integer' },
    { key: 'baseClockGhz', label: 'Temel saat hızı', kind: 'number', unit: 'GHz' },
    { key: 'boostClockGhz', label: 'En yüksek saat hızı', kind: 'number', unit: 'GHz' },
    // AMD: "Default TDP"; Intel: "Processor Base Power".
    { key: 'tdpW', label: 'TDP / temel güç', kind: 'integer', unit: 'W' },
    // Intel: "Maximum Turbo Power". AMD yayımlamaz.
    { key: 'maxTurboPowerW', label: 'En yüksek turbo gücü', kind: 'integer', unit: 'W', optional: true },
    { key: 'integratedGraphics', label: 'Dahili grafik', kind: 'boolean', filter: true },
    { key: 'memoryTypes', label: 'Desteklenen bellek', kind: 'enumList', options: MEMORY_TYPES, filter: true }
  ],
  motherboard: [
    { key: 'socket', label: 'Soket', kind: 'enum', options: SOCKETS, filter: true },
    { key: 'chipset', label: 'Yonga seti', kind: 'text', filter: true },
    { key: 'formFactor', label: 'Form faktörü', kind: 'enum', options: BOARD_FORM_FACTORS, filter: true },
    { key: 'memoryType', label: 'Bellek tipi', kind: 'enum', options: MEMORY_TYPES, filter: true },
    { key: 'memorySlots', label: 'Bellek yuvası', kind: 'integer' },
    { key: 'maxMemoryGb', label: 'En yüksek bellek', kind: 'integer', unit: 'GB' },
    { key: 'm2Slots', label: 'M.2 yuvası', kind: 'integer' },
    { key: 'sataPorts', label: 'SATA', kind: 'integer' },
    { key: 'pcieX16Slots', label: 'PCIe x16 yuvası', kind: 'integer' }
  ],
  memory: [
    { key: 'memoryType', label: 'Tip', kind: 'enum', options: MEMORY_TYPES, filter: true },
    { key: 'capacityGb', label: 'Toplam kapasite', kind: 'integer', unit: 'GB', filter: true },
    { key: 'modules', label: 'Modül sayısı', kind: 'integer' },
    { key: 'speedMts', label: 'Hız', kind: 'integer', unit: 'MT/s' },
    { key: 'casLatency', label: 'CL', kind: 'integer' },
    { key: 'heightMm', label: 'Yükseklik', kind: 'number', unit: 'mm' }
  ],
  gpu: [
    { key: 'gpuChip', label: 'Grafik işlemcisi', kind: 'text', filter: true },
    { key: 'vramGb', label: 'VRAM', kind: 'integer', unit: 'GB', filter: true },
    { key: 'lengthMm', label: 'Uzunluk', kind: 'number', unit: 'mm' },
    { key: 'slotWidth', label: 'Kalınlık', kind: 'number', unit: 'yuva' },
    { key: 'boardPowerW', label: 'Toplam kart gücü', kind: 'integer', unit: 'W' },
    { key: 'powerConnectors', label: 'Güç soketleri', kind: 'connectorMap' },
    { key: 'recommendedPsuW', label: 'Önerilen güç kaynağı', kind: 'integer', unit: 'W' }
  ],
  storage: [
    {
      key: 'storageType',
      label: 'Tip',
      kind: 'enum',
      options: ['M.2 NVMe', 'SATA SSD', 'SATA HDD'],
      filter: true
    },
    {
      key: 'interface',
      label: 'Arayüz',
      kind: 'enum',
      options: ['PCIe 3.0', 'PCIe 4.0', 'PCIe 5.0', 'SATA III'],
      filter: true
    },
    { key: 'capacityGb', label: 'Kapasite', kind: 'integer', unit: 'GB', filter: true },
    {
      key: 'formFactor',
      label: 'Form faktörü',
      kind: 'enum',
      options: ['M.2 2280', 'M.2 2230', '2.5"', '3.5"']
    },
    // Üreticinin "en fazla" diye verdiği sıralı okuma hızı (4. aşamada eklendi).
    { key: 'seqReadMbps', label: 'Sıralı okuma (üretici)', kind: 'integer', unit: 'MB/s', optional: true }
  ],
  psu: [
    { key: 'wattage', label: 'Güç', kind: 'integer', unit: 'W', filter: true },
    { key: 'efficiency', label: 'Verimlilik sertifikası', kind: 'text', filter: true },
    {
      key: 'atxVersion',
      label: 'ATX sürümü',
      kind: 'enum',
      options: ['ATX 2.x', 'ATX 3.0', 'ATX 3.1'],
      filter: true
    },
    {
      key: 'modularity',
      label: 'Modülerlik',
      kind: 'enum',
      options: ['full', 'semi', 'none'],
      optionLabels: { full: 'Tam modüler', semi: 'Yarı modüler', none: 'Modüler değil' }
    },
    { key: 'lengthMm', label: 'Uzunluk', kind: 'number', unit: 'mm' },
    { key: 'gpuConnectors', label: 'Ekran kartı güç soketleri', kind: 'connectorMap' }
  ],
  case: [
    {
      key: 'motherboardSupport',
      label: 'Desteklenen anakartlar',
      kind: 'enumList',
      options: BOARD_FORM_FACTORS,
      filter: true
    },
    { key: 'maxGpuLengthMm', label: 'En uzun ekran kartı', kind: 'number', unit: 'mm' },
    { key: 'maxCoolerHeightMm', label: 'En yüksek hava soğutucu', kind: 'number', unit: 'mm' },
    { key: 'radiatorMounts', label: 'Radyatör yerleri', kind: 'radiatorMounts' },
    { key: 'maxPsuLengthMm', label: 'Güç kaynağı uzunluk sınırı', kind: 'number', unit: 'mm' }
  ],
  cooler: [
    {
      key: 'coolerType',
      label: 'Tip',
      kind: 'enum',
      options: ['air', 'liquid'],
      optionLabels: { air: 'Hava', liquid: 'Sıvı' },
      filter: true
    },
    { key: 'sockets', label: 'Desteklenen soketler', kind: 'enumList', options: SOCKETS, filter: true },
    { key: 'heightMm', label: 'Yükseklik', kind: 'number', unit: 'mm', optional: true },
    { key: 'radiatorSizeMm', label: 'Radyatör boyu', kind: 'integer', unit: 'mm', optional: true }
  ]
}

export function getSpecDef(category: CategoryId, key: string): SpecDef | undefined {
  return SPEC_DEFS[category].find((d) => d.key === key)
}

const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })

export function formatNumber(n: number): string {
  return numberFormat.format(n)
}

/** Bir değeri arayüzde gösterilecek Türkçe metne çevirir. null → "bilinmiyor". */
export function formatSpecValue(def: SpecDef, value: SpecValue | null): string {
  if (value === null || value === undefined) return 'bilinmiyor'
  const label = (v: string): string => def.optionLabels?.[v] ?? v
  switch (def.kind) {
    case 'number':
    case 'integer': {
      const n = formatNumber(value as number)
      return def.unit ? `${n} ${def.unit}` : n
    }
    case 'boolean':
      return value ? 'Var' : 'Yok'
    case 'enum':
    case 'text':
      return label(value as string)
    case 'enumList':
      return (value as string[]).map(label).join(', ')
    case 'connectorMap': {
      const entries = Object.entries(value as Record<string, number>).filter(([, n]) => n > 0)
      return entries.length ? entries.map(([k, n]) => `${n} × ${k}`).join(', ') : 'Yok'
    }
    case 'radiatorMounts':
      return (value as RadiatorMount[])
        .map(
          (m) =>
            `${RADIATOR_POSITION_LABELS[m.position]}: ${
              m.sizesMm ? `${m.sizesMm.join(' / ')} mm` : `en fazla ${m.maxMm} mm`
            }`
        )
        .join(' · ')
  }
}
