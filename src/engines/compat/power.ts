import { specNum } from '../catalog/access'
import type { Build } from './types'

/**
 * Güç hesabının varsayımları. Bunlar ölçülmüş değer değil, kural ayarıdır; arayüzde "varsayım" olarak gösterilir.
 * Melih'in onayıyla (2. aşama): diğer parçalar için sabit 100 W; yük %80'i geçerse uyarı, %100'ü geçerse uyumsuz.
 */
export const POWER_ASSUMPTIONS = {
  /** Anakart, bellek, diskler, fanlar ve pompa için sabit pay (W). */
  otherComponentsW: 100,
  /** Tahmini tüketim / güç kaynağı bu oranı geçerse uyarı. */
  warnLoadRatio: 0.8,
  /** Bu oranı geçerse uyumsuz. */
  failLoadRatio: 1
} as const

export interface PowerEstimate {
  /** İşlemci için kullanılan güç: üreticinin yayımladığı en yüksek değer (TDP ya da en yüksek turbo gücü). */
  cpuW?: number
  gpuW?: number
  otherW: number
  totalW: number
  psuW?: number
  /** totalW / psuW */
  loadRatio?: number
  /** Seçili olduğu hâlde gücü bilinmeyen parçalar (Türkçe adlarıyla). */
  unknown: string[]
}

/** İşlemcinin güç hesabında kullanılacak değeri: yayımlanmış değerlerin en yükseği. */
export function cpuPowerW(build: Build): number | undefined {
  const values = [specNum(build.cpu, 'tdpW'), specNum(build.cpu, 'maxTurboPowerW')].filter(
    (v): v is number => v !== undefined
  )
  return values.length ? Math.max(...values) : undefined
}

export function estimatePower(build: Build): PowerEstimate {
  const unknown: string[] = []
  const cpuW = build.cpu ? cpuPowerW(build) : undefined
  if (build.cpu && cpuW === undefined) unknown.push('işlemcinin gücü')
  const gpuW = build.gpu ? specNum(build.gpu, 'boardPowerW') : undefined
  if (build.gpu && gpuW === undefined) unknown.push('ekran kartının gücü')
  const psuW = build.psu ? specNum(build.psu, 'wattage') : undefined
  if (build.psu && psuW === undefined) unknown.push('güç kaynağının gücü')

  const otherW = POWER_ASSUMPTIONS.otherComponentsW
  const totalW = (cpuW ?? 0) + (gpuW ?? 0) + otherW
  return {
    cpuW,
    gpuW,
    otherW,
    totalW,
    psuW,
    loadRatio: psuW ? totalW / psuW : undefined,
    unknown
  }
}
