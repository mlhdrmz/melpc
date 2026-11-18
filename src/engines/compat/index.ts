import type { Part } from '../catalog/types'
import { RULES } from './rules'
import type { Build, CompatResult } from './types'

export * from './types'
export { estimatePower, cpuPowerW, POWER_ASSUMPTIONS, type PowerEstimate } from './power'
export { RULES } from './rules'

/** Toplamaya uygulanabilen bütün kuralları çalıştırır. */
export function checkBuild(build: Build): CompatResult[] {
  const results: CompatResult[] = []
  for (const rule of RULES) {
    const r = rule(build)
    if (r) results.push(r)
  }
  return results
}

/** Parçayı toplamaya koyar (depolama ise ekler, diğerlerinde yerine geçirir). */
export function withPart(build: Build, part: Part): Build {
  if (part.category === 'storage') return { ...build, storage: [...build.storage, part] }
  return { ...build, [part.category]: part }
}

/**
 * Parça seçme penceresi için: aday parça toplamaya konsaydı hangi sorunlar çıkardı.
 * Yalnızca bu parçanın kategorisini ilgilendiren uyarı ve uyumsuzlukları döndürür.
 */
export function checkCandidate(build: Build, part: Part): CompatResult[] {
  return checkBuild(withPart(build, part)).filter(
    (r) => r.status !== 'ok' && r.categories.includes(part.category)
  )
}

export function worstStatus(results: CompatResult[]): 'ok' | 'warn' | 'fail' {
  if (results.some((r) => r.status === 'fail')) return 'fail'
  if (results.some((r) => r.status === 'warn')) return 'warn'
  return 'ok'
}
