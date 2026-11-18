import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { PriceState } from '@shared/api'
import type { StoreId } from '@engines/price/types'
import { buildPriceIndex, type PriceIndex } from '@engines/price/view'

// Fiyat durumu bütün ekranlarda tek yerden gelir: ana süreçteki her değişiklik (okunan fiyat, iş ilerlemesi)
// buraya gelir ve fiyat gösteren her bileşen buradan okur.

interface PriceContextValue {
  /** Henüz yüklenmediyse null. */
  state: PriceState | null
  index: PriceIndex
  /** Fiyatların yaşını hesaplamak için "şimdi"; dakikada bir yenilenir. */
  now: number
  storeName: (id: StoreId) => string
  /** Kısa bildirim gösterir. */
  notify: (message: string) => void
}

const EMPTY_INDEX = buildPriceIndex({ matches: [], latest: [], lastPriced: [], storeCount: 3 }, 0)
const PriceContext = createContext<PriceContextValue | null>(null)

export function PriceProvider({ children, notify }: { children: ReactNode; notify: (message: string) => void }): ReactElement {
  const [state, setState] = useState<PriceState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const gotEvent = useRef(false)
  const seenResult = useRef<{ init: boolean; at: string | null }>({ init: false, at: null })

  useEffect(() => {
    let alive = true
    const off = window.melpc.onPriceState((s) => {
      gotEvent.current = true
      setState(s)
    })
    window.melpc
      .getPriceState()
      .then((s) => {
        // Bu arada ana süreçten daha yeni bir durum geldiyse eskisiyle ezilmez.
        if (alive && !gotEvent.current) setState(s)
      })
      .catch(() => undefined)
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      alive = false
      off()
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!state) return
    setNow(Date.now())
    // Biten güncelleme ya da eşleştirme işinin sonucu bir kez bildirilir; ekran açılırken var olan eski sonuç bildirilmez.
    const r = state.lastResult
    const at = r?.finishedAt ?? null
    if (seenResult.current.init && r && at !== seenResult.current.at && r.kind !== 'link') {
      notify(`${r.kind === 'update' ? 'Fiyat güncellemesi bitti' : 'Mağaza araması bitti'}: ${r.summary}`)
    }
    seenResult.current = { init: true, at }
  }, [state, notify])

  const index = useMemo(
    () =>
      state
        ? buildPriceIndex(
            { matches: state.matches, latest: state.latest, lastPriced: state.lastPriced, storeCount: state.stores.length },
            now
          )
        : EMPTY_INDEX,
    [state, now]
  )
  const names = useMemo(() => new Map(state?.stores.map((s) => [s.id, s.name]) ?? []), [state])
  const storeName = useCallback((id: StoreId) => names.get(id) ?? id, [names])
  const value = useMemo(() => ({ state, index, now, storeName, notify }), [state, index, now, storeName, notify])
  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>
}

export function usePrices(): PriceContextValue {
  const v = useContext(PriceContext)
  if (!v) throw new Error('usePrices, PriceProvider içinde kullanılmalı')
  return v
}
