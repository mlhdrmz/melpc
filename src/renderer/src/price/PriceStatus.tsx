import { useState, type ReactElement } from 'react'
import type { PriceJob } from '@shared/api'
import { formatDateTime, formatWhen } from './format'
import { usePrices } from './PriceContext'

export const JOB_LABEL: Record<PriceJob['kind'], string> = {
  update: 'Fiyatlar güncelleniyor',
  match: 'Mağazalarda aranıyor',
  link: 'Link okunuyor',
  system: 'Hazır sistem okunuyor'
}

/** Üst bardaki fiyat durumu ve "Şimdi güncelle". */
export function PriceStatus(): ReactElement {
  const { state, now, notify } = usePrices()
  const [sending, setSending] = useState(false)

  if (!state) {
    return (
      <div className="header-status">
        <span className="status-dot" aria-hidden="true" />
        Fiyatlar yükleniyor…
      </div>
    )
  }

  const job = state.job
  const last = state.lastUpdate?.finishedAt
  const text = job
    ? `${JOB_LABEL[job.kind]} · ${job.done}/${job.total}`
    : last
      ? `Fiyatlar: ${formatWhen(last, now)}`
      : 'Fiyatlar: henüz çekilmedi'
  const limited = !state.canUpdateNow && state.nextUpdateAt

  const update = async (): Promise<void> => {
    setSending(true)
    try {
      const r = await window.melpc.updatePrices()
      notify(r.ok ? (r.message ?? 'Fiyat güncellemesi başladı.') : r.message)
    } catch (e) {
      notify(`Güncelleme başlatılamadı: ${(e as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="header-status" aria-live="polite">
      <span className={`status-dot${job ? ' status-dot--busy' : last ? ' status-dot--ok' : ''}`} aria-hidden="true" />
      <span title={!job && state.lastUpdate?.summary ? `Son güncelleme: ${state.lastUpdate.summary}` : undefined}>{text}</span>
      <button
        type="button"
        className="chip-button"
        disabled={Boolean(job) || Boolean(limited) || sending}
        title={
          limited
            ? `Mağazaları yormamak için 24 saatte en fazla 2 güncelleme yapılır. Bir sonraki: ${formatDateTime(state.nextUpdateAt as string)}`
            : 'Onaylı ürün linklerinden fiyatları şimdi okur'
        }
        onClick={() => void update()}
      >
        Şimdi güncelle
      </button>
      {limited && <span className="header-status__next">Sonraki: {formatDateTime(state.nextUpdateAt as string)}</span>}
    </div>
  )
}
