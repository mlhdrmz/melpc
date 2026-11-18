import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react'
import type { CatalogPayload } from '@shared/api'
import type { Part } from '@engines/catalog/types'

// Katalog ve performans ölçümleri bütün ekranlara buradan gelir.

interface CatalogContextValue {
  catalog: CatalogPayload
  byId: Map<string, Part>
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function CatalogProvider({ catalog, children }: { catalog: CatalogPayload; children: ReactNode }): ReactElement {
  const value = useMemo(() => ({ catalog, byId: new Map(catalog.parts.map((p) => [p.id, p])) }), [catalog])
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogContextValue {
  const v = useContext(CatalogContext)
  if (!v) throw new Error('useCatalog, CatalogProvider içinde kullanılmalı')
  return v
}
