import type { ReactElement } from 'react'
import type { Part } from '@engines/catalog/types'
import { formatNumber } from '@engines/catalog/specDefs'
import { specStr } from '@engines/catalog/access'
import { BENCHMARK_TESTS } from '@engines/benchmark/tests'
import { rankParts, renderResult, SORT_OPTIONS } from '@engines/score/sorting'
import { useCatalog } from '../catalog/CatalogContext'
import { conditionsText, FEW_SAMPLES, NO_GAMING_TEXT, sourceText } from './format'

/** Parça ayrıntısında performans ölçümü: değer, katalogdaki sırası, koşulları ve kaynağı. */
export function PerformanceSection({ part }: { part: Part }): ReactElement | null {
  const { catalog } = useCatalog()
  if (part.category !== 'cpu' && part.category !== 'gpu') return null
  const ctx = { results: catalog.benchmarks.results }
  const r = renderResult(part, ctx)
  const test = BENCHMARK_TESTS['blender-cycles']
  const entry = r ? rankParts(catalog.parts.filter((p) => p.category === part.category), SORT_OPTIONS[part.category][0], ctx).get(part.id) : undefined
  const noun = part.category === 'cpu' ? 'işlemci' : 'ekran kartı'
  const source = r ? catalog.benchmarks.sources[r.source] : undefined
  return (
    <section className="perf" aria-label="Performans">
      <span className="details__eyebrow">PERFORMANS</span>
      <div className="perf__row">
        <span className="perf__label">{test.label}</span>
        <span className="perf__value">{r ? `${formatNumber(Math.round(r.value))} ${test.unit}` : 'Ölçüm yok'}</span>
      </div>
      {r && entry && (
        <>
          <span className="perf__meta">
            Katalogdaki {entry.of} {noun} arasında {entry.rank}. sırada (en iyiye göre %{Math.round(entry.relative)})
          </span>
          <span className="perf__meta">{conditionsText(r)}</span>
          {r.sampleCount !== undefined && r.sampleCount < FEW_SAMPLES && (
            <span className="perf__warn">Az ölçüm: değer daha az güvenilir.</span>
          )}
          {part.category === 'gpu' && (
            <span className="perf__meta">Ölçüm bu kartla değil, aynı grafik işlemcisiyle ({specStr(part, 'gpuChip')}) yapıldı.</span>
          )}
          {r.note && <span className="perf__meta">Not: {r.note}</span>}
          {source && (
            <a className="perf__source" href={source.url} target="_blank" rel="noreferrer">
              Kaynak: {sourceText(source)}
            </a>
          )}
          <span className="perf__desc">{test.description}</span>
        </>
      )}
      <div className="perf__row">
        <span className="perf__label">Oyun</span>
        <span className="perf__value perf__value--muted">Ölçüm yok</span>
      </div>
      <span className="perf__desc">{NO_GAMING_TEXT}</span>
    </section>
  )
}
