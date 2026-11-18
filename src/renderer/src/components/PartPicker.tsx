import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { CategoryId, Part, SpecValue } from '@engines/catalog/types'
import { CATEGORY_LABELS, formatSpecValue, SPEC_DEFS, type SpecDef } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import { partSummary } from '@engines/catalog/summary'
import { checkCandidate, worstStatus, type Build, type CompatResult } from '@engines/compat'
import { compareBy, rankParts, SORT_OPTIONS } from '@engines/score/sorting'
import { PartDetails } from './PartDetails'
import { PriceLine } from '../price/PriceLine'
import { usePrices } from '../price/PriceContext'
import { useCatalog } from '../catalog/CatalogContext'
import { CategoryIcon } from './icons'

interface PartPickerProps {
  category: CategoryId
  parts: Part[]
  build: Build
  /** Bu kategoride şu an seçili parçaların id'leri. */
  selectedIds: string[]
  onChoose: (part: Part) => void
  onClose: () => void
}

/** Filtre seçeneği için değerin anahtarı (liste değerlerinde her eleman ayrı seçenek). */
function optionKeys(def: SpecDef, value: SpecValue | null): string[] {
  if (value === null || value === undefined) return []
  if (def.kind === 'enumList' && Array.isArray(value)) return (value as string[]).map(String)
  if (def.kind === 'boolean') return [value ? 'true' : 'false']
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  return []
}

function optionLabel(def: SpecDef, key: string): string {
  if (def.kind === 'boolean') return key === 'true' ? 'Var' : 'Yok'
  if (def.kind === 'integer' || def.kind === 'number') return formatSpecValue(def, Number(key))
  return def.optionLabels?.[key] ?? key
}

const STATUS_ORDER = { ok: 0, warn: 1, fail: 2 } as const

