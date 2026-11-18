// "Bilgisayarım" (5. aşama): Windows'un donanım bilgisinden (WMI/CIM) okunanlar.
// Seri numaraları okunmaz. Windows'un yanlış raporladığı değerler alınmaz: ekran kartı belleği (4 GB'ta kesilir)
// ve bellek üst sınırı (takılı bellekten küçük görünebilir) burada yoktur; bunlar laptop profilinden gelir.

export type MemoryFormFactor = 'DIMM' | 'SO-DIMM'
export type DiskBus = 'NVMe' | 'SATA' | 'USB' | 'diğer'
export type DiskMedia = 'SSD' | 'HDD'

export interface MemoryModule {
  /** GB (1024³ bayt). */
  capacityGb: number | null
  /** Çalıştığı hız (MT/s). */
  speedMts: number | null
  /** "DDR5", "LPDDR5" ... */
  type: string | null
  formFactor: MemoryFormFactor | null
  /** Yuvanın adı ("DIMM A"). */
  slot: string | null
  /** Modülün ürün kodu (seri numarası değil). */
  partNumber: string | null
}

export interface Disk {
  name: string
  /** GB (10⁹ bayt; diskler bu birimle satılır). */
  sizeGb: number | null
  bus: DiskBus | null
  media: DiskMedia | null
}

export interface HardwareReading {
  /** Okunduğu zaman (ISO). */
  readAt: string
  system: {
    manufacturer: string | null
    model: string | null
    family: string | null
    /** Windows'a göre taşınabilir bilgisayar (PCSystemType ya da kasa tipi). */
    isLaptop: boolean
  }
  cpus: { name: string; cores: number | null; threads: number | null }[]
  gpus: { name: string }[]
  memory: {
    /** Bellek yuvası sayısı (Win32_PhysicalMemoryArray.MemoryDevices). */
    slots: number | null
    modules: MemoryModule[]
  }
  disks: Disk[]
  wifi: { name: string }[]
  board: { manufacturer: string | null; product: string | null }
}
