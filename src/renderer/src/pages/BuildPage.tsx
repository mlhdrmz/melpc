import { useMemo, useState, type ReactElement } from 'react'
import type { BuildSelection, CatalogPayload } from '@shared/api'
import { CATEGORY_IDS, type CategoryId, type Part } from '@engines/catalog/types'
import { CATEGORY_LABELS, formatNumber } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import { partSummary } from '@engines/catalog/summary'
import { checkBuild, estimatePower, POWER_ASSUMPTIONS, type Build, type CompatResult } from '@engines/compat'
import { CategoryIcon } from '../components/icons'

const EMPTY_SELECTION: BuildSelection = { storage: [] }

function toBuild(selection: BuildSelection, byId: Map<string, Part>): Build {
  const pick = (id?: string): Part | undefined => (id ? byId.get(id) : undefined)
  return {
    cpu: pick(selection.cpu),
    motherboard: pick(selection.motherboard),
    memory: pick(selection.memory),
    gpu: pick(selection.gpu),
    storage: selection.storage.map((id) => byId.get(id)).filter((p): p is Part => !!p),
    psu: pick(selection.psu),
    case: pick(selection.case),
    cooler: pick(selection.cooler)
  }
}

const STATUS_LABEL: Record<CompatResult['status'], string> = { ok: 'Uyumlu', warn: 'Uyarı', fail: 'Uyumsuz' }

export function BuildPage({ catalog }: { catalog: CatalogPayload }): ReactElement {
  const [selection] = useState<BuildSelection>(EMPTY_SELECTION)
  const byId = useMemo(() => new Map(catalog.parts.map((p) => [p.id, p])), [catalog])
  const build = useMemo(() => toBuild(selection, byId), [selection, byId])
  const results = useMemo(() => checkBuild(build), [build])
  const power = useMemo(() => estimatePower(build), [build])
  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0])) as Record<CategoryId, number>
    for (const p of catalog.parts) c[p.category]++
    return c
  }, [catalog])

  const selectedParts = (cat: CategoryId): Part[] =>
    cat === 'storage' ? build.storage : build[cat] ? [build[cat] as Part] : []

  return (
    <div className="build-page">
      <div className="page-title">
        <span className="page-title__eyebrow">Yeni toplama</span>
        <h1>KASA TOPLA</h1>
      </div>

      <div className="build-layout">
        <section aria-label="Parça listesi" className="part-list">
          {CATEGORY_IDS.map((cat) => {
            const parts = selectedParts(cat)
            return (
              <div key={cat} className="part-slot">
                <div className="part-slot__icon">
                  <CategoryIcon category={cat} />
                </div>
                <div className="part-slot__body">
                  <span className="part-slot__label">{CATEGORY_LABELS[cat].toLocaleUpperCase('tr-TR')}</span>
                  {parts.length ? (
                    parts.map((p) => (
                      <span key={p.id}>
                        <span className="part-slot__name">{partName(p)}</span>
                        <span className="part-slot__meta">{partSummary(p)}</span>
                      </span>
                    ))
                  ) : (
                    <span className="part-slot__empty">
                      Seçilmedi · katalogda {counts[cat]} parça
                    </span>
                  )}
                  <span className="part-slot__price">Fiyat: henüz yok</span>
                </div>
              </div>
            )
          })}
        </section>

        <section aria-label="Kasanın içi" className="stage">
          <div className="stage__head">
            <span className="section-title">360° KASA GÖRÜNÜMÜ</span>
          </div>
          <div className="stage__placeholder muted">3D kasa görünümü bu aşamanın 4. adımında eklenecek.</div>
        </section>

        <section aria-label="Değerlendirme" className="side-panel">
          <div className="panel">
            <div className="panel__head">
              <span className="section-title">UYUMLULUK</span>
              {results.length > 0 && (
                <span className="panel__count">
                  {results.filter((r) => r.status === 'ok').length} / {results.length}
                </span>
              )}
            </div>
            {results.length === 0 ? (
              <p className="muted small">Parça seçtikçe uyumluluk sonuçları burada görünür.</p>
            ) : (
              <ul className="compat-list">
                {results.map((r) => (
                  <li key={r.ruleId} className={`compat-item compat-item--${r.status}`}>
                    <span className="compat-item__status">{STATUS_LABEL[r.status]}</span>
                    <span className="compat-item__title">{r.title}</span>
                    <span className="compat-item__message">{r.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="power">
              <div className="power__row">
                <span className="muted">Tahmini tüketim</span>
                <span className="strong">
                  {build.cpu || build.gpu ? `~${formatNumber(power.totalW)} W` : '—'}
                  {power.psuW ? ` / ${formatNumber(power.psuW)} W` : ''}
                </span>
              </div>
              <div className="power__bar" aria-hidden="true">
                <div
                  className="power__fill"
                  style={{ width: `${Math.min(100, Math.round((power.loadRatio ?? 0) * 100))}%` }}
                />
                <div
                  className="power__marker"
                  style={{ left: `${POWER_ASSUMPTIONS.warnLoadRatio * 100}%` }}
                />
              </div>
              <span className="muted small">
                Varsayım: işlemci ve ekran kartının üretici güç değerleri + diğer parçalar için sabit{' '}
                {POWER_ASSUMPTIONS.otherComponentsW} W.
              </span>
            </div>
          </div>

          {catalog.errors.length > 0 && (
            <div className="panel">
              <span className="section-title">KATALOG HATALARI</span>
              <ul className="error-list small">
                {catalog.errors.map((e, i) => (
                  <li key={i}>
                    {e.file}
                    {e.partId ? ` / ${e.partId}` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
