import { useMemo, type ReactElement } from 'react'
import { formatNumber } from '@engines/catalog/specDefs'
import type { Build, CompatResult } from '@engines/compat'
import { engineeringScore } from '@engines/score/system'
import { explainBuild, type ExplainTone } from '@engines/explain'
import { useCatalog } from '../catalog/CatalogContext'
import { conditionsText, NO_GAMING_TEXT, sourceText } from './format'

const GROUPS: { tone: ExplainTone; title: string }[] = [
  { tone: 'good', title: 'NEDEN İYİ' },
  { tone: 'bad', title: 'NEDEN KÖTÜ, DİKKAT' },
  { tone: 'info', title: 'BİLGİ' }
]

/** Kasa Topla'da toplamanın değerlendirmesi: mühendislik puanı, oyun puanının durumu ve açıklamalar. */
export function EvaluationPanel({ build, compat }: { build: Build; compat: CompatResult[] }): ReactElement {
  const { catalog } = useCatalog()
  const results = catalog.benchmarks.results
  const score = useMemo(() => engineeringScore(build, catalog.parts, results), [build, catalog.parts, results])
  const items = useMemo(() => explainBuild(build, compat, catalog.parts, results), [build, compat, catalog.parts, results])
  const anySelected = items.length > 0
  const sources = [...new Set(score.components.map((c) => c.result?.source).filter((s): s is string => !!s))]

  return (
    <div className="panel">
      <span className="section-title">DEĞERLENDİRME</span>
      {!anySelected ? (
        <p className="muted small">Parça seçtikçe puanlar ve "neden iyi, neden kötü" maddeleri burada görünür.</p>
      ) : (
        <>
          <div className="eval-score">
            <span className="eval-score__label">Mühendislik</span>
            <span className="eval-score__value">{score.score !== null ? `${score.score} / 100` : '—'}</span>
          </div>
          <ul className="eval-components">
            {score.components.map((c) => (
              <li key={c.id} className={c.weight === 0 ? 'eval-components__item eval-components__item--off' : 'eval-components__item'}>
                <span className="eval-components__label">
                  {c.label} <span className="muted">· {c.weight ? `%${Math.round(c.weight * 100)}` : 'puana katılmıyor'}</span>
                </span>
                <span className="eval-components__value">
                  {c.value !== null ? `${formatNumber(Math.round(c.value))} ${c.unit}` : '—'}
                  {c.relative !== null && <span className="muted"> → {Math.round(c.relative)}</span>}
                </span>
                {c.result && <span className="eval-components__note">{conditionsText(c.result)}</span>}
                {c.missingReason && <span className="eval-components__note">{c.missingReason}</span>}
              </li>
            ))}
          </ul>
          <span className="muted small">Her bileşen katalogdaki en iyi parçaya göre 0–100; puan ağırlıklı toplamdır.</span>
          {sources.length > 0 && (
            <span className="eval-sources small">
              Kaynak:{' '}
              {sources.map((key, i) => {
                const s = catalog.benchmarks.sources[key]
                return (
                  <span key={key}>
                    {i > 0 && ' · '}
                    <a href={s.url} target="_blank" rel="noreferrer" title={sourceText(s)}>
                      {(s.title ?? s.url).split(' · ').slice(0, 2).join(' · ')}
                    </a>
                  </span>
                )
              })}
              {` (${[...new Set(sources.map((k) => catalog.benchmarks.sources[k].license).filter(Boolean))].join(', ')})`}
            </span>
          )}
          <div className="eval-score eval-score--secondary">
            <span className="eval-score__label">Oyun</span>
            <span className="eval-score__value">—</span>
          </div>
          <span className="muted small">{NO_GAMING_TEXT}</span>
          {GROUPS.map((g) => {
            const list = items.filter((i) => i.tone === g.tone)
            if (!list.length) return null
            return (
              <div key={g.tone} className={`eval-list eval-list--${g.tone}`}>
                <span className="eval-list__title">{g.title}</span>
                <ul>
                  {list.map((i) => (
                    <li key={i.id}>
                      <span className="eval-list__item-title">{i.title}</span>
                      <span className="eval-list__item-detail">{i.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
