import type { ReactElement } from 'react'
import type { Part } from '@engines/catalog/types'
import { partName } from '@engines/catalog/access'
import { formatTl, formatWhen, PRICE_NOTE } from './format'
import { usePrices } from './PriceContext'

/** Kasa Topla ekranında toplamın fiyatı: en ucuz kombinasyon ve tek mağazadan. */
export function PricePanel({ parts }: { parts: Part[] }): ReactElement {
  const { state, index, storeName, now } = usePrices()
  const last = state?.lastUpdate?.finishedAt

  const head = (
    <div className="panel__head">
      <span className="section-title">FİYAT</span>
      {last && <span className="muted small">Fiyatlar {formatWhen(last, now)}</span>}
    </div>
  )

  if (!parts.length) {
    return (
      <div className="panel">
        {head}
        <p className="muted small">Parça seçtikçe toplam burada görünür.</p>
      </div>
    )
  }

  const totals = index.totals(parts.map((p) => p.id))
  const missing = [...new Set(totals.missing)].map((id) => parts.find((p) => p.id === id) as Part)
  const priced = parts.length - totals.missing.length

  return (
    <div className="panel">
      {head}
      <div className="price-total">
        <span className="price-total__label">En ucuz kombinasyon</span>
        <span className="price-total__value">{priced ? formatTl(totals.cheapest) : '—'}</span>
        <span className="muted small">
          Her parça en ucuz olduğu mağazadan
          {totals.missing.length ? ` · ${parts.length} parçanın ${priced} tanesi` : ''}
        </span>
      </div>
      <div className="price-total price-total--secondary">
        <span className="price-total__label">Tek mağazadan</span>
        {totals.singleStore ? (
          <span className="price-total__value">
            {formatTl(totals.singleStore.total)} <span className="price-total__store">{storeName(totals.singleStore.storeId)}</span>
          </span>
        ) : (
          <span className="muted small">Bütün parçaların stokta ve güncel fiyatlı olduğu tek bir mağaza yok.</span>
        )}
      </div>
      {missing.length > 0 && (
        <p className="warn-text small">
          Güncel ve stokta fiyatı olmayan, toplama katılmayan parçalar: {missing.map((p) => partName(p)).join(', ')}
        </p>
      )}
      <p className="muted small">{PRICE_NOTE}</p>
    </div>
  )
}
