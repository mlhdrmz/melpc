import type { CatalogLoadError } from '../catalog/types'
import { normalizeDeviceName } from '../hardware/parse'
import type { HardwareReading } from '../hardware/types'
import {
  LAPTOP_PART_KINDS,
  LAPTOP_STORAGE_FORM_FACTORS,
  LAPTOP_STORAGE_INTERFACES,
  type LaptopCpuOption,
  type LaptopGpuOption,
  type LaptopProfile
} from './types'

// Laptop profillerinin (data/laptops/*.json) doğrulaması ve okunan bilgisayarla eşleştirilmesi.
// Katalogdaki kural burada da geçerli: değeri olan her bilginin tanımlı bir kaynağı vardır.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[a-z0-9][a-z0-9-]*$/

type Check = (v: unknown) => string | null
type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const text: Check = (v) => (typeof v === 'string' && v.trim() ? null : 'metin olmalı')
const posInt: Check = (v) => (Number.isInteger(v) && (v as number) > 0 ? null : 'pozitif tam sayı olmalı')
const count: Check = (v) => (Number.isInteger(v) && (v as number) >= 0 ? null : 'tam sayı olmalı')
const oneOf =
  (options: readonly string[]): Check =>
  (v) =>
    typeof v === 'string' && options.includes(v) ? null : `şunlardan biri olmalı: ${options.join(', ')}`
const listOf =
  (item: Check): Check =>
  (v) => {
    if (!Array.isArray(v) || !v.length) return 'boş olmayan liste olmalı'
    for (const x of v) {
      const e = item(x)
      if (e) return e
    }
    return null
  }
const shape =
  (fields: Record<string, Check>): Check =>
  (v) => {
    if (!isObj(v)) return 'nesne olmalı'
    for (const [k, check] of Object.entries(fields)) {
      const e = check(v[k])
      if (e) return `${k}: ${e}`
    }
    return null
  }
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null ? null : check(v)

const storageOption = shape({
  formFactor: oneOf(LAPTOP_STORAGE_FORM_FACTORS),
  interface: oneOf(LAPTOP_STORAGE_INTERFACES),
  maxCapacityGb: nullable(posInt)
})
const cpuOption = shape({ name: text, cores: posInt, threads: posInt, powerW: posInt })
const gpuOption = shape({ name: text, vramGb: posInt, memoryType: text })
const packages: Check = (v) =>
  isObj(v) && Object.keys(v).length && Object.values(v).every((x) => typeof x === 'string' && x.trim())
    ? null
    : 'işlemci adı → paket eşlemesi olmalı'

/** Profildeki bilgilerin yolu ve değer kuralı. */
const FACTS: [string, Check][] = [
  ['memory.slots', count],
  ['memory.formFactor', oneOf(['SO-DIMM', 'lehimli'])],
  ['memory.type', text],
  ['memory.speedMts', posInt],
  ['memory.maxConfigGb', posInt],
  ['memory.moduleSizesGb', listOf(posInt)],
  ['storage.m2Slots', count],
  ['storage.options', listOf(storageOption)],
  ['wifi.slot', text],
  ['wifi.options', listOf(text)],
  ['cpus', listOf(cpuOption)],
  ['cpuPackages', packages],
  ['gpus', listOf(gpuOption)],
  ['replaceable', listOf(oneOf(LAPTOP_PART_KINDS))]
]

function at(obj: Json, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), obj)
}

export function validateLaptopProfile(raw: unknown): string[] {
  if (!isObj(raw)) return ['profil bir nesne olmalı']
  const errors: string[] = []
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) errors.push('id küçük harf, rakam ve tireden oluşmalı')
  for (const k of ['brand', 'model']) if (text(raw[k])) errors.push(`${k} eksik`)
  const identify = raw.identify
  if (!isObj(identify) || text(identify.manufacturer) || text(identify.model)) errors.push('identify: manufacturer ve model gerekli')
  for (const k of ['addedAt', 'updatedAt']) if (typeof raw[k] !== 'string' || !DATE_RE.test(raw[k] as string)) errors.push(`${k} YYYY-AA-GG olmalı`)
  const sources = isObj(raw.sources) ? raw.sources : null
  if (!sources || !Object.keys(sources).length) errors.push('sources eksik')
  else {
    for (const [key, s] of Object.entries(sources)) {
      if (!isObj(s) || typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) errors.push(`kaynak "${key}": url geçersiz`)
      else if (typeof s.retrieved !== 'string' || !DATE_RE.test(s.retrieved)) errors.push(`kaynak "${key}": retrieved YYYY-AA-GG olmalı`)
    }
  }
  for (const [path, check] of FACTS) {
    const fact = at(raw, path)
    if (!isObj(fact) || !('value' in fact)) {
      errors.push(`"${path}": { value, source } biçiminde olmalı`)
      continue
    }
    if (fact.value === null) continue // bilinmiyor
    const e = check(fact.value)
    if (e) errors.push(`"${path}": ${e}`)
    if (typeof fact.source !== 'string' || !fact.source) errors.push(`"${path}": kaynak gösterilmemiş`)
    else if (sources && !(fact.source in sources)) errors.push(`"${path}": "${fact.source}" kaynağı tanımlı değil`)
  }
  return errors
}

export function parseLaptopFiles(files: { name: string; content: string }[]): {
  profiles: LaptopProfile[]
  errors: CatalogLoadError[]
} {
  const profiles: LaptopProfile[] = []
  const errors: CatalogLoadError[] = []
  for (const f of files) {
    let raw: unknown
    try {
      raw = JSON.parse(f.content)
    } catch (e) {
      errors.push({ file: f.name, message: `JSON okunamadı: ${(e as Error).message}` })
      continue
    }
    const problems = validateLaptopProfile(raw)
    const id = isObj(raw) && typeof raw.id === 'string' ? raw.id : undefined
    if (problems.length) {
      for (const message of problems) errors.push({ file: f.name, ...(id ? { partId: id } : {}), message })
      continue
    }
    if (profiles.some((p) => p.id === id)) {
      errors.push({ file: f.name, partId: id, message: 'aynı id ile ikinci profil' })
      continue
    }
    profiles.push(raw as unknown as LaptopProfile)
  }
  return { profiles, errors }
}

// ---------- Okunan bilgisayarla eşleştirme ----------

const norm = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Windows'un okuduğu üretici ve model profildekiyle aynıysa o profil. */
export function findLaptopProfile(reading: HardwareReading, profiles: LaptopProfile[]): LaptopProfile | null {
  const manufacturer = norm(reading.system.manufacturer)
  const model = norm(reading.system.model)
  if (!manufacturer || !model) return null
  return profiles.find((p) => norm(p.identify.manufacturer) === manufacturer && norm(p.identify.model) === model) ?? null
}

/** "NVIDIA GeForce RTX 3060 Laptop GPU" ↔ profildeki "NVIDIA GeForce RTX 3060". */
export function matchGpuOption(name: string, options: LaptopGpuOption[]): LaptopGpuOption | null {
  const n = normalizeDeviceName(name).replace(/\s+laptop(\s+gpu)?$/, '')
  return options.find((o) => normalizeDeviceName(o.name) === n) ?? null
}

/** "12th Gen Intel(R) Core(TM) i7-12700H" ↔ profildeki "Intel Core i7-12700H". */
export function matchCpuOption(name: string, options: LaptopCpuOption[]): LaptopCpuOption | null {
  const n = normalizeDeviceName(name)
  return options.find((o) => normalizeDeviceName(o.name) === n) ?? null
}
