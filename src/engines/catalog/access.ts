import type { ConnectorMap, Part, RadiatorMount } from './types'

// Motorların teknik özellikleri güvenle okuması için yardımcılar.
// Bilinmeyen (null) ya da olmayan değer için undefined döner.

export function specNum(part: Part | undefined, key: string): number | undefined {
  const v = part?.specs[key]?.value
  return typeof v === 'number' ? v : undefined
}

export function specStr(part: Part | undefined, key: string): string | undefined {
  const v = part?.specs[key]?.value
  return typeof v === 'string' ? v : undefined
}

export function specBool(part: Part | undefined, key: string): boolean | undefined {
  const v = part?.specs[key]?.value
  return typeof v === 'boolean' ? v : undefined
}

export function specList(part: Part | undefined, key: string): string[] | undefined {
  const v = part?.specs[key]?.value
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined
}

export function specConnectors(part: Part | undefined, key: string): ConnectorMap | undefined {
  const v = part?.specs[key]?.value
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as ConnectorMap) : undefined
}

export function specMounts(part: Part | undefined, key: string): RadiatorMount[] | undefined {
  const v = part?.specs[key]?.value
  return Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null) ? (v as RadiatorMount[]) : undefined
}

export function partName(part: Part): string {
  return `${part.brand} ${part.model}`
}
