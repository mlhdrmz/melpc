import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import type { BuildSelection, SavedBuild } from '@shared/api'
import { CATEGORY_IDS, type CategoryId, type Part } from '@engines/catalog/types'
import { CATEGORY_LABELS, formatNumber, formatSpecValue, SPEC_DEFS } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import { checkBuild, estimatePower, type Build } from '@engines/compat'
import { engineeringScore } from '@engines/score/system'
import { memoryLatencyNs, rankParts, renderResult, SORT_OPTIONS } from '@engines/score/sorting'
import { useCatalog } from '../catalog/CatalogContext'
import { MAX_BUILDS, MAX_PARTS, useCompare } from '../compare/CompareContext'
import { usePrices } from '../price/PriceContext'
import { formatTl, PRICE_NOTE } from '../price/format'
import { conditionsText } from '../score/format'
import { ReadySystemCompare } from '../compare/ReadySystemCompare'

// Karşılaştır sayfası (Melih onayladı, 4. aşama): Parçalar (aynı kategoriden 2–4 parça), Toplamalar (kayıtlı
// 2–3 toplama) ve Hazır sistem (mağazadaki hazır bir sistemi "kendin toplasan" fiyatıyla karşılaştırma).

type Tab = 'parts' | 'builds' | 'ready'

export function ComparePage(): ReactElement {
  const [tab, setTab] = useState<Tab>('parts')
  return (
    <div className="compare-page">
      <div className="page-head">
        <div className="page-title">
          <span className="page-title__sub">Parçalar, toplamalar ve hazır sistemler</span>
          <h1>KARŞILAŞTIR</h1>
        </div>
        <div className="segmented" role="tablist" aria-label="Karşılaştırma türü">
          {(
            [
              ['parts', 'Parçalar'],
              ['builds', 'Toplamalar'],
              ['ready', 'Hazır sistem']
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`segmented__item${tab === t ? ' segmented__item--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'parts' && <PartsCompare />}
      {tab === 'builds' && <BuildsCompare />}
      {tab === 'ready' && <ReadySystemCompare />}
    </div>
  )
}

/** Satırdaki değerlerin hepsi aynı değilse true. */
function differs(values: string[]): boolean {
  return new Set(values).size > 1
}

/** En iyi değerin sütunu (eşitlikte hiçbiri işaretlenmez). */
function bestIndex(values: (number | null)[], higherIsBetter: boolean): number {
  const known = values.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null)
  if (known.length < 2) return -1
  const best = known.reduce((a, b) => (higherIsBetter ? (b.v > a.v ? b : a) : b.v < a.v ? b : a))
  return known.filter((x) => x.v === best.v).length > 1 ? -1 : best.i
}

function Row({ label, cells, best = -1, note }: { label: string; cells: ReactNode[]; best?: number; note?: string }): ReactElement {
  const texts = cells.map((c) => (typeof c === 'string' ? c : JSON.stringify(c)))
  return (
    <tr className={differs(texts) ? 'cmp-row cmp-row--diff' : 'cmp-row'}>
      <th scope="row">
        {label}
        {note && <span className="cmp-note">{note}</span>}
      </th>
      {cells.map((c, i) => (
        <td key={i} className={i === best ? 'cmp-cell--best' : undefined}>
          {c}
        </td>
      ))}
    </tr>
  )
}

function PartsCompare(): ReactElement {
  const { catalog, byId } = useCatalog()
  const { parts, togglePart } = useCompare()
  const { index, storeName } = usePrices()
  const initial = CATEGORY_IDS.find((c) => parts[c].length > 0) ?? 'cpu'
  const [category, setCategory] = useState<CategoryId>(initial)
  const ctx = useMemo(() => ({ results: catalog.benchmarks.results }), [catalog])

  const list = parts[category].map((id) => byId.get(id)).filter((p): p is Part => !!p)
  const candidates = catalog.parts
    .filter((p) => p.category === category && !parts[category].includes(p.id))
    .sort((a, b) => partName(a).localeCompare(partName(b), 'tr'))
  const ranks = useMemo(
    () => (category === 'cpu' || category === 'gpu' ? rankParts(catalog.parts.filter((p) => p.category === category), SORT_OPTIONS[category][0], ctx) : null),
    [catalog, category, ctx]
  )

  const prices = list.map((p) => index.get(p.id).best)
  const renders = list.map((p) => renderResult(p, ctx))
  return (
    <div className="compare-block">
      <div className="segmented segmented--wrap" role="group" aria-label="Kategori">
        {CATEGORY_IDS.map((c) => (
          <button
            key={c}
            type="button"
            className={`segmented__item${category === c ? ' segmented__item--active' : ''}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]}
            {parts[c].length ? ` (${parts[c].length})` : ''}
          </button>
        ))}
      </div>
      <div className="compare-toolbar">
        <label className="select">
          <span>Parça ekle (en fazla {MAX_PARTS})</span>
          <select value="" disabled={list.length >= MAX_PARTS} onChange={(e) => e.target.value && togglePart(category, e.target.value)}>
            <option value="">Seç…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {partName(p)}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">Parça seçme penceresindeki "Karşılaştır" düğmesiyle de eklenebilir.</span>
      </div>
      {list.length < 2 ? (
        <p className="muted">Karşılaştırmak için bu kategoriden en az iki parça ekleyin.</p>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col" />
                {list.map((p) => (
                  <th key={p.id} scope="col">
                    <span className="cmp-head">{partName(p)}</span>
                    <button type="button" className="chip-button chip-button--quiet" onClick={() => togglePart(category, p.id)}>
                      Çıkar
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label="En ucuz fiyat"
                note="güncel ve stokta"
                cells={prices.map((b) => (b ? `${formatTl(b.price as number)} · ${storeName(b.storeId)}` : 'Fiyat yok'))}
                best={bestIndex(
                  prices.map((b) => b?.price ?? null),
                  false
                )}
              />
              {ranks && (
                <Row
                  label="Render (Blender)"
                  note={renders[0] ? conditionsText(renders[0]).split(' · ').slice(0, 1).join('') : undefined}
                  cells={list.map((p, i) => {
                    const r = renders[i]
                    const e = ranks.get(p.id)
                    return r && e ? `${formatNumber(Math.round(r.value))} örnek/dk · ${e.rank}./${e.of} · %${Math.round(e.relative)}` : 'Ölçüm yok'
                  })}
                  best={bestIndex(
                    renders.map((r) => r?.value ?? null),
                    true
                  )}
                />
              )}
              {category === 'memory' && (
                <Row
                  label="Gecikme"
                  note="CL × 2000 / hız"
                  cells={list.map((p) => {
                    const ns = memoryLatencyNs(p)
                    return ns ? `${formatNumber(Math.round(ns * 100) / 100)} ns` : 'bilinmiyor'
                  })}
                  best={bestIndex(
                    list.map((p) => memoryLatencyNs(p)),
                    false
                  )}
                />
              )}
              {SPEC_DEFS[category].map((def) => (
                <Row key={def.key} label={def.label} cells={list.map((p) => formatSpecValue(def, p.specs[def.key]?.value ?? null))} />
              ))}
            </tbody>
          </table>
          <span className="muted small">
            Farklı değerler vurgulu; turkuaz çerçeve en ucuz fiyatı ve en yüksek ölçümü gösterir. {PRICE_NOTE}
          </span>
        </div>
      )}
    </div>
  )
}

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

function BuildsCompare(): ReactElement {
  const { catalog, byId } = useCatalog()
  const { builds, toggleBuild } = useCompare()
  const { index, storeName } = usePrices()
  const [saved, setSaved] = useState<SavedBuild[] | null>(null)

  useEffect(() => {
    window.melpc
      .listBuilds()
      .then(setSaved)
      .catch(() => setSaved([]))
  }, [])

  if (!saved) return <p className="muted">Yükleniyor…</p>
  const chosen = builds.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBuild => !!b)
  const rows = chosen.map((b) => {
    const build = toBuild(b.selection, byId)
    const ids = CATEGORY_IDS.flatMap((c) => (c === 'storage' ? build.storage : build[c] ? [build[c] as Part] : [])).map((p) => p.id)
    const compat = checkBuild(build)
    return {
      saved: b,
      build,
      totals: index.totals(ids),
      partCount: ids.length,
      compat,
      score: engineeringScore(build, catalog.parts, catalog.benchmarks.results),
      power: estimatePower(build)
    }
  })

  return (
    <div className="compare-block">
      {saved.length === 0 ? (
        <p className="muted">Henüz kayıtlı toplama yok. Kasa Topla ekranında toplamayı kaydedince burada seçilebilir.</p>
      ) : (
        <div className="compare-builds-pick" role="group" aria-label="Karşılaştırılacak toplamalar">
          {saved.map((b) => (
            <label key={b.id} className="checkbox">
              <input
                type="checkbox"
                checked={builds.includes(b.id)}
                disabled={!builds.includes(b.id) && builds.length >= MAX_BUILDS}
                onChange={() => toggleBuild(b.id)}
              />
              {b.name}
            </label>
          ))}
          <span className="muted small">En fazla {MAX_BUILDS} toplama.</span>
        </div>
      )}
      {rows.length < 2 ? (
        saved.length > 0 && <p className="muted">Karşılaştırmak için en az iki toplama seçin.</p>
      ) : (
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col" />
                {rows.map((r) => (
                  <th key={r.saved.id} scope="col">
                    <span className="cmp-head">{r.saved.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label="En ucuz kombinasyon"
                cells={rows.map((r) =>
                  r.totals.cheapest > 0
                    ? `${formatTl(r.totals.cheapest)}${r.totals.missing.length ? ` (${r.partCount - r.totals.missing.length}/${r.partCount} parça)` : ''}`
                    : 'Fiyat yok'
                )}
                best={bestIndex(
                  rows.map((r) => (r.totals.cheapest > 0 && !r.totals.missing.length ? r.totals.cheapest : null)),
                  false
                )}
              />
              <Row
                label="Tek mağazadan"
                cells={rows.map((r) => (r.totals.singleStore ? `${formatTl(r.totals.singleStore.total)} · ${storeName(r.totals.singleStore.storeId)}` : 'Yok'))}
              />
              <Row
                label="Mühendislik puanı"
                cells={rows.map((r) => (r.score.score !== null ? `${r.score.score} / 100` : 'Eksik'))}
                best={bestIndex(
                  rows.map((r) => r.score.score),
                  true
                )}
              />
              <Row label="Oyun puanı" cells={rows.map(() => 'Ölçüm kaynağı yok')} />
              <Row
                label="Uyumluluk"
                cells={rows.map((r) => {
                  const f = r.compat.filter((c) => c.status === 'fail').length
                  const w = r.compat.filter((c) => c.status === 'warn').length
                  return f ? `${f} uyumsuzluk${w ? `, ${w} uyarı` : ''}` : w ? `${w} uyarı` : r.compat.length ? 'Uyumlu' : '—'
                })}
              />
              <Row
                label="Tahmini tüketim"
                note={`varsayım: diğer parçalar ${rows[0].power.otherW} W`}
                cells={rows.map((r) =>
                  r.power.psuW ? `~${formatNumber(r.power.totalW)} W / ${formatNumber(r.power.psuW)} W (%${Math.round((r.power.loadRatio ?? 0) * 100)})` : `~${formatNumber(r.power.totalW)} W`
                )}
              />
              {CATEGORY_IDS.map((c) => (
                <Row
                  key={c}
                  label={CATEGORY_LABELS[c]}
                  cells={rows.map((r) => {
                    const ps = c === 'storage' ? r.build.storage : r.build[c] ? [r.build[c] as Part] : []
                    return ps.length ? ps.map(partName).join(', ') : '—'
                  })}
                />
              ))}
            </tbody>
          </table>
          <span className="muted small">Turkuaz çerçeve en ucuz toplamı ve en yüksek puanı gösterir. {PRICE_NOTE}</span>
        </div>
      )}
    </div>
  )
}
