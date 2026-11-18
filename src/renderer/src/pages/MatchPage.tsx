import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import type { ActionResult, CatalogPayload } from '@shared/api'
import { CATEGORY_IDS, type CategoryId, type Part } from '@engines/catalog/types'
import { CATEGORY_LABELS } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import type { StoreId, StoreMatch } from '@engines/price/types'
import { formatTl, formatWhen, stockText } from '../price/format'
import { usePrices } from '../price/PriceContext'
import { PriceLine } from '../price/PriceLine'
import { JOB_LABEL } from '../price/PriceStatus'

// Mağaza eşleştirme: her parça için mağazada bulunan ürün sayfası Melih'e "Bu ürün mü?" diye gösterilir.
// Fiyatlar yalnızca onaylanan linklerden çekilir.

type Filter = 'pending' | 'unmatched' | 'all'

type Run = (fn: () => Promise<ActionResult>) => Promise<ActionResult | null>

export function MatchPage({ catalog }: { catalog: CatalogPayload }): ReactElement {
  const { state, index, now, notify } = usePrices()
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState<CategoryId | ''>('')
  const [query, setQuery] = useState('')

  const matches = state?.matches ?? []
  const matchMap = useMemo(() => new Map(matches.map((m) => [`${m.partId}|${m.storeId}`, m])), [matches])
  const job = state?.job ?? null
  const stores = state?.stores ?? []
  const pendingParts = new Set(matches.filter((m) => m.status === 'candidate').map((m) => m.partId))
  const codeMatches = matches.filter((m) => m.status === 'candidate' && m.codeCheck === 'match').length
  const unmatched = catalog.parts.filter((p) => index.get(p.id).stores.length === 0)

  const run: Run = async (fn) => {
    try {
      const r = await fn()
      if (!r.ok || r.message) notify(r.message ?? '')
      return r
    } catch (e) {
      notify(`İşlem yapılamadı: ${(e as Error).message}`)
      return null
    }
  }

  const q = query.trim().toLocaleLowerCase('tr-TR')
  const visible = catalog.parts
    .filter((p) => !category || p.category === category)
    .filter((p) => !q || `${partName(p)} ${p.mpn ?? ''}`.toLocaleLowerCase('tr-TR').includes(q))
    .filter((p) => (filter === 'pending' ? pendingParts.has(p.id) : filter === 'unmatched' ? index.get(p.id).stores.length === 0 : true))
  const groups = CATEGORY_IDS.map((c) => ({
    category: c,
    parts: visible.filter((p) => p.category === c).sort((a, b) => partName(a).localeCompare(partName(b), 'tr'))
  })).filter((g) => g.parts.length)

  return (
    <div className="match-page">
      <div className="page-head">
        <div className="page-title">
          <span className="page-title__sub">
            {stores.length} mağaza · {catalog.parts.length} parça
          </span>
          <h1>MAĞAZA EŞLEŞTİRME</h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={Boolean(job) || !state}
            onClick={() => void run(() => window.melpc.findMatches())}
          >
            Eşleşmeyenleri ara
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={codeMatches === 0}
            onClick={() => void run(() => window.melpc.confirmCodeMatches())}
          >
            Kodu tutanları onayla ({codeMatches})
          </button>
        </div>
      </div>

      <p className="match-intro">
        Her parça mağazanın ürün listesinde aranır; bulunan sayfa size &quot;Bu ürün mü?&quot; diye sorulur. Fiyatlar yalnızca
        onayladığınız linklerden çekilir. Üretici kodu tutmayan bir eşleşme hiçbir zaman kendiliğinden onaylanmaz. Mağazaları
        yormamak için istekler yavaş gider (İtopya ve Gaming.gen.tr&apos;de 6, Vatan&apos;da 15 saniyede bir); bütün katalog için ilk
        arama uzun sürebilir, istediğiniz an durdurabilirsiniz.
      </p>

      {job ? (
        <div className="job-bar" role="status" aria-live="polite">
          <div className="job-bar__head">
            <span className="strong">{JOB_LABEL[job.kind]}</span>
            <span className="muted">
              {job.done} / {job.total}
            </span>
            <button type="button" className="chip-button" onClick={() => void window.melpc.cancelPriceJob()}>
              Durdur
            </button>
          </div>
          <div className="job-bar__track" aria-hidden="true">
            <div className="job-bar__fill" style={{ width: `${job.total ? Math.round((job.done / job.total) * 100) : 0}%` }} />
          </div>
          {job.current && <span className="muted small">Şu an: {job.current}</span>}
          {job.notes.map((n) => (
            <span key={n} className="warn-text small">
              {n}
            </span>
          ))}
        </div>
      ) : (
        state?.lastResult && (
          <p className="match-result">
            Son işlem ({formatWhen(state.lastResult.finishedAt, now)}): {state.lastResult.summary}
          </p>
        )
      )}

      <div className="match-filters">
        <div className="segmented" role="group" aria-label="Gösterilen parçalar">
          {(
            [
              ['all', `Hepsi (${catalog.parts.length})`],
              ['pending', `Onay bekleyen (${pendingParts.size})`],
              ['unmatched', `Eşleşmeyen (${unmatched.length})`]
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={`segmented__item${filter === f ? ' segmented__item--active' : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="select">
          <span>Kategori</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')}>
            <option value="">Hepsi</option>
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <input
          className="input"
          type="search"
          placeholder="Ara: marka, model ya da üretici kodu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!state ? (
        <p className="muted">Yükleniyor…</p>
      ) : groups.length === 0 ? (
        <p className="muted">Bu filtreye uyan parça yok.</p>
      ) : (
        <div className="match-table" role="table" aria-label="Parçaların mağaza eşleşmeleri">
          <div className="match-row match-row--head" role="row">
            <div role="columnheader">Parça</div>
            {stores.map((s) => (
              <div key={s.id} role="columnheader">
                {s.name}
              </div>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.category} role="rowgroup" className="match-group">
              <div className="match-group__title" role="row">
                <span role="rowheader">{CATEGORY_LABELS[g.category].toLocaleUpperCase('tr-TR')}</span>
              </div>
              {g.parts.map((part) => (
                <div key={part.id} className="match-row" role="row">
                  <div className="match-part" role="rowheader">
                    <span className="strong">{partName(part)}</span>
                    <span className="muted small">Üretici kodu: {part.mpn ?? 'katalogda yok'}</span>
                    <PriceLine partId={part.id} />
                  </div>
                  {stores.map((s) => (
                    <MatchCell
                      key={s.id}
                      part={part}
                      storeId={s.id}
                      match={matchMap.get(`${part.id}|${s.id}`)}
                      busy={Boolean(job)}
                      run={run}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CODE_BADGE: Record<NonNullable<StoreMatch['codeCheck']>, string> = {
  match: 'match-badge--ok',
  mismatch: 'match-badge--fail',
  missing: 'match-badge--warn'
}

function codeText(match: StoreMatch, part: Part): string {
  if (match.codeCheck === 'match') return 'Üretici kodu tutuyor'
  if (match.codeCheck === 'mismatch') return `Kod farklı: sayfada ${match.product?.mpn ?? '?'}`
  return part.mpn ? 'Sayfada üretici kodu yok' : 'Katalogda üretici kodu yok'
}

/** Bir parçanın bir mağazadaki eşleşmesi ve yapılabilecekler. */
function MatchCell({
  part,
  storeId,
  match,
  busy,
  run
}: {
  part: Part
  storeId: StoreId
  match: StoreMatch | undefined
  busy: boolean
  run: Run
}): ReactElement {
  const { index, storeName, now } = usePrices()
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [working, setWorking] = useState(false)

  const act = async (fn: () => Promise<ActionResult>): Promise<ActionResult | null> => {
    setWorking(true)
    try {
      return await run(fn)
    } finally {
      setWorking(false)
    }
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const r = await act(() => window.melpc.setMatchUrl(part.id, storeId, url))
    if (r?.ok) {
      setEditing(false)
      setUrl('')
    }
  }

  const search = (): void => void act(() => window.melpc.findMatches([part.id]))
  const linkButton = (label: string): ReactElement => (
    <button type="button" className="chip-button chip-button--quiet" disabled={busy || working} onClick={() => setEditing(true)}>
      {label}
    </button>
  )

  if (editing) {
    return (
      <form className="match-cell match-cell--editing" role="cell" onSubmit={(e) => void submit(e)}>
        <label className="match-cell__label" htmlFor={`url-${part.id}-${storeId}`}>
          {storeName(storeId)} ürün sayfasının linki
        </label>
        <input
          id={`url-${part.id}-${storeId}`}
          className="input input--small"
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        <span className="muted small">Sayfa okunur, üretici kodu karşılaştırılır; sonra onayınız istenir.</span>
        <div className="match-cell__actions">
          <button type="submit" className="chip-button" disabled={!url.trim() || working || busy}>
            {working ? 'Okunuyor…' : 'Sayfayı oku'}
          </button>
          <button type="button" className="chip-button chip-button--quiet" onClick={() => setEditing(false)}>
            Vazgeç
          </button>
        </div>
      </form>
    )
  }

  if (!match) {
    return (
      <div className="match-cell" role="cell">
        <span className="match-badge match-badge--muted">Aranmadı</span>
        <div className="match-cell__actions">
          <button type="button" className="chip-button" disabled={busy || working} onClick={search}>
            Ara
          </button>
          {linkButton('Link gir')}
        </div>
      </div>
    )
  }

  if (match.status === 'notFound' || match.status === 'rejected') {
    return (
      <div className="match-cell" role="cell">
        <span className="match-badge match-badge--muted">{match.status === 'notFound' ? 'Bulunamadı' : 'Reddedildi'}</span>
        <span className="muted small">
          {match.status === 'notFound' ? 'Arandı' : 'Reddedildi'}: {formatWhen(match.updatedAt, now)}
        </span>
        <div className="match-cell__actions">
          <button type="button" className="chip-button" disabled={busy || working} onClick={search}>
            Tekrar ara
          </button>
          {linkButton('Link gir')}
        </div>
      </div>
    )
  }

  const product = match.product
  if (match.status === 'candidate') {
    return (
      <div className="match-cell match-cell--candidate" role="cell">
        <span className="match-cell__question">Bu ürün mü?</span>
        <span className="match-cell__name">{product?.name ?? match.url}</span>
        <span className={`match-badge ${CODE_BADGE[match.codeCheck ?? 'missing']}`}>{codeText(match, part)}</span>
        <span className="muted small">
          {product?.price !== undefined ? formatTl(product.price) : 'Fiyat okunamadı'} · {stockText(product?.inStock ?? null)} ·{' '}
          {formatWhen(match.updatedAt, now)} okundu
        </span>
        {match.url && (
          <a className="small" href={match.url} target="_blank" rel="noreferrer">
            Sayfayı tarayıcıda aç
          </a>
        )}
        <div className="match-cell__actions">
          <button
            type="button"
            className="chip-button chip-button--confirm"
            disabled={working}
            onClick={() => void act(() => window.melpc.decideMatch(part.id, storeId, 'confirm'))}
          >
            Onayla
          </button>
          <button
            type="button"
            className="chip-button chip-button--quiet"
            disabled={working}
            onClick={() => void act(() => window.melpc.decideMatch(part.id, storeId, 'reject'))}
          >
            Bu ürün değil
          </button>
          {linkButton('Link gir')}
        </div>
      </div>
    )
  }

  // Onaylı
  const sp = index.get(part.id).stores.find((s) => s.storeId === storeId)
  const remove = (): void => {
    if (!window.confirm(`${storeName(storeId)} eşleşmesi kaldırılsın mı? Bu link bir daha önerilmez; isterseniz yeniden girebilirsiniz.`)) return
    void act(() => window.melpc.decideMatch(part.id, storeId, 'reject'))
  }
  return (
    <div className="match-cell" role="cell">
      <span className="match-badge match-badge--ok">Onaylı</span>
      <span className="match-cell__name">{product?.name ?? match.url}</span>
      {sp && (
        <span className="small">
          <span className="strong">{sp.price !== null ? formatTl(sp.price) : 'Fiyat okunamadı'}</span>
          <span className="muted">
            {' '}
            · {stockText(sp.inStock)}
            {sp.pricedAt ? ` · ${formatWhen(sp.pricedAt, now)}` : ''}
          </span>
          {sp.stale && <span className="warn-text"> · güncel değil</span>}
        </span>
      )}
      {match.url && (
        <a className="small" href={match.url} target="_blank" rel="noreferrer">
          Sayfayı tarayıcıda aç
        </a>
      )}
      <div className="match-cell__actions">
        {linkButton('Linki değiştir')}
        <button type="button" className="chip-button chip-button--quiet" disabled={working} onClick={remove}>
          Kaldır
        </button>
      </div>
    </div>
  )
}
