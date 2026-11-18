import type { Part } from '../catalog/types'
import type { BenchmarkResult } from '../benchmark/types'
import { resultsForDevice, resultsForPart } from '../benchmark/validate'
import type { HardwareReading } from '../hardware/types'
import type { LaptopProfile, LaptopStorageOption } from './types'
import { findLaptopProfile, matchCpuOption, matchGpuOption } from './validate'

// Bilgisayarım (Melih onayladı, 5. aşama): okunan donanım + laptop profili → ekranda gösterilecekler.
// Kurallar yalnızca kaynaktaki sayılarla çalışır; bilinmeyen bilgi "bilinmiyor" kalır, tahmin edilmez.

export type AdviceTone = 'full' | 'up' | 'info' | 'fixed' | 'unknown'

export interface AdviceItem {
  kind: 'memory' | 'storage' | 'wifi' | 'cpu' | 'gpu'
  title: string
  /** Kısa durum: "Dolu", "Yerine takılabilir", "Lehimli"... */
  status: string
  tone: AdviceTone
  lines: string[]
  /** Profildeki kaynak anahtarları. */
  sources: string[]
}

export interface HardwareRow {
  label: string
  value: string
  /** Değerin geldiği yer: Windows'un okuması ya da üreticinin kılavuzu (profil). */
  from: 'windows' | 'profile'
  note?: string
  sourceKey?: string
}

export interface StorageCandidate {
  partId: string
  /** Ör. "PCIe 5.0 SSD bu yuvada PCIe 4.0 hızında çalışır." */
  note?: string
}

export interface PerfEntry {
  name: string
  value: number
  /** Laptopun kendi parçası mı. */
  mine: boolean
  result: BenchmarkResult
}

export interface PerfCompare {
  category: 'cpu' | 'gpu'
  /** Büyükten küçüğe. Laptopun parçası ölçümü varsa içindedir. */
  entries: PerfEntry[]
  /** Laptopun parçası ve hemen üstündeki katalog parçasına oranı (ör. 0,84). */
  reference: { name: string; ratio: number } | null
  /** Laptopun parçasının ölçümü yoksa nedeni. */
  missing?: string
}

export interface LaptopAdvice {
  profile: LaptopProfile | null
  hardware: HardwareRow[]
  items: AdviceItem[]
  storageCandidates: StorageCandidate[]
  /** Soğutucu bilgisi bilinmediği için önerilmeyen SSD sayısı. */
  unknownHeatsink: number
  performance: PerfCompare[]
}

const INTERFACE_RANK: Record<string, number> = { 'PCIe 3.0': 3, 'PCIe 4.0': 4, 'PCIe 5.0': 5 }