export function PartPicker({ category, parts, build, selectedIds, onChoose, onClose }: PartPickerProps): ReactElement {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [onlyCompatible, setOnlyCompatible] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(selectedIds[0] ?? null)
  const [sortId, setSortId] = useState('compat')
  const { catalog } = useCatalog()
  const { index } = usePrices()
  const ctx = useMemo(() => ({ results: catalog.benchmarks.results }), [catalog])
  const sortOptions = SORT_OPTIONS[category]
  const sortOption = sortOptions.find((o) => o.id === sortId)
  // İşlemci ve ekran kartında render ölçümündeki sıra; öbür kategorilerde seçili sıralamanın değeri gösterilir.
  const renderRanks = useMemo(
    () => (category === 'cpu' || category === 'gpu' ? rankParts(parts, sortOptions[0], ctx) : null),
    [category, parts, sortOptions, ctx]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filterDefs = SPEC_DEFS[category].filter((d) => d.filter)
  const filterOptions = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const def of filterDefs) {
      const keys = new Set<string>()
      for (const p of parts) for (const k of optionKeys(def, p.specs[def.key]?.value ?? null)) keys.add(k)
      out[def.key] = [...keys].sort((a, b) =>
        def.kind === 'integer' || def.kind === 'number' ? Number(a) - Number(b) : a.localeCompare(b, 'tr')
      )
    }
    return out
  }, [parts, filterDefs])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return parts
      .filter((p) => !q || `${partName(p)} ${p.mpn ?? ''}`.toLocaleLowerCase('tr-TR').includes(q))
      .filter((p) =>
        Object.entries(filters).every(([key, wanted]) => {
          if (!wanted) return true
          const def = filterDefs.find((d) => d.key === key)!
          return optionKeys(def, p.specs[key]?.value ?? null).includes(wanted)
        })
      )
      .map((p) => {
        const problems: CompatResult[] = checkCandidate(build, p)
        return { part: p, problems, status: worstStatus(problems) }
      })
      .filter((r) => !onlyCompatible || r.status !== 'fail')
      .sort((a, b) => {
        const byName = partName(a.part).localeCompare(partName(b.part), 'tr')
        if (sortId === 'name') return byName
        if (sortId === 'price') {
          const pa = index.get(a.part.id).best?.price ?? Number.POSITIVE_INFINITY
          const pb = index.get(b.part.id).best?.price ?? Number.POSITIVE_INFINITY
          return pa - pb || byName
        }
        if (sortOption) return compareBy(sortOption, ctx)(a.part, b.part) || byName
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byName
      })
  }, [parts, query, filters, filterDefs, onlyCompatible, build, category, selectedIds, sortId, sortOption, ctx, index])

  const focus = parts.find((p) => p.id === focusId) ?? rows[0]?.part ?? null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${CATEGORY_LABELS[category]} seç`}>
        <div className="modal__head">
          <div className="modal__title">
            <span className="part-slot__icon part-slot__icon--active">
              <CategoryIcon category={category} />
            </span>
            <div>
              <span className="section-title">{CATEGORY_LABELS[category].toLocaleUpperCase('tr-TR')} SEÇ</span>
              <span className="muted small">
                {parts.length} parça · uyumsuz olanlar işaretlenir, nedeni yazılır
              </span>
            </div>
          </div>
          <button type="button" className="round-button" aria-label="Kapat" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="line-icon">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="picker__filters">
          <input
            className="input"
            type="search"
            placeholder="Ara: marka, model ya da üretici kodu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {filterDefs.map((def) => (
            <label key={def.key} className="select">
              <span>{def.label}</span>
              <select
                value={filters[def.key] ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, [def.key]: e.target.value }))}
              >
                <option value="">Hepsi</option>
                {filterOptions[def.key].map((k) => (
                  <option key={k} value={k}>
                    {optionLabel(def, k)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="select">
            <span>Sırala</span>
            <select value={sortId} onChange={(e) => setSortId(e.target.value)}>
              <option value="compat">Uyumluluğa göre</option>
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
              <option value="price">Fiyat (ucuzdan)</option>
              <option value="name">Ada göre</option>
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={onlyCompatible} onChange={(e) => setOnlyCompatible(e.target.checked)} />
            Uyumsuzları gizle
          </label>
          {sortOption?.formula && <span className="picker__formula muted small">Hesap: {sortOption.formula}</span>}
        </div>

        <div className="picker__body">
          <ul className="picker__list" aria-label="Parçalar">
            {rows.length === 0 && <li className="muted small picker__empty">Bu filtrelere uyan parça yok.</li>}
            {rows.map(({ part, problems, status }) => {
              const selected = selectedIds.includes(part.id)
              const first = problems.find((p) => p.status === 'fail') ?? problems[0]
              return (
                <li key={part.id}>
                  <div
                    className={`picker__row picker__row--${status}${focus?.id === part.id ? ' picker__row--focus' : ''}`}
                    onMouseEnter={() => setFocusId(part.id)}
                    onClick={() => setFocusId(part.id)}
                    onDoubleClick={() => onChoose(part)}
                  >
                    <div className="picker__main">
                      <span className="picker__name">{partName(part)}</span>
                      <span className="picker__meta">{partSummary(part)}</span>
                      {renderRanks ? (
                        <span className="picker__metric">
                          {(() => {
                            const r = renderRanks.get(part.id)
                            return r
                              ? `Render (Blender): ${sortOptions[0].format(r.value)} · ${r.rank}./${r.of}`
                              : 'Render (Blender): ölçüm yok'
                          })()}
                        </span>
                      ) : (
                        sortOption && (
                          <span className="picker__metric">
                            {sortOption.label}:{' '}
                            {(() => {
                              const v = sortOption.value(part, ctx)
                              return v === null ? 'bilinmiyor' : sortOption.format(v)
                            })()}
                          </span>
                        )
                      )}
                      {first && (
                        <span className={`picker__problem picker__problem--${first.status}`}>
                          {first.status === 'fail' ? 'Uyumsuz' : 'Uyarı'}: {first.message}
                          {problems.length > 1 ? ` (+${problems.length - 1})` : ''}
                        </span>
                      )}
                    </div>
                    <div className="picker__side">
                      <PriceLine partId={part.id} className="picker__price" />
                      <button
                        type="button"
                        className={selected ? 'button button--ghost' : 'button button--primary'}
                        onClick={(e) => {
                          e.stopPropagation()
                          onChoose(part)
                        }}
                      >
                        {selected ? (category === 'storage' ? 'Bir tane daha' : 'Seçili') : category === 'storage' ? 'Ekle' : 'Seç'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <aside className="picker__details" aria-label="Teknik özellikler">
            {focus ? <PartDetails part={focus} /> : <p className="muted small">Bir parçanın üstüne gel.</p>}
          </aside>
        </div>
      </div>
    </div>
  )
}
