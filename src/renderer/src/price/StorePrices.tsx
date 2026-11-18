import { useEffect, useState, type ReactElement } from 'react'
import type { Part } from '@engines/catalog/types'
import type { OfferRecord } from '@engines/price/types'
import { formatDateTime, formatTl, formatWhen, matchStatusText, PRICE_NOTE, seriesColor, stockText } from './format'
import { usePrices } from './PriceContext'
import { PriceHistoryChart } from './PriceHistoryChart'

/** Parça ayrıntısında mağaza fiyatları: her mağazada son fiyat, stok, okunma zamanı, link ve fiyat geçmişi. */
export function StorePrices({ part }: { part: Part }): ReactElement {
  const { state, index, storeName, now } = usePrices()
  const [history, setHistory] = useState<OfferRecord[]>([])
  const pp = index.get(part.id)
  const refreshKey = `${state?.lastUpdate?.finishedAt ?? ''}|${pp.stores.map((s) => `${s.storeId}${s.pricedAt}`).join(',')}`

  useEffect(() => {
    let alive = true
    window.melpc
      .getPriceHistory(part.id)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]))
    return () => {
      alive = false
    }
  }, [part.id, refreshKey])

  if (!state) return <span className="details__price">Fiyatlar yükleniyor…</span>
  const storeIds = state.stores.map((s) => s.id)

  return (
    <section className="store-prices" aria-label="Mağaza fiyatları">
      <span className="details__eyebrow">MAĞAZA FİYATLARI</span>
      <ul className="store-prices__list">
        {storeIds.map((storeId) => {
          const sp = pp.stores.find((s) => s.storeId === storeId)
          const match = state.matches.find((m) => m.partId === part.id && m.storeId === storeId)
          return (
            <li key={storeId} className="store-price">
              <span className="store-price__key" style={{ background: seriesColor(storeId) }} aria-hidden="true" />
              <span className="store-price__store">{storeName(storeId)}</span>
              {sp ? (
                <>
                  <span className="store-price__value">
                    {sp.price !== null ? formatTl(sp.price) : 'Fiyat okunamadı'}
                    {pp.best === sp && <span className="store-price__best">en ucuz</span>}
                  </span>
                  <span className="store-price__meta">
                    {stockText(sp.inStock)}
                    {sp.pricedAt ? ` · ${formatWhen(sp.pricedAt, now)} okundu` : ''}
                    {sp.stale && <span className="warn-text"> · güncel değil</span>}
                    {sp.price !== null && !sp.usable && <span> · toplama katılmıyor</span>}
                  </span>
                  {sp.error && (
                    <span className="store-price__error">
                      Son okuma ({sp.checkedAt ? formatDateTime(sp.checkedAt) : ''}) başarısız: {sp.error}
                    </span>
                  )}
                  <a className="store-price__link" href={sp.url} target="_blank" rel="noreferrer">
                    Mağazada aç
                  </a>
                </>
              ) : (
                <span className="store-price__meta">{matchStatusText(match)}</span>
              )}
            </li>
          )
        })}
      </ul>
      {pp.stores.length > 0 && (
        <div className="store-prices__history">
          <span className="details__eyebrow">FİYAT GEÇMİŞİ</span>
          <PriceHistoryChart history={history} storeIds={storeIds} storeName={storeName} />
        </div>
      )}
      <span className="store-prices__note">{PRICE_NOTE}</span>
    </section>
  )
}