/** "12th Gen Intel(R) Core(TM) i7-12700H" → "Intel Core i7-12700H" (yalnızca gösterim için). */
export function displayDeviceName(name: string): string {
  return name
    .replace(/\((R|TM|C)\)|[®™©]/gi, '')
    .replace(/^\s*\d+(st|nd|rd|th)\s+Gen(eration)?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 1024 → "1 TB", 500 → "500 GB". */
export function formatCapacity(gb: number): string {
  if (gb >= 1000) {
    const tb = Math.round((gb / 1000) * 10) / 10
    return `${String(tb).replace('.', ',')} TB`
  }
  return `${gb} GB`
}

function spec<T>(part: Part, key: string): T | null {
  return (part.specs[key]?.value ?? null) as T | null
}

function list(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ya da ${xs[xs.length - 1]}`
}

// ---------- Okunan donanım ----------

function hardwareRows(r: HardwareReading, p: LaptopProfile | null): HardwareRow[] {
  const rows: HardwareRow[] = []
  if (r.system.model) rows.push({ label: 'Bilgisayar', value: r.system.model, from: 'windows' })
  for (const c of r.cpus) {
    const counts = c.cores && c.threads ? ` · ${c.cores} çekirdek / ${c.threads} izlek` : ''
    rows.push({ label: 'İşlemci', value: `${displayDeviceName(c.name)}${counts}`, from: 'windows' })
  }
  for (const g of r.gpus) {
    const opt = p?.gpus.value ? matchGpuOption(g.name, p.gpus.value) : null
    if (opt) {
      rows.push({
        label: 'Ekran kartı',
        value: `${displayDeviceName(g.name)} · ${opt.vramGb} GB ${opt.memoryType}`,
        from: 'profile',
        sourceKey: p?.gpus.source,
        note: "Ekran kartı belleği kılavuzdan; Windows bu değeri 4 GB'ta kestiği için yanlış gösterebilir."
      })
    } else rows.push({ label: p ? 'Diğer ekran kartı' : 'Ekran kartı', value: displayDeviceName(g.name), from: 'windows' })
  }
  const mods = r.memory.modules
  if (mods.length) {
    const same = mods.every((m) => m.capacityGb === mods[0].capacityGb && m.type === mods[0].type && m.speedMts === mods[0].speedMts)
    const describe = (m: (typeof mods)[number]): string =>
      [m.capacityGb ? `${m.capacityGb} GB` : null, m.type && m.speedMts ? `${m.type}-${m.speedMts}` : m.type, m.formFactor].filter(Boolean).join(' ')
    const total = mods.reduce((s, m) => s + (m.capacityGb ?? 0), 0)
    rows.push({
      label: 'Bellek',
      value: `${same ? `${mods.length} × ${describe(mods[0])}` : mods.map(describe).join(' + ')} · toplam ${total} GB`,
      from: 'windows'
    })
  }
  for (const d of r.disks) {
    const extra = [d.sizeGb ? formatCapacity(d.sizeGb) : null, d.bus].filter(Boolean).join(' · ')
    rows.push({ label: 'Depolama', value: extra ? `${d.name} · ${extra}` : d.name, from: 'windows' })
  }
  for (const w of r.wifi) rows.push({ label: 'Wi-Fi', value: displayDeviceName(w.name), from: 'windows' })
  return rows
}

// ---------- Bellek ----------

function memoryItem(r: HardwareReading, p: LaptopProfile): AdviceItem {
  const m = p.memory
  const item: AdviceItem = { kind: 'memory', title: 'Bellek', status: 'Bilinmiyor', tone: 'unknown', lines: [], sources: m.slots.source ? [m.slots.source] : [] }
  if (m.formFactor.value === 'lehimli') {
    return { ...item, status: 'Lehimli', tone: 'fixed', lines: [`${p.brand} belleği karta lehimli yazıyor; değiştirilemez.`] }
  }
  const slots = m.slots.value
  const sizes = m.moduleSizesGb.value
  const used = r.memory.modules.length
  const total = r.memory.modules.reduce((s, x) => s + (x.capacityGb ?? 0), 0)
  if (!slots || !sizes?.length) {
    return { ...item, lines: ['Kılavuzda yuva sayısı ya da modül boyları yok.'] }
  }
  const maxModule = Math.max(...sizes)
  if (used < slots) {
    item.status = 'Boş yuva var'
    item.tone = 'up'
    item.lines.push(`${slots} yuvadan ${slots - used} tanesi boş. ${p.brand} yuva başına en çok ${maxModule} GB yazıyor.`)
  } else if (r.memory.modules.every((x) => (x.capacityGb ?? 0) >= maxModule)) {
    item.status = 'Dolu'
    item.tone = 'full'
    item.lines.push(
      `${slots === 2 ? 'İki' : slots} yuva da ${maxModule} GB modülle dolu. ${p.brand} yuva başına en çok ${maxModule} GB yazıyor; daha fazla eklenemez.`
    )
  } else {
    item.status = 'Büyütülebilir'
    item.tone = 'up'
    item.lines.push(`Yuvalar dolu ama ${maxModule} GB'tan küçük modül var; daha büyük modülle değiştirilebilir (yuva başına en çok ${maxModule} GB).`)
  }
  const maxConfig = m.maxConfigGb.value
  if (maxConfig !== null && total > maxConfig) {
    item.lines.push(`${p.brand}'in listelediği en büyük yapılandırma ${maxConfig} GB; sende ${total} GB takılı ve Windows ${total} GB görüyor.`)
  } else if (maxConfig !== null) {
    item.lines.push(`${p.brand}'in listelediği en büyük yapılandırma ${maxConfig} GB; sende ${total} GB takılı.`)
  }
  return item
}

// ---------- SSD ----------

function describeOption(o: LaptopStorageOption): string {
  return `${o.formFactor} (${o.interface}${o.maxCapacityGb ? `, en çok ${formatCapacity(o.maxCapacityGb)}` : ''})`
}

function storageAdvice(
  r: HardwareReading,
  p: LaptopProfile,
  parts: Part[]
): { item: AdviceItem; candidates: StorageCandidate[]; unknownHeatsink: number } {
  const s = p.storage
  const item: AdviceItem = { kind: 'storage', title: 'SSD', status: 'Bilinmiyor', tone: 'unknown', lines: [], sources: s.m2Slots.source ? [s.m2Slots.source] : [] }
  const slots = s.m2Slots.value
  const options = s.options.value ?? []
  const nvme = r.disks.filter((d) => d.bus === 'NVMe')
  if (slots === null || !options.length) {
    return { item: { ...item, lines: ['Kılavuzda M.2 yuvalarının bilgisi yok.'] }, candidates: [], unknownHeatsink: 0 }
  }
  const replacing = nvme.length >= slots
  item.tone = 'up'
  item.status = replacing ? 'Yerine takılabilir' : 'Boş yuva var'
  item.lines.push(
    replacing
      ? `${slots === 1 ? 'Tek M.2 yuvası var ve dolu' : `${slots} M.2 yuvasının hepsi dolu`}: ikinci SSD takılamaz; yükseltme mevcut diskin yerine.`
      : `${slots - nvme.length} boş M.2 yuvası var: ikinci SSD takılabilir.`
  )
  item.lines.push(`Yuvaya takılabilenler: ${list(options.map(describeOption))}.`)

  // Laptopa yalnızca soğutucusuz olduğu kaynakla bilinen M.2 NVMe SSD'ler önerilir (5. karar).
  const current = replacing ? Math.max(0, ...nvme.map((d) => d.sizeGb ?? 0)) : 0
  const candidates: StorageCandidate[] = []
  let unknownHeatsink = 0
  for (const part of parts) {
    if (part.category !== 'storage' || spec<string>(part, 'storageType') !== 'M.2 NVMe') continue
    const ff = spec<string>(part, 'formFactor')
    const option = options.find((o) => o.formFactor === ff)
    const cap = spec<number>(part, 'capacityGb')
    if (!option || cap === null) continue
    if (option.maxCapacityGb !== null && cap > option.maxCapacityGb) continue
    // Mevcut diskin yerine takılacaksa en az onun kapasitesinde olsun (1024 GB'lık disk "1 TB" sayılır).
    if (replacing && cap < current * 0.9) continue
    const heatsink = spec<boolean>(part, 'heatsink')
    if (heatsink === null) {
      unknownHeatsink++
      continue
    }
    if (heatsink) continue
    const iface = spec<string>(part, 'interface')
    const note =
      iface && (INTERFACE_RANK[iface] ?? 0) > (INTERFACE_RANK[option.interface] ?? 0)
        ? `${iface} SSD bu yuvada ${option.interface} hızında çalışır; üreticinin okuma hızına ulaşamaz.`
        : undefined
    candidates.push({ partId: part.id, ...(note ? { note } : {}) })
  }
  return { item, candidates, unknownHeatsink }
}

// ---------- Wi-Fi, işlemci, ekran kartı ----------

function wifiItem(r: HardwareReading, p: LaptopProfile): AdviceItem {
  const lines: string[] = []
  const slot = p.wifi.slot.value
  const options = p.wifi.options.value
  lines.push(
    `${slot ? `${slot} kart.` : 'Kart.'}${options?.length ? ` ${p.brand}'in seçenekleri: ${list(options)}.` : ''}${
      r.wifi[0] ? ` Sende: ${displayDeviceName(r.wifi[0].name)}.` : ''
    }`
  )
  return {
    kind: 'wifi',
    title: 'Wi-Fi',
    status: 'Bilgi',
    tone: 'info',
    lines,
    sources: [p.wifi.slot.source, p.wifi.options.source].filter((x): x is string => !!x)
  }
}

function fixedItems(r: HardwareReading, p: LaptopProfile): AdviceItem[] {
  const replaceable = p.replaceable.value
  if (!replaceable) return []
  const items: AdviceItem[] = []
  const partsSource = p.replaceable.source ? [p.replaceable.source] : []
  if (!replaceable.includes('cpu')) {
    const cpu = r.cpus[0]
    const opt = cpu && p.cpus.value ? matchCpuOption(cpu.name, p.cpus.value) : null
    const pkg = opt ? p.cpuPackages.value?.[opt.name] : undefined
    const bga = pkg !== undefined && /BGA/i.test(pkg)
    items.push({
      kind: 'cpu',
      title: 'İşlemci',
      status: bga ? 'Lehimli' : 'Değiştirilemez',
      tone: 'fixed',
      lines: [
        ...(bga ? [`Paket "${pkg}" (BGA): karta lehimli.`] : []),
        `${p.brand}'in servis kılavuzunda ayrı değiştirilebilir parça olarak yok.`
      ],
      sources: [...(bga && p.cpuPackages.source ? [p.cpuPackages.source] : []), ...partsSource]
    })
  }
  if (!replaceable.includes('gpu')) {
    items.push({
      kind: 'gpu',
      title: 'Ekran kartı',
      status: 'Değiştirilemez',
      tone: 'fixed',
      lines: [`${p.brand}'in servis kılavuzunda ayrı değiştirilebilir parça olarak yok.`],
      sources: partsSource
    })
  }
  return items
}

