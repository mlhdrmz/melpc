import type { Part } from '../catalog/types'
import { specNum } from '../catalog/access'
import type { Build } from '../compat/types'
import type { BenchmarkResult } from '../benchmark/types'
import { rankParts, renderResult, SORT_OPTIONS, type SortContext } from './sorting'

// Toplanan sistemin değerlendirmesi (Melih onayladı, 4. aşama):
// - Mühendislik puanı: işlemcinin Blender puanı (çok çekirdekli iş), ekran kartının Blender puanı ve bellek miktarı.
//   Her bileşen katalogdaki en iyi parçaya göre 0–100; ağırlıklar ekranda yazar.
// - CAD için tek çekirdek ölçümü yok; puana katılmaz, "ölçüm yok" görünür.
// - Oyun puanı yok: şartları izin veren bir oyun ölçümü kaynağı bulunamadı.

export interface ScoreComponent {
  id: 'cpuRender' | 'gpuRender' | 'memory' | 'cad'
  label: string
  /** Puandaki payı (0–1). 0: puana katılmıyor. */
  weight: number
  /** Ham değer (ör. örnek/dk, GB). */
  value: number | null
  unit: string
  /** Katalogdaki en iyiye göre (0–100). */
  relative: number | null
  /** Ölçümse kendisi (kaynak, koşul, ölçüm sayısı). */
  result?: BenchmarkResult
  /** Değer yoksa nedeni. */
  missingReason?: string
}

export interface EngineeringScore {
  /** 0–100; bileşenlerden biri eksikse null. */
  score: number | null
  components: ScoreComponent[]
}

export const ENGINEERING_WEIGHTS = { cpuRender: 0.4, gpuRender: 0.3, memory: 0.3 } as const

export function engineeringScore(build: Build, catalog: Part[], results: BenchmarkResult[]): EngineeringScore {
  const ctx: SortContext = { results }
  const rel = (category: 'cpu' | 'gpu', part: Part | undefined): ScoreComponent['relative'] => {
    if (!part) return null
    return rankParts(catalog.filter((p) => p.category === category), SORT_OPTIONS[category][0], ctx).get(part.id)?.relative ?? null
  }
  const maxMemory = Math.max(0, ...catalog.filter((p) => p.category === 'memory').map((p) => specNum(p, 'capacityGb') ?? 0))
  const memoryGb = specNum(build.memory, 'capacityGb') ?? null

  const cpuResult = build.cpu ? renderResult(build.cpu, ctx) : undefined
  const gpuResult = build.gpu ? renderResult(build.gpu, ctx) : undefined
  const components: ScoreComponent[] = [
    {
      id: 'cpuRender',
      label: 'İşlemci · çok çekirdekli iş (Blender render)',
      weight: ENGINEERING_WEIGHTS.cpuRender,
      value: cpuResult?.value ?? null,
      unit: 'örnek/dk',
      relative: cpuResult ? rel('cpu', build.cpu) : null,
      ...(cpuResult ? { result: cpuResult } : { missingReason: build.cpu ? 'Bu işlemcinin ölçümü yok' : 'İşlemci seçilmedi' })
    },
    {
      id: 'gpuRender',
      label: 'Ekran kartı · render (Blender)',
      weight: ENGINEERING_WEIGHTS.gpuRender,
      value: gpuResult?.value ?? null,
      unit: 'örnek/dk',
      relative: gpuResult ? rel('gpu', build.gpu) : null,
      ...(gpuResult ? { result: gpuResult } : { missingReason: build.gpu ? 'Bu ekran kartının ölçümü yok' : 'Ekran kartı seçilmedi' })
    },
    {
      id: 'memory',
      label: 'Bellek miktarı (simülasyon ve büyük modeller)',
      weight: ENGINEERING_WEIGHTS.memory,
      value: memoryGb,
      unit: 'GB',
      relative: memoryGb && maxMemory ? (memoryGb / maxMemory) * 100 : null,
      ...(memoryGb ? {} : { missingReason: build.memory ? 'Kapasitesi bilinmiyor' : 'Bellek seçilmedi' })
    },
    {
      id: 'cad',
      label: 'CAD · tek çekirdek hızı',
      weight: 0,
      value: null,
      unit: '',
      relative: null,
      missingReason: 'Şartları izin veren bir tek çekirdek ölçümü kaynağı yok; puana katılmadı'
    }
  ]
  const weighted = components.filter((c) => c.weight > 0)
  const complete = weighted.every((c) => c.relative !== null)
  const score = complete ? Math.round(weighted.reduce((sum, c) => sum + c.weight * (c.relative as number), 0)) : null
  return { score, components }
}
