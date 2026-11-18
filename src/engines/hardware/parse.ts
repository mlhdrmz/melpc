import type { Disk, DiskBus, DiskMedia, HardwareReading, MemoryFormFactor, MemoryModule } from './types'

// Windows'un donanım bilgisini (PowerShell'in ConvertTo-Json çıktısı) okunur bir biçime çevirir.
// Kodların anlamları: SMBIOS (bellek tipi), Win32_PhysicalMemory (form faktörü), MSFT_PhysicalDisk (veri yolu, ortam),
// Win32_ComputerSystem.PCSystemType ve Win32_SystemEnclosure.ChassisTypes (taşınabilir mi).

type Json = Record<string, unknown>

/** PowerShell tek elemanlı diziyi nesne olarak yazabilir: her zaman dizi döner. */
function list(v: unknown): Json[] {
  if (Array.isArray(v)) return v.filter((x): x is Json => !!x && typeof x === 'object')
  return v && typeof v === 'object' ? [v as Json] : []
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t || null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** SMBIOS bellek tipi kodları (SMBIOS 3.x, "Memory Device — Type"). */
const MEMORY_TYPES: Record<number, string> = {
  20: 'DDR',
  21: 'DDR2',
  24: 'DDR3',
  26: 'DDR4',
  27: 'LPDDR',
  28: 'LPDDR2',
  29: 'LPDDR3',
  30: 'LPDDR4',
  34: 'DDR5',
  35: 'LPDDR5'
}

/** Win32_PhysicalMemory.FormFactor: 8 = DIMM, 12 = SODIMM. */
const FORM_FACTORS: Record<number, MemoryFormFactor> = { 8: 'DIMM', 12: 'SO-DIMM' }

/** MSFT_PhysicalDisk.BusType: 7 = USB, 11 = SATA, 17 = NVMe. */
const BUS_TYPES: Record<number, DiskBus> = { 7: 'USB', 11: 'SATA', 17: 'NVMe' }

/** MSFT_PhysicalDisk.MediaType: 3 = HDD, 4 = SSD. */
const MEDIA_TYPES: Record<number, DiskMedia> = { 3: 'HDD', 4: 'SSD' }

/** Win32_SystemEnclosure.ChassisTypes içinde taşınabilir bilgisayar anlamına gelenler. */
const LAPTOP_CHASSIS = [8, 9, 10, 14, 31, 32]

const WIFI_NAME = /wi-?fi|wireless|wlan|802\.11/i

function memoryModule(m: Json): MemoryModule {
  const bytes = num(m.Capacity)
  const type = num(m.SMBIOSMemoryType)
  const ff = num(m.FormFactor)
  return {
    capacityGb: bytes ? Math.round(bytes / 1024 ** 3) : null,
    speedMts: num(m.ConfiguredClockSpeed) ?? num(m.Speed),
    type: type !== null ? (MEMORY_TYPES[type] ?? null) : null,
    formFactor: ff !== null ? (FORM_FACTORS[ff] ?? null) : null,
    slot: str(m.DeviceLocator),
    partNumber: str(m.PartNumber)
  }
}

function disk(d: Json): Disk | null {
  const name = str(d.FriendlyName)
  if (!name) return null
  const bytes = num(d.Size)
  const bus = num(d.BusType)
  const media = num(d.MediaType)
  return {
    name,
    sizeGb: bytes ? Math.round(bytes / 1e9) : null,
    bus: bus !== null ? (BUS_TYPES[bus] ?? 'diğer') : null,
    media: media !== null ? (MEDIA_TYPES[media] ?? null) : null
  }
}

/** @param raw PowerShell betiğinin JSON çıktısı (bkz. src/main/hardware/reader.ts). */
export function parseHardwareJson(raw: unknown, readAt: string): HardwareReading {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Json
  const system = list(r.system)[0] ?? {}
  const chassis = list(r.enclosure).flatMap((e) => (Array.isArray(e.ChassisTypes) ? e.ChassisTypes : [e.ChassisTypes]))
  const isLaptop =
    num(system.PCSystemType) === 2 || chassis.some((c) => LAPTOP_CHASSIS.includes(num(c) ?? -1))
  // Sistem belleği dizileri (Use = 3); bazı bilgisayarlar flaş bellek dizisini de listeler.
  const arrays = list(r.memoryArray)
  const systemArrays = arrays.filter((a) => num(a.Use) === 3)
  const slotCounts = (systemArrays.length ? systemArrays : arrays).map((a) => num(a.MemoryDevices)).filter((n): n is number => n !== null)
  const board = list(r.board)[0] ?? {}
  return {
    readAt,
    system: {
      manufacturer: str(system.Manufacturer),
      model: str(system.Model),
      family: str(system.SystemFamily),
      isLaptop
    },
    cpus: list(r.cpu)
      .map((c) => ({ name: str(c.Name) ?? '', cores: num(c.NumberOfCores), threads: num(c.NumberOfLogicalProcessors) }))
      .filter((c) => c.name),
    gpus: list(r.gpu)
      .map((g) => ({ name: str(g.Name) ?? '' }))
      .filter((g) => g.name && !/microsoft basic|remote display|virtual/i.test(g.name)),
    memory: {
      slots: slotCounts.length ? slotCounts.reduce((a, b) => a + b, 0) : null,
      modules: list(r.memory).map(memoryModule)
    },
    disks: list(r.disk)
      .map(disk)
      .filter((d): d is Disk => d !== null),
    wifi: list(r.network)
      .filter((n) => n.PhysicalAdapter === true && WIFI_NAME.test(String(n.Name ?? '')))
      .map((n) => ({ name: str(n.Name) as string })),
    board: { manufacturer: str(board.Manufacturer), product: str(board.Product) }
  }
}

/**
 * Cihaz adlarını karşılaştırmak için sadeleştirir: "12th Gen Intel(R) Core(TM) i7-12700H" → "intel core i7-12700h".
 * Blender Open Data'daki adlarla Windows'un adlarını eşleştirmede kullanılır.
 */
export function normalizeDeviceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((r|tm|c)\)|[®™©]/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)\s+gen(eration)?\b/g, ' ')
    .replace(/\b(processor|cpu)\b/g, ' ')
    .replace(/@\s*[\d.]+\s*ghz/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