// ---------- Performans ----------

/** Katalogdaki en güçlü parça, laptopunkinin hemen üstündeki iki ve hemen altındaki bir parça. */
function pickNeighbours(others: PerfEntry[], mine: number): PerfEntry[] {
  const sorted = [...others].sort((a, b) => b.value - a.value)
  const above = sorted.filter((e) => e.value >= mine)
  const below = sorted.filter((e) => e.value < mine)
  const picked = new Set<PerfEntry>()
  if (sorted[0]) picked.add(sorted[0])
  for (const e of above.slice(-2)) picked.add(e)
  if (below[0]) picked.add(below[0])
  return [...picked]
}

function perfCompare(category: 'cpu' | 'gpu', r: HardwareReading, parts: Part[], results: BenchmarkResult[]): PerfCompare {
  const names = category === 'cpu' ? r.cpus.map((c) => c.name) : r.gpus.map((g) => g.name)
  let mineEntry: PerfEntry | null = null
  for (const name of names) {
    const res = resultsForDevice(results, name, category).find((x) => x.test === 'blender-cycles')
    if (res) {
      mineEntry = { name: displayDeviceName(name), value: res.value, mine: true, result: res }
      break
    }
  }
  // Katalogdaki karşılaştırma noktaları: işlemcide parçalar, ekran kartında grafik işlemcileri.
  const others: PerfEntry[] = []
  if (category === 'cpu') {
    for (const part of parts.filter((p) => p.category === 'cpu')) {
      const res = resultsForPart(results, part).find((x) => x.test === 'blender-cycles')
      if (res) others.push({ name: `${part.brand} ${part.model}`, value: res.value, mine: false, result: res })
    }
  } else {
    for (const res of results) {
      if (res.test === 'blender-cycles' && 'gpuChip' in res.subject) others.push({ name: res.subject.gpuChip, value: res.value, mine: false, result: res })
    }
  }
  if (!mineEntry) {
    return {
      category,
      entries: [...others].sort((a, b) => b.value - a.value).slice(0, 4),
      reference: null,
      missing: `${category === 'cpu' ? 'İşlemcinin' : 'Ekran kartının'} ölçümü yok.`
    }
  }
  const picked = pickNeighbours(others, mineEntry.value)
  const above = others.filter((e) => e.value >= mineEntry.value).sort((a, b) => a.value - b.value)[0]
  return {
    category,
    entries: [...picked, mineEntry].sort((a, b) => b.value - a.value),
    reference: above ? { name: above.name, ratio: mineEntry.value / above.value } : null
  }
}

// ---------- Hepsi ----------

export function buildLaptopAdvice(
  reading: HardwareReading,
  profiles: LaptopProfile[],
  parts: Part[],
  results: BenchmarkResult[]
): LaptopAdvice {
  const profile = findLaptopProfile(reading, profiles)
  const performance = [perfCompare('cpu', reading, parts, results), perfCompare('gpu', reading, parts, results)]
  if (!profile) {
    return { profile: null, hardware: hardwareRows(reading, null), items: [], storageCandidates: [], unknownHeatsink: 0, performance }
  }
  const storage = storageAdvice(reading, profile, parts)
  return {
    profile,
    hardware: hardwareRows(reading, profile),
    items: [memoryItem(reading, profile), storage.item, wifiItem(reading, profile), ...fixedItems(reading, profile)],
    storageCandidates: storage.candidates,
    unknownHeatsink: storage.unknownHeatsink,
    performance
  }
}
