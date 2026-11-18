import { useMemo, useState, type ReactElement } from 'react'
import type { Part } from '@engines/catalog/types'
import { CATEGORY_LABELS } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import { matchSystemLines, summarizeReadySystem, type LineMatch, type ReadySystem } from '@engines/price/readySystem'
import { tokens } from '@engines/price/text'
import { useCatalog } from '../catalog/CatalogContext'
import { usePrices } from '../price/PriceContext'
import { PriceLine } from '../price/PriceLine'
import { formatFullDateTime, formatTl, PRICE_NOTE } from '../price/format'
import { useCompare } from './CompareContext'

// Hazır sistem karşılaştırması (Melih onayladı, 4. aşama): Melih İtopya ya da Gaming.gen.tr'deki hazır bir
// sistemin linkini yapıştırır; sayfa yalnızca istenince, bir kez okunur. Katalogda tanınan parçaların en ucuz güncel
// fiyatlarının toplamı ("kendin toplasan") sistemin fiyatıyla karşılaştırılır. Tanınmayan parçanın fiyatı tahmin
// edilmez; o zaman karşılaştırmanın kısmi olduğu açıkça yazılır.

export function ReadySystemCompare(): ReactElement {
  const { catalog } = useCatalog()
  const { ready, setReady } = useCompare()
  const { state } = usePrices()
  const [url, setUrl] = useState(ready?.url ?? '')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const otherJob = Boolean(state?.job) && !reading
  // Onaylı mağaza linkleri: hazır sistemdeki ürünün linki bunlardan biriyse parça o linkle kesin tanınır.
  const confirmedUrls = useMemo(
    () => new Map((state?.matches ?? []).filter((m) => m.status === 'confirmed' && m.url).map((m) => [m.url as string, m.partId])),
    [state]
  )
  const matches = useMemo(
    () => (ready ? matchSystemLines(ready.lines, catalog.parts, confirmedUrls) : []),
    [ready, catalog, confirmedUrls]
  )

  const read = async (): Promise<void> => {
    const link = url.trim()
    if (!link || reading) return
    setReading(true)
    setError(null)
    try {
      const r = await window.melpc.readReadySystem(link)
      if (r.ok) setReady(r.system)
      else setError(r.message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="compare-block">
      <form
        className="ready-form"
        onSubmit={(e) => {
          e.preventDefault()
          void read()
        }}
      >
        <label className="ready-form__field">
          <span>Hazır sistemin linki (İtopya ya da Gaming.gen.tr)</span>
          <input
            className="input"
            type="text"
            inputMode="url"
            spellCheck={false}
            placeholder="https://www.itopya.com/…_h12345"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button type="submit" className="button button--primary" disabled={!url.trim() || reading || otherJob}>
          {reading ? 'Okunuyor…' : 'Oku'}
        </button>
      </form>
      <p className="muted small">
        Sayfa yalnızca "Oku"ya basınca, bir kez okunur. Sistemin parçaları katalogla eşleştirilir; tanınan parçaların
        en ucuz güncel fiyatlarıyla "kendin toplasan" fiyatı hesaplanır.
      </p>
      {otherJob && <p className="muted small">Şu an başka bir fiyat işi sürüyor; bitince okuyabilirsiniz.</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {ready && <ReadyResult system={ready} matches={matches} />}
    </div>
  )
}

function stockText(inStock: boolean | undefined): string {
  if (inStock === true) return 'Stokta'
  if (inStock === false) return 'Stokta değil'
  return 'Stok bilgisi sayfada yok'
}

interface Tile {
  label: string
  value: string
  muted?: boolean
  details: string[]
}

function ReadyResult({ system, matches }: { system: ReadySystem; matches: LineMatch[] }): ReactElement {
  const { byId } = useCatalog()
  const { index, storeName } = usePrices()
  const price = system.price
  const s = summarizeReadySystem(price, matches, index.totals)
  // Önce parçalar (sayfadaki sırayla), sonra katalogda karşılığı olmayan kalemler.
  const { parts, others, recognized, priced } = s
  const unpriced = parts.length - priced

  const systemTile: Tile = {
    label: 'Hazır sistem',
    value: price !== undefined ? formatTl(price) : 'Fiyat okunamadı',
    muted: price === undefined,
    details: [`${storeName(system.storeId)} · ${stockText(system.inStock)}`, `${formatFullDateTime(system.fetchedAt)} okundu`]
  }

  const selfTile: Tile =
    s.selfBuild !== null
      ? {
          label: 'Kendin toplasan',
          value: formatTl(s.selfBuild),
          details: s.complete
            ? [
                'aynı parçalar, her biri en ucuz mağazasından',
                ...(s.singleStore ? [`tek mağazadan: ${formatTl(s.singleStore.total)} · ${storeName(s.singleStore.storeId)}`] : [])
              ]
            : [`kısmi: ${parts.length} parçadan yalnızca ${priced} tanesinin fiyatı var`]
        }
      : {
          label: 'Kendin toplasan',
          value: 'Hesaplanamadı',
          muted: true,
          details: [recognized.length ? 'tanınan parçaların güncel ve stokta fiyatı yok' : 'katalogda tanınan parça yok']
        }

  let diffTile: Tile
  if (price === undefined) {
    diffTile = { label: 'Fark', value: 'Hesaplanamadı', muted: true, details: ['sistemin fiyatı okunamadı'] }
  } else if (s.difference !== null) {
    const d = s.difference
    diffTile = {
      label: 'Fark',
      value: formatTl(Math.abs(d)),
      details: [d > 0 ? 'hazır sistem daha pahalı' : d < 0 ? 'hazır sistem daha ucuz' : 'fiyatlar aynı']
    }
  } else {
    const rest = s.remainder
    diffTile = {
      label: 'Fark',
      value: 'Doğrudan karşılaştırılamaz',
      muted: true,
      details: [
        `${unpriced} parçanın fiyatı bilinmiyor`,
        ...(rest !== null
          ? [
              rest >= 0
                ? `sistemin fiyatından fiyatı bilinen parçalar çıkınca kalan: ${formatTl(rest)}`
                : `fiyatı bilinen parçalar bile sistemin fiyatını ${formatTl(-rest)} aşıyor`
            ]
          : [])
      ]
    }
  }

  const notes: string[] = []
  if (parts.length && !parts.some((m) => m.line.category === 'psu')) notes.push('Sistemin parça listesinde ayrı bir güç kaynağı yok.')
  if (others.length) {
    notes.push(
      `Katalogda karşılığı olmayan ${others.length} kalem (${others.map((m) => m.line.label).join(', ')}) "kendin toplasan" fiyatına katılmaz.`
    )
  }
  if (s.codeMismatches) {
    notes.push(`${s.codeMismatches} parça adına göre tanındı ama mağazanın kodu katalogdakinden farklı; aynı ürün olduğundan emin olun.`)
  }
  notes.push('Hazır sistemin fiyatı, sayfanın okunduğu andaki fiyattır.')
  notes.push(PRICE_NOTE)

  return (
    <>
      <div className="ready-head">
        <a className="ready-head__name" href={system.url} target="_blank" rel="noreferrer">
          {system.name ?? 'Sistemin adı okunamadı'}
        </a>
        <span className="muted small">
          {parts.length} parça · katalogda tanınan {recognized.length}
          {others.length ? ` · katalogda karşılığı olmayan ${others.length} kalem` : ''}
        </span>
      </div>
      <div className="ready-stats">
        {[systemTile, selfTile, diffTile].map((t) => (
          <div key={t.label} className="ready-stat">
            <span className="ready-stat__label">{t.label}</span>
            <span className={`ready-stat__value${t.muted ? ' ready-stat__value--muted' : ''}`}>{t.value}</span>
            {t.details.map((d) => (
              <span key={d} className="ready-stat__detail">
                {d}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="cmp-wrap">
        <table className="cmp-table ready-table">
          <thead>
            <tr>
              <th scope="col">Bileşen</th>
              <th scope="col">Sistemdeki ürün</th>
              <th scope="col">Katalogda</th>
              <th scope="col">En ucuz fiyat</th>
            </tr>
          </thead>
          <tbody>
            {[...parts, ...others].map((m, i) => (
              <ReadyRow key={i} m={m} part={m.partId ? byId.get(m.partId) : undefined} byId={byId} />
            ))}
          </tbody>
        </table>
        <ul className="ready-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </>
  )
}

/** İki bileşen adı aynı şeyi mi söylüyor ("RAM(Bellek)" ile "Bellek (RAM)", "İşlemci Soğutucular" ile "İşlemci soğutucu"). */
function sameLabel(a: string, b: string): boolean {
  const x = tokens(a)
  const y = tokens(b)
  return x.length === y.length && x.every((w) => y.some((v) => v.startsWith(w) || w.startsWith(v)))
}

function ReadyRow({ m, part, byId }: { m: LineMatch; part?: Part; byId: Map<string, Part> }): ReactElement {
  const l = m.line
  let catalogCell: ReactElement
  if (part) {
    const tag =
      m.by === 'link' ? (
        <span className="match-badge match-badge--ok">Onaylı mağaza linki</span>
      ) : m.by === 'code' || m.codeCheck === 'match' ? (
        <span className="match-badge match-badge--ok">Üretici kodu tuttu</span>
      ) : m.codeCheck === 'mismatch' ? (
        <span className="match-badge match-badge--warn">Adı tutuyor, kodu farklı (katalog: {part.mpn})</span>
      ) : (
        <span className="match-badge match-badge--muted">Adına göre tanındı</span>
      )
    catalogCell = (
      <>
        <span className="strong">{partName(part)}</span>
        {tag}
      </>
    )
  } else if (m.ambiguous) {
    const names = m.ambiguous.map((id) => byId.get(id)).filter((p): p is Part => !!p).map(partName)
    catalogCell = <span className="muted">Birden fazla parçaya benziyor: {names.join(', ')}</span>
  } else {
    catalogCell = <span className="muted">{l.category ? 'Tanınmadı (katalogda yok)' : 'Katalogda bu tür yok'}</span>
  }
  return (
    <tr className="cmp-row">
      <th scope="row">
        {l.label}
        {l.category && !sameLabel(l.label, CATEGORY_LABELS[l.category]) && (
          <span className="cmp-note">{CATEGORY_LABELS[l.category]}</span>
        )}
      </th>
      <td>
        {l.url ? (
          <a href={l.url} target="_blank" rel="noreferrer">
            {l.name}
          </a>
        ) : (
          l.name
        )}
        {l.code && <span className="cmp-note">Mağaza kodu: {l.code}</span>}
      </td>
      <td>{catalogCell}</td>
      <td>{part ? <PriceLine partId={part.id} /> : <span className="muted">—</span>}</td>
    </tr>
  )
}
