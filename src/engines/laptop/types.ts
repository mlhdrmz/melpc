import type { SourceRef } from '../catalog/types'

// Laptop profili (Melih onayladı, 5. aşama): Windows'tan okunamayan yükseltme bilgileri (yuva sayısı, en çok bellek,
// M.2 yuvaları...) üreticinin kılavuzundan, kaynağıyla. Şimdilik yalnızca Melih'in laptopu için (data/laptops).

/** Kaynaklı bir bilgi. value null ise bilinmiyor; o zaman source yoktur, note nedenini söyler. */
export interface Fact<T> {
  value: T | null
  /** sources içindeki anahtar. */
  source?: string
  /** Kaynaktaki ifade ya da açıklama. */
  note?: string
}

export const LAPTOP_STORAGE_FORM_FACTORS = ['M.2 2230', 'M.2 2242', 'M.2 2280'] as const
export const LAPTOP_STORAGE_INTERFACES = ['PCIe 3.0', 'PCIe 4.0', 'PCIe 5.0'] as const
export const LAPTOP_PART_KINDS = ['memory', 'storage', 'wifi', 'battery', 'fans', 'cpu', 'gpu'] as const

export type LaptopPartKind = (typeof LAPTOP_PART_KINDS)[number]

/** SSD yuvasına takılabilen bir seçenek (ör. "M.2 2280, PCIe Gen4 x4, en çok 2 TB"). */
export interface LaptopStorageOption {
  formFactor: (typeof LAPTOP_STORAGE_FORM_FACTORS)[number]
  interface: (typeof LAPTOP_STORAGE_INTERFACES)[number]
  /** Üreticinin yazdığı en büyük kapasite (GB); yazmıyorsa null. */
  maxCapacityGb: number | null
}

export interface LaptopCpuOption {
  name: string
  cores: number
  threads: number
  /** Üreticinin yazdığı işlemci gücü (W). */
  powerW: number
}

export interface LaptopGpuOption {
  name: string
  vramGb: number
  memoryType: string
}

export interface LaptopProfile {
  id: string
  brand: string
  model: string
  /** Windows'un okuduğu üretici ve model (Win32_ComputerSystem) bunlarla aynıysa profil bu bilgisayarındır. */
  identify: { manufacturer: string; model: string }
  sources: Record<string, SourceRef>
  memory: {
    slots: Fact<number>
    formFactor: Fact<'SO-DIMM' | 'lehimli'>
    type: Fact<string>
    speedMts: Fact<number>
    /** Üreticinin listelediği en büyük yapılandırma (GB). */
    maxConfigGb: Fact<number>
    /** Yuva başına izin verilen modül boyları (GB). */
    moduleSizesGb: Fact<number[]>
  }
  storage: {
    /** SSD için M.2 yuvası sayısı (Wi-Fi yuvası hariç). */
    m2Slots: Fact<number>
    options: Fact<LaptopStorageOption[]>
  }
  wifi: {
    slot: Fact<string>
    options: Fact<string[]>
  }
  cpus: Fact<LaptopCpuOption[]>
  /** İşlemci adı → paket ("FCBGA1744"); BGA paket karta lehimlidir. */
  cpuPackages: Fact<Record<string, string>>
  gpus: Fact<LaptopGpuOption[]>
  /** Servis kılavuzunun değiştirilebilir parça listesi; listede olmayan parça değiştirilemez. */
  replaceable: Fact<LaptopPartKind[]>
  addedAt: string
  updatedAt: string
}
