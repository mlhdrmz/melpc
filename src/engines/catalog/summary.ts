import type { Part } from './types'
import { specList, specNum, specStr } from './access'
import { formatNumber } from './specDefs'

/** Parça listesinde adın altında görünen kısa özet. Bilinmeyen değerler atlanır. */
export function partSummary(part: Part): string {
  const n = (k: string, unit = ''): string | undefined => {
    const v = specNum(part, k)
    return v === undefined ? undefined : `${formatNumber(v)}${unit}`
  }
  const s = (k: string): string | undefined => specStr(part, k)
  let bits: (string | undefined)[] = []
  switch (part.category) {
    case 'cpu':
      bits = [n('cores', ' çekirdek'), s('socket')]
      break
    case 'motherboard':
      bits = [s('socket'), s('formFactor'), s('memoryType')]
      break
    case 'memory': {
      const type = s('memoryType')
      const speed = specNum(part, 'speedMts')
      bits = [n('capacityGb', ' GB'), type && speed ? `${type}-${speed}` : type, n('casLatency') && `CL${n('casLatency')}`]
      break
    }
    case 'gpu':
      bits = [n('vramGb', ' GB'), n('lengthMm', ' mm'), n('boardPowerW', ' W')]
      break
    case 'storage':
      bits = [s('storageType'), s('interface')]
      break
    case 'psu':
      bits = [n('wattage', ' W'), s('efficiency')]
      break
    case 'case': {
      const boards = specList(part, 'motherboardSupport')
      const gpu = specNum(part, 'maxGpuLengthMm')
      bits = [boards?.[0], gpu !== undefined ? `GPU ≤ ${formatNumber(gpu)} mm` : undefined]
      break
    }
    case 'cooler': {
      const type = s('coolerType')
      if (type === 'liquid') bits = ['sıvı', n('radiatorSizeMm', ' mm radyatör')]
      else if (type === 'air') bits = ['hava', n('heightMm', ' mm')]
      break
    }
  }
  return bits.filter(Boolean).join(' · ')
}
