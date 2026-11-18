import { useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react'
import type { OfferRecord, StoreId } from '@engines/price/types'
import { formatDateTime, formatFullDateTime, formatTl, seriesColor, stockText } from './format'

// Mağaza başına fiyat geçmişi: zaman ekseninde her mağaza bir çizgi. Tek eksen (TL).
// Üzerine gelince (ya da klavyeyle) dikey çizgi en yakın çekime oturur ve o çekimdeki bütün mağaza fiyatları
// gösterilir. Aynı bilgiler grafiğin altındaki tabloda da var.

const W = 344
const H = 168
const M = { l: 46, r: 12, t: 12, b: 24 }
/** Bir çekimde mağazalar birkaç saniye/dakika arayla okunur; bu aralıktaki okumalar aynı an sayılır. */
const SAME_RUN_MS = 30 * 60 * 1000

interface Point {
  t: number
  v: number
  inStock: boolean | null
}

function niceStep(range: number): number {
  const raw = range / 3
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

function yTicks(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  let a = min
  let b = max
  if (a === b) {
    const pad = Math.max(1, Math.abs(a) * 0.02)
    a -= pad
    b += pad
  }
  const step = niceStep(b - a)
  const lo = Math.floor(a / step) * step
  const hi = Math.ceil(b / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { lo, hi, ticks }
}

const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const pad2 = (n: number): string => String(n).padStart(2, '0')
/** "18.11" */
const dayLabel = (t: number): string => {
  const d = new Date(t)
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`
}

export function PriceHistoryChart({
  history,
  storeIds,
  storeName
}: {
  history: OfferRecord[]
  storeIds: StoreId[]
  storeName: (id: StoreId) => string
}): ReactElement {
  const [hover, setHover] = useState<number | null>(null)

  const data = useMemo(() => {
    const series = storeIds
      .map((id) => ({
        id,
        points: history
          .filter((o) => o.storeId === id && o.price !== null)
          .map((o): Point => ({ t: Date.parse(o.fetchedAt), v: o.price as number, inStock: o.inStock }))
          .sort((a, b) => a.t - b.t)
      }))
      .filter((s) => s.points.length)
    // Çekimler: birbirine yakın okumalar tek bir an (ilk okumanın zamanı).
    const runs: number[] = []
    for (const t of series.flatMap((s) => s.points.map((p) => p.t)).sort((a, b) => a - b)) {
      if (!runs.length || t - runs[runs.length - 1] > SAME_RUN_MS) runs.push(t)
    }
    return { series, runs }
  }, [history, storeIds])

  const { series, runs } = data
  if (!series.length) return <p className="muted small">Henüz okunmuş fiyat yok.</p>
  // Her mağazada tek okuma varken çizgi anlamsız: en az bir mağazada iki okuma olmalı.
  if (!series.some((s) => s.points.length >= 2) || runs.length < 2) {
    return <p className="muted small">Fiyat geçmişi her çekimde bir nokta ekler; çizgi için en az iki çekim gerekiyor.</p>
  }

  const values = series.flatMap((s) => s.points.map((p) => p.v))
  const { lo, hi, ticks } = yTicks(Math.min(...values), Math.max(...values))
  const t0 = Math.min(...series.map((s) => s.points[0].t))
  const t1 = Math.max(...series.map((s) => s.points[s.points.length - 1].t))
  const x = (t: number): number => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r)
  const y = (v: number): number => M.t + ((hi - v) / (hi - lo)) * (H - M.t - M.b)
  const tickLabel = (v: number): string => (hi >= 10000 ? compact.format(v) : full.format(v))
  const sameDay = dayLabel(t0) === dayLabel(t1)
  const xLabel = (t: number): string => (sameDay ? timeFmt.format(t) : dayLabel(t))
  const showEndLabel = xLabel(t0) !== xLabel(t1)

  // Bir mağazanın bir çekimdeki fiyatı: o çekimdeki okuması, yoksa daha önceki son okuması.
  const valueAt = (points: Point[], run: number): { p: Point; earlier: boolean } | undefined => {
    const inRun = points.find((p) => p.t >= run && p.t - run <= SAME_RUN_MS)
    if (inRun) return { p: inRun, earlier: false }
    let found: Point | undefined
    for (const p of points) if (p.t < run) found = p
    return found ? { p: found, earlier: true } : undefined
  }

  const onMove = (e: PointerEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < runs.length; i++) if (Math.abs(x(runs[i]) - px) < Math.abs(x(runs[best]) - px)) best = i
    setHover(best)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? runs.length) - 1))
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(runs.length - 1, (h ?? -1) + 1))
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const run = hover !== null ? runs[hover] : null
  const hx = run !== null ? x(run) : 0
  const summary = series
    .map((s) => {
      const last = s.points[s.points.length - 1]
      return `${storeName(s.id)}: ${s.points.length} okuma, son ${formatTl(last.v)}`
    })
    .join('; ')

  return (
    <div className="price-chart">
      <div
        className="price-chart__plot"
        tabIndex={0}
        role="group"
        aria-label={`Fiyat geçmişi. ${summary}. Çekimler arasında sol ve sağ ok tuşlarıyla gezinilir.`}
        onKeyDown={onKey}
        onFocus={() => setHover((h) => h ?? runs.length - 1)}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="price-chart__grid" />
              <text x={M.l - 6} y={y(v)} className="price-chart__tick" textAnchor="end" dominantBaseline="middle">
                {tickLabel(v)}
              </text>
            </g>
          ))}
          <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="price-chart__axis" />
          <text x={M.l} y={H - 6} className="price-chart__tick" textAnchor="start">
            {xLabel(t0)}
          </text>
          {showEndLabel && (
            <text x={W - M.r} y={H - 6} className="price-chart__tick" textAnchor="end">
              {xLabel(t1)}
            </text>
          )}
          {run !== null && <line x1={hx} x2={hx} y1={M.t} y2={H - M.b} className="price-chart__crosshair" />}
          {series.map((s) => {
            const last = s.points[s.points.length - 1]
            const at = run !== null ? valueAt(s.points, run) : undefined
            return (
              <g key={s.id}>
                {s.points.length > 1 && (
                  <path
                    d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke={seriesColor(s.id)}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                <circle cx={x(last.t)} cy={y(last.v)} r={4} fill={seriesColor(s.id)} className="price-chart__dot" />
                {at && !at.earlier && (
                  <circle cx={x(at.p.t)} cy={y(at.p.v)} r={4} fill={seriesColor(s.id)} className="price-chart__dot" />
                )}
              </g>
            )
          })}
        </svg>
        {run !== null && (
          // Bilgi kutusu dikey çizginin öbür tarafında, grafiğin içinde kalır.
          <div className={`price-chart__tooltip price-chart__tooltip--${hx > W / 2 ? 'left' : 'right'}`} role="status">
            <span className="price-chart__when">{formatFullDateTime(new Date(run).toISOString())} çekimi</span>
            {series.map((s) => {
              const at = valueAt(s.points, run)
              if (!at) return null
              return (
                <span key={s.id} className="price-chart__row">
                  <span className="price-chart__key" style={{ background: seriesColor(s.id) }} aria-hidden="true" />
                  <span className="price-chart__value">{formatTl(at.p.v)}</span>
                  <span className="muted">
                    {storeName(s.id)}
                    {at.p.inStock === false ? ' · stokta yok' : ''}
                    {at.earlier ? ` · ${formatDateTime(new Date(at.p.t).toISOString())} okuması` : ''}
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
      <details className="price-chart__table">
        <summary>Okumaları tablo olarak göster</summary>
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">Zaman</th>
              <th scope="col">Mağaza</th>
              <th scope="col">Fiyat</th>
            </tr>
          </thead>
          <tbody>
            {[...history]
              .filter((o) => o.price !== null)
              .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))
              .map((o, i) => (
                <tr key={`${o.storeId}-${o.fetchedAt}-${i}`}>
                  <td>{formatFullDateTime(o.fetchedAt)}</td>
                  <td>{storeName(o.storeId)}</td>
                  <td>
                    {formatTl(o.price as number)} <span className="muted small">{stockText(o.inStock)}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
