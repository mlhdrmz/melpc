import type { BenchmarkResult, BenchmarkSource } from '@engines/benchmark/types'
import { COMPUTE_TYPE_LABELS } from '@engines/benchmark/tests'
import { formatNumber } from '@engines/catalog/specDefs'

/** "Blender 5.2.0 · NVIDIA OptiX · 192 kullanıcı ölçümünün ortancası" */
export function conditionsText(r: BenchmarkResult): string {
  const parts = [`Blender ${r.conditions.blenderVersion}`, COMPUTE_TYPE_LABELS[r.conditions.computeType] ?? r.conditions.computeType]
  if (r.conditions.statistic === 'median') {
    parts.push(r.sampleCount ? `${formatNumber(r.sampleCount)} kullanıcı ölçümünün ortancası` : 'kullanıcı ölçümlerinin ortancası')
  }
  return parts.join(' · ')
}

/** "18.11.2026" */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function sourceText(s: BenchmarkSource | undefined): string {
  if (!s) return 'Kaynak bilinmiyor'
  return `${s.title ?? new URL(s.url).hostname}${s.license ? ` (${s.license})` : ''} · ${formatDay(s.retrieved)}`
}

/** Az ölçümlü değerler daha az güvenilir: arayüz bunları işaretler. */
export const FEW_SAMPLES = 20

export const NO_GAMING_TEXT =
  'Şartları izin veren bir oyun ölçümü kaynağı bulunamadı; bu yüzden oyun puanı ve darboğaz uyarısı verilmiyor.'
