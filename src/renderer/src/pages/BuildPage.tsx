import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type { BuildSelection, CatalogPayload, SavedBuild } from '@shared/api'
import { CATEGORY_IDS, type CategoryId, type Part } from '@engines/catalog/types'
import { CATEGORY_LABELS, formatNumber } from '@engines/catalog/specDefs'
import { partName, specNum } from '@engines/catalog/access'
import { partSummary } from '@engines/catalog/summary'
import { checkBuild, estimatePower, POWER_ASSUMPTIONS, type Build, type CompatResult } from '@engines/compat'
import { CategoryIcon } from '../components/icons'
import { PartPicker } from '../components/PartPicker'
import { CaseViewer } from '../three/CaseViewer'
import { PricePanel } from '../price/PricePanel'
import { PriceLine } from '../price/PriceLine'
import { EvaluationPanel } from '../score/EvaluationPanel'
import { desktopCase } from '../three/DesktopCase'

const EMPTY_SELECTION: BuildSelection = { storage: [] }
const NEW_BUILD_NAME = 'Yeni toplama'

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
  const [selection, setSelection] = useState<BuildSelection>(EMPTY_SELECTION)
  const [buildId, setBuildId] = useState<number | undefined>(undefined)
  const [buildName, setBuildName] = useState(NEW_BUILD_NAME)
  const [active, setActive] = useState<CategoryId | null>(null)
  const [pickerFor, setPickerFor] = useState<CategoryId | null>(null)
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const byId = useMemo(() => new Map(catalog.parts.map((p) => [p.id, p])), [catalog])
  const build = useMemo(() => toBuild(selection, byId), [selection, byId])
  // Sorunlar listenin başında: önce uyumsuz, sonra uyarı, en son uyumlu.
  const results = useMemo(() => {
    const order = { fail: 0, warn: 1, ok: 2 } as const
    return checkBuild(build).sort((a, b) => order[a.status] - order[b.status])
  }, [build])
  const power = useMemo(() => estimatePower(build), [build])
  const partsByCategory = useMemo(() => {
    const m = Object.fromEntries(CATEGORY_IDS.map((c) => [c, [] as Part[]])) as Record<CategoryId, Part[]>
    for (const p of catalog.parts) m[p.category].push(p)
    return m
  }, [catalog])

  const refreshSaved = useCallback(() => {
    window.melpc.listBuilds().then(setSavedBuilds).catch(() => setSavedBuilds([]))
  }, [])
  useEffect(refreshSaved, [refreshSaved])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const selectedParts = (cat: CategoryId): Part[] =>
    cat === 'storage' ? build.storage : build[cat] ? [build[cat] as Part] : []

  const choose = (part: Part): void => {
    setSelection((s) =>
      part.category === 'storage' ? { ...s, storage: [...s.storage, part.id] } : { ...s, [part.category]: part.id }
    )
    setActive(part.category)
    setPickerFor(null)
  }

  const remove = (cat: CategoryId, index?: number): void => {
    setSelection((s) => {
      if (cat === 'storage') return { ...s, storage: s.storage.filter((_, i) => i !== index) }
      const next = { ...s }
      delete next[cat as Exclude<CategoryId, 'storage'>]
      return next
    })
  }

  const save = async (): Promise<void> => {
    try {
      const saved = await window.melpc.saveBuild({ id: buildId, name: buildName.trim() || NEW_BUILD_NAME, selection })
      setBuildId(saved.id)
      setBuildName(saved.name)
      setToast(`"${saved.name}" kaydedildi.`)
      refreshSaved()
    } catch (e) {
      setToast(`Kaydedilemedi: ${(e as Error).message}`)
    }
  }

  const open = (b: SavedBuild): void => {
    // Katalogda artık olmayan parçalar toplamadan düşer; kullanıcıya söylenir.
    const missing = [
      ...Object.entries(b.selection)
        .filter(([k, v]) => k !== 'storage' && typeof v === 'string' && !byId.has(v))
        .map(([, v]) => v as string),
      ...b.selection.storage.filter((id) => !byId.has(id))
    ]
    setSelection(b.selection)
    setBuildId(b.id)
    setBuildName(b.name)
    setShowSaved(false)
    setToast(
      missing.length
        ? `"${b.name}" açıldı. Katalogda artık olmayan ${missing.length} parça gösterilmiyor.`
        : `"${b.name}" açıldı.`
    )
  }

  const startNew = (): void => {
    setSelection(EMPTY_SELECTION)
    setBuildId(undefined)
    setBuildName(NEW_BUILD_NAME)
    setActive(null)
  }

  const removeSaved = async (b: SavedBuild): Promise<void> => {
    if (!window.confirm(`"${b.name}" kalıcı olarak silinsin mi? Bu geri alınamaz.`)) return
    await window.melpc.deleteBuild(b.id)
    if (b.id === buildId) setBuildId(undefined)
    refreshSaved()
    setToast(`"${b.name}" silindi.`)
  }

  const partNames = Object.fromEntries(
    CATEGORY_IDS.map((c) => {
      const ps = selectedParts(c)
      return [c, ps.length ? ps.map(partName).join(', ') : undefined]
    })
  ) as Partial<Record<CategoryId, string>>

  const okCount = results.filter((r) => r.status === 'ok').length
  const loadPct = Math.round((power.loadRatio ?? 0) * 100)
  const recommendedPsu = specNum(build.gpu, 'recommendedPsuW')

  return (
    <div className="build-page">
      <div className="page-head">
        <div className="page-title">
          <input
            className="page-title__name"
            value={buildName}
            onChange={(e) => setBuildName(e.target.value)}
            aria-label="Toplamanın adı"
            maxLength={120}
          />
          <h1>KASA TOPLA</h1>
        </div>
        <div className="page-actions">
          <div className="saved">
            <button type="button" className="button button--ghost" onClick={() => setShowSaved((v) => !v)} aria-expanded={showSaved}>
              Kayıtlı toplamalar ({savedBuilds.length})
            </button>
            {showSaved && (
              <div className="saved__menu" role="menu">
                {savedBuilds.length === 0 && <p className="muted small">Henüz kayıtlı toplama yok.</p>}
                {savedBuilds.map((b) => (
                  <div key={b.id} className="saved__item">
                    <button type="button" className="saved__open" onClick={() => open(b)}>
                      <span className="strong">{b.name}</span>
                      <span className="muted small">
                        {new Date(b.updatedAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </button>
                    <button type="button" className="icon-button" aria-label={`${b.name} toplamasını sil`} onClick={() => void removeSaved(b)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="line-icon">
                        <path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="button button--ghost" onClick={startNew}>
            Yeni
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()}>
            Kaydet
          </button>
        </div>
      </div>

      <div className="build-layout">
        <section aria-label="Parça listesi" className="part-list">
          {CATEGORY_IDS.map((cat) => {
            const parts = selectedParts(cat)
            const isActive = active === cat
            return (
              <div key={cat} className={`part-slot${isActive ? ' part-slot--active' : ''}`}>
                <button type="button" className="part-slot__hit" onClick={() => setActive(isActive ? null : cat)} aria-pressed={isActive}>
                  <span className={`part-slot__icon${isActive ? ' part-slot__icon--active' : ''}`}>
                    <CategoryIcon category={cat} />
                  </span>
                  <span className="part-slot__body">
                    <span className={`part-slot__label${isActive ? ' part-slot__label--active' : ''}`}>
                      {CATEGORY_LABELS[cat].toLocaleUpperCase('tr-TR')}
                      {isActive ? ' · KASADA' : ''}
                    </span>
                    {parts.length === 0 && <span className="part-slot__empty">Seçilmedi</span>}
                    {parts.map((p, i) => (
                      <span key={`${p.id}-${i}`} className="part-slot__item">
                        <span className="part-slot__name">{partName(p)}</span>
                        <span className="part-slot__meta">{partSummary(p)}</span>
                        <PriceLine partId={p.id} className="part-slot__price" showCount={false} />
                      </span>
                    ))}
                  </span>
                </button>
                <div className="part-slot__actions">
                  <button type="button" className="chip-button" onClick={() => setPickerFor(cat)}>
                    {cat === 'storage' ? (parts.length ? 'Disk ekle' : 'Seç') : parts.length ? 'Değiştir' : 'Seç'}
                  </button>
                  {parts.map((p, i) => (
                    <button
                      key={`${p.id}-x-${i}`}
                      type="button"
                      className="chip-button chip-button--quiet"
                      aria-label={`${partName(p)} çıkar`}
                      onClick={() => remove(cat, i)}
                    >
                      {cat === 'storage' && parts.length > 1 ? `Çıkar (${i + 1})` : 'Çıkar'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        <section aria-label="Kasanın içi" className="stage">
          <div className="stage__head">
            <span className="section-title">360° KASA GÖRÜNÜMÜ</span>
            <span className="muted small">Noktaların üstüne gel: parça adı · Sürükle: döndür · Tekerlek: yakınlaştır</span>
          </div>
          <CaseViewer
            model={desktopCase}
            highlight={active}
            memoryModules={specNum(build.memory, 'modules') ?? 0}
            partNames={partNames}
            onPick={(cat) => setActive(cat)}
          />
          <p className="stage__note muted small">
            Görsel bütün toplamalarda aynı temel kasadır; parçaların gerçek ölçüleri uyumluluk hesabında kullanılır.
          </p>
        </section>

        <section aria-label="Değerlendirme" className="side-panel">
          <div className="panel">
            <div className="panel__head">
              <span className="section-title">UYUMLULUK</span>
              {results.length > 0 && (
                <span className="panel__count">
                  {okCount} / {results.length}
                </span>
              )}
            </div>
            {results.length === 0 ? (
              <p className="muted small">Parça seçtikçe uyumluluk sonuçları burada görünür.</p>
            ) : (
              <ul className="compat-list">
                {results.map((r) => (
                  <li key={r.ruleId}>
                    <button
                      type="button"
                      className={`compat-item compat-item--${r.status}`}
                      onClick={() => setActive(r.categories.find((c) => selectedParts(c).length) ?? r.categories[0])}
                    >
                      <span className="compat-item__status">{STATUS_LABEL[r.status]}</span>
                      <span className="compat-item__title">{r.title}</span>
                      <span className="compat-item__message">{r.message}</span>
                    </button>
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
                  className={`power__fill${loadPct > 100 ? ' power__fill--fail' : loadPct > POWER_ASSUMPTIONS.warnLoadRatio * 100 ? ' power__fill--warn' : ''}`}
                  style={{ width: `${Math.min(100, loadPct)}%` }}
                />
                <div className="power__marker" style={{ left: `${POWER_ASSUMPTIONS.warnLoadRatio * 100}%` }} />
              </div>
              <span className="muted small">
                {power.psuW ? `Yük %${loadPct}` : 'Güç kaynağı seçilmedi'}
                {recommendedPsu ? (
                  <>
                    {' · '}
                    <span className="warn-text">ekran kartı için önerilen en az {formatNumber(recommendedPsu)} W</span>
                  </>
                ) : null}
              </span>
              <span className="muted small">
                Varsayım: işlemci ve ekran kartının üretici güç değerleri + diğer parçalar için sabit{' '}
                {POWER_ASSUMPTIONS.otherComponentsW} W. Sarı çizgi %{POWER_ASSUMPTIONS.warnLoadRatio * 100} sınırı.
              </span>
            </div>
          </div>

          <EvaluationPanel build={build} compat={results} />

          <PricePanel parts={CATEGORY_IDS.flatMap((c) => selectedParts(c))} />

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

      {pickerFor && (
        <PartPicker
          category={pickerFor}
          parts={partsByCategory[pickerFor]}
          build={build}
          selectedIds={selectedParts(pickerFor).map((p) => p.id)}
          onChoose={choose}
          onClose={() => setPickerFor(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
