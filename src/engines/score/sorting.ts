import type { CategoryId, Part } from '../catalog/types'
import { formatNumber } from '../catalog/specDefs'
import { specNum, specStr } from '../catalog/access'
import type { BenchmarkResult } from '../benchmark/types'
import { resultsForPart } from '../benchmark/validate'

// Parçaların kendi kategorisi içinde sıralanması (Melih onayladı, 4. aşama):
// - İşlemci ve ekran kartı ölçüme göre (Blender render); ölçümü olmayan "ölçüm yok" olarak sona.
// - Öbür kategoriler üreticinin değerleriyle; hesaplanan değerin formülü yazılır.
// Burada uydurma bir "puan" yok: her seçenek bir ölçümü ya da üretici değerini olduğu gibi sıralar.

export interface SortContext {
  results: BenchmarkResult[]
}

export interface SortOption {
  id: string
  label: string
  kind: 'measurement' | 'spec' | 'derived'
  /** Büyük değer mi önce gelir. */
  higherIsBetter: boolean
  /** Değer yoksa null (listenin sonuna gider, "bilinmiyor" ya da "ölçüm yok" görünür). */
  value: (part: Part, ctx: SortContext) => number | null
  format: (value: number) => string
  /** Hesaplanan değerlerde formül. */
  formula?: string
}

/** Blender render ölçümü (Cycles, örnek/dk). */
export function renderResult(part: Part, ctx: SortContext): BenchmarkResult | undefined {
  return resultsForPart(ctx.results, part).find((r) => r.test === 'blender-cycles')
}

const spec = (key: string, label: string, unit: string, higherIsBetter = true): SortOption => ({
  id: key,
  label,
  kind: 'spec',
  higherIsBetter,
  value: (p) => specNum(p, key) ?? null,
  format: (v) => `${formatNumber(v)}${unit ? ` ${unit}` : ''}`
})

const render: SortOption = {
  id: 'render',
  label: 'Render ölçümü (Blender)',
  kind: 'measurement',
  higherIsBetter: true,
  value: (p, ctx) => renderResult(p, ctx)?.value ?? null,
  format: (v) => `${formatNumber(Math.round(v))} örnek/dk`
}

/** Belleğin ilk erişim gecikmesi: CL çevrimi, saat hızında (MT/s'nin yarısı) geçen süre. */
export function memoryLatencyNs(part: Part): number | null {
  const cl = specNum(part, 'casLatency')
  const speed = specNum(part, 'speedMts')
  return cl && speed ? (cl * 2000) / speed : null
}

const EFFICIENCY_TIERS = ['titanium', 'platinum', 'gold', 'silver', 'bronze', 'white', 'standard']

/** Sertifika metnindeki en yüksek kademe (ör. "80 PLUS Gold · Cybenetics Platinum" → Platinum). */
export function efficiencyTier(part: Part): number | null {
  const text = specStr(part, 'efficiency')?.toLowerCase()
  if (!text) return null
  const i = EFFICIENCY_TIERS.findIndex((t) => text.includes(t))
  return i < 0 ? null : EFFICIENCY_TIERS.length - i
}

export const SORT_OPTIONS: Record<CategoryId, SortOption[]> = {
  cpu: [render, spec('cores', 'Çekirdek', '')],
  gpu: [render, spec('vramGb', 'Ekran belleği', 'GB')],
  memory: [
    {
      id: 'latency',
      label: 'Gecikme (düşük önce)',
      kind: 'derived',
      higherIsBetter: false,
      value: (p) => memoryLatencyNs(p),
      format: (v) => `${formatNumber(Math.round(v * 100) / 100)} ns`,
      formula: 'CL × 2000 / hız (MT/s)'
    },
    spec('capacityGb', 'Kapasite', 'GB'),
    spec('speedMts', 'Hız', 'MT/s')
  ],
  storage: [spec('seqReadMbps', 'Sıralı okuma (üretici)', 'MB/s'), spec('capacityGb', 'Kapasite', 'GB')],
  psu: [
    {
      id: 'efficiency',
      label: 'Verimlilik sertifikası',
      kind: 'derived',
      higherIsBetter: true,
      value: (p) => efficiencyTier(p),
      format: (v) => ['', 'Standard', 'White', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Titanium'][v] ?? String(v),
      formula: 'Sertifikadaki en yüksek kademe (Titanium > Platinum > Gold > Silver > Bronze). 80 PLUS ve Cybenetics ayrı programlardır.'
    },
    spec('wattage', 'Güç', 'W')
  ],
  case: [spec('maxGpuLengthMm', 'En uzun ekran kartı', 'mm'), spec('maxCoolerHeightMm', 'En yüksek hava soğutucu', 'mm')],
  cooler: [spec('radiatorSizeMm', 'Radyatör boyu', 'mm'), spec('heightMm', 'Yükseklik (kısadan)', 'mm', false)],
  motherboard: [spec('m2Slots', 'M.2 yuvası', ''), spec('maxMemoryGb', 'En yüksek bellek', 'GB'), spec('sataPorts', 'SATA', '')]
}

export interface RankEntry {
  value: number
  /** 1'den başlayan sıra (eşit değerler aynı sırayı alır). */
  rank: number
  /** Değeri olan parça sayısı. */
  of: number
  /** En iyiye göre yüzde (en iyi = 100). */
  relative: number
}

/** Parçaları bir seçeneğe göre sıralar; değeri olmayanlar haritada yer almaz. */
export function rankParts(parts: Part[], option: SortOption, ctx: SortContext): Map<string, RankEntry> {
  const withValue = parts
    .map((p) => ({ id: p.id, value: option.value(p, ctx) }))
    .filter((x): x is { id: string; value: number } => x.value !== null && Number.isFinite(x.value))
  const sorted = [...withValue].sort((a, b) => (option.higherIsBetter ? b.value - a.value : a.value - b.value))
  const best = sorted[0]?.value
  const out = new Map<string, RankEntry>()
  sorted.forEach((x, i) => {
    const rank = i > 0 && sorted[i - 1].value === x.value ? (out.get(sorted[i - 1].id) as RankEntry).rank : i + 1
    const relative = option.higherIsBetter ? (x.value / best) * 100 : (best / x.value) * 100
    out.set(x.id, { value: x.value, rank, of: sorted.length, relative })
  })
  return out
}

/** Sıralama karşılaştırıcısı: değeri olanlar önce, sonra değeri olmayanlar. */
export function compareBy(option: SortOption, ctx: SortContext): (a: Part, b: Part) => number {
  return (a, b) => {
    const va = option.value(a, ctx)
    const vb = option.value(b, ctx)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return option.higherIsBetter ? vb - va : va - vb
  }
}
