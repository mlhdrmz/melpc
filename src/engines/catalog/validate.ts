import { CATEGORY_IDS, type CategoryId, type Part, type PartRecord, type SpecValue } from './types'
import { RADIATOR_POSITIONS, SPEC_DEFS, type SpecDef } from './specDefs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[a-z0-9][a-z0-9-]*$/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function checkValue(def: SpecDef, value: unknown): string | null {
  const inOptions = (v: unknown): boolean => !def.options || def.options.includes(v as string)
  switch (def.kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? null : 'sayı olmalı'
    case 'integer':
      return Number.isInteger(value) && (value as number) >= 0 ? null : 'tam sayı olmalı'
    case 'boolean':
      return typeof value === 'boolean' ? null : 'true/false olmalı'
    case 'text':
      return typeof value === 'string' && value.trim() !== '' ? null : 'boş olmayan metin olmalı'
    case 'enum':
      return typeof value === 'string' && inOptions(value)
        ? null
        : `şunlardan biri olmalı: ${def.options?.join(', ')}`
    case 'enumList':
      return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string' && inOptions(v))
        ? null
        : `şunlardan oluşan bir liste olmalı: ${def.options?.join(', ')}`
    case 'connectorMap':
      return isObject(value) && Object.values(value).every((n) => Number.isInteger(n) && (n as number) >= 0)
        ? null
        : 'konnektör → adet nesnesi olmalı'
    case 'radiatorMounts':
      return Array.isArray(value) &&
        value.every((m) => {
          if (!isObject(m) || !RADIATOR_POSITIONS.includes(m.position as never)) return false
          const posInt = (s: unknown): boolean => Number.isInteger(s) && (s as number) > 0
          const sizesOk = m.sizesMm === undefined || (Array.isArray(m.sizesMm) && m.sizesMm.length > 0 && m.sizesMm.every(posInt))
          const maxOk = m.maxMm === undefined || posInt(m.maxMm)
          return sizesOk && maxOk && (m.sizesMm !== undefined || m.maxMm !== undefined)
        })
        ? null
        : 'radyatör yeri listesi olmalı ({ position, sizesMm } ya da { position, maxMm })'
  }
}

/**
 * Bir parça kaydını doğrular. Hata listesi boşsa kayıt kataloğa girebilir.
 * Kaynağı olmayan bir değer, bilinmeyen bir alan ya da yanlış tipte bir değer hatadır.
 */
export function validatePartRecord(raw: unknown): string[] {
  const errors: string[] = []
  if (!isObject(raw)) return ['kayıt bir nesne değil']
  const r = raw as Partial<PartRecord> & Record<string, unknown>

  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) errors.push('id küçük harf, rakam ve tireden oluşmalı')
  if (!CATEGORY_IDS.includes(r.category as CategoryId)) {
    errors.push(`bilinmeyen kategori: ${String(r.category)}`)
    return errors
  }
  if (typeof r.brand !== 'string' || !r.brand.trim()) errors.push('marka eksik')
  if (typeof r.model !== 'string' || !r.model.trim()) errors.push('model eksik')
  if (r.mpn !== undefined && (typeof r.mpn !== 'string' || !r.mpn.trim())) errors.push('mpn boş olamaz')
  if (typeof r.addedAt !== 'string' || !DATE_RE.test(r.addedAt)) errors.push('addedAt YYYY-AA-GG olmalı')
  if (typeof r.updatedAt !== 'string' || !DATE_RE.test(r.updatedAt)) errors.push('updatedAt YYYY-AA-GG olmalı')

  const sources = isObject(r.sources) ? r.sources : null
  if (!sources) errors.push('sources eksik')
  else {
    for (const [key, s] of Object.entries(sources)) {
      if (!isObject(s)) {
        errors.push(`kaynak "${key}" geçersiz`)
        continue
      }
      if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) errors.push(`kaynak "${key}": url geçersiz`)
      if (typeof s.retrieved !== 'string' || !DATE_RE.test(s.retrieved))
        errors.push(`kaynak "${key}": retrieved YYYY-AA-GG olmalı`)
    }
  }

  if (!isObject(r.specs)) {
    errors.push('specs eksik')
    return errors
  }
  const defs = SPEC_DEFS[r.category as CategoryId]
  for (const [key, entry] of Object.entries(r.specs)) {
    const def = defs.find((d) => d.key === key)
    if (!def) {
      errors.push(`"${key}" bu kategoride tanımlı bir alan değil`)
      continue
    }
    if (!isObject(entry) || !('value' in entry)) {
      errors.push(`"${key}": { value, source } biçiminde olmalı`)
      continue
    }
    if (entry.value === null) continue // bilinmiyor
    const typeError = checkValue(def, entry.value)
    if (typeError) errors.push(`"${key}": ${typeError}`)
    if (typeof entry.source !== 'string' || !entry.source) errors.push(`"${key}": kaynak gösterilmemiş`)
    else if (sources && !(entry.source in sources)) errors.push(`"${key}": "${entry.source}" kaynağı tanımlı değil`)
  }
  return errors
}

/** Doğrulanmış kaydı motorların kullandığı biçime çevirir; eksik alanlar "bilinmiyor" (null) olur. */
export function resolvePart(record: PartRecord): Part {
  const specs: Part['specs'] = {}
  for (const def of SPEC_DEFS[record.category]) {
    const entry = record.specs[def.key]
    if (!entry) {
      if (!def.optional) specs[def.key] = { value: null, source: null }
      continue
    }
    specs[def.key] = {
      value: entry.value as SpecValue | null,
      source: entry.value !== null && entry.source ? record.sources[entry.source] : null,
      ...(entry.note ? { note: entry.note } : {})
    }
  }
  return {
    id: record.id,
    category: record.category,
    brand: record.brand,
    model: record.model,
    ...(record.mpn ? { mpn: record.mpn } : {}),
    specs,
    addedAt: record.addedAt,
    updatedAt: record.updatedAt
  }
}
