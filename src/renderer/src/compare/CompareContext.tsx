import { createContext, useCallback, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { CATEGORY_IDS, type CategoryId } from '@engines/catalog/types'
import type { ReadySystem } from '@engines/price/readySystem'

// Karşılaştırma listesi: kategori başına en fazla 4 parça, en fazla 3 kayıtlı toplama.
// Son okunan hazır sistem de burada durur: başka ekrana geçip dönünce yeniden okumak gerekmesin.

export const MAX_PARTS = 4
export const MAX_BUILDS = 3

interface CompareContextValue {
  parts: Record<CategoryId, string[]>
  builds: number[]
  togglePart: (category: CategoryId, partId: string) => 'added' | 'removed' | 'full'
  toggleBuild: (id: number) => 'added' | 'removed' | 'full'
  count: number
  /** Son okunan hazır sistem (uygulama kapanınca kaybolur). */
  ready: ReadySystem | null
  setReady: (system: ReadySystem | null) => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

const emptyParts = (): Record<CategoryId, string[]> =>
  Object.fromEntries(CATEGORY_IDS.map((c) => [c, [] as string[]])) as Record<CategoryId, string[]>

export function CompareProvider({ children }: { children: ReactNode }): ReactElement {
  const [parts, setParts] = useState<Record<CategoryId, string[]>>(emptyParts)
  const [builds, setBuilds] = useState<number[]>([])
  const [ready, setReady] = useState<ReadySystem | null>(null)

  const togglePart = useCallback(
    (category: CategoryId, partId: string): 'added' | 'removed' | 'full' => {
      const list = parts[category]
      if (list.includes(partId)) {
        setParts((p) => ({ ...p, [category]: p[category].filter((id) => id !== partId) }))
        return 'removed'
      }
      if (list.length >= MAX_PARTS) return 'full'
      setParts((p) => ({ ...p, [category]: [...p[category], partId] }))
      return 'added'
    },
    [parts]
  )

  const toggleBuild = useCallback(
    (id: number): 'added' | 'removed' | 'full' => {
      if (builds.includes(id)) {
        setBuilds((b) => b.filter((x) => x !== id))
        return 'removed'
      }
      if (builds.length >= MAX_BUILDS) return 'full'
      setBuilds((b) => [...b, id])
      return 'added'
    },
    [builds]
  )

  const count = Object.values(parts).reduce((n, l) => n + l.length, 0) + builds.length
  const value = useMemo(
    () => ({ parts, builds, togglePart, toggleBuild, count, ready, setReady }),
    [parts, builds, togglePart, toggleBuild, count, ready]
  )
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareContextValue {
  const v = useContext(CompareContext)
  if (!v) throw new Error('useCompare, CompareProvider içinde kullanılmalı')
  return v
}
