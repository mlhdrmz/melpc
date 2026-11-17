import type { CatalogLoadError, CategoryId, Part } from '../engines/catalog/types'

// Ana süreç ile arayüz arasındaki sözleşme. Arayüz veriye yalnızca preload'un açtığı bu API ile erişir.

/** Kaydedilen toplamada her kategori için seçilen parçanın id'si. Depolama birden fazla olabilir. */
export type BuildSelection = Partial<Record<Exclude<CategoryId, 'storage'>, string>> & { storage: string[] }

export interface SavedBuild {
  id: number
  name: string
  selection: BuildSelection
  createdAt: string
  updatedAt: string
}

export interface SaveBuildInput {
  /** Varsa mevcut toplama güncellenir. */
  id?: number
  name: string
  selection: BuildSelection
}

export interface CatalogPayload {
  parts: Part[]
  /** Kataloğa alınamayan kayıtlar ve nedenleri. */
  errors: CatalogLoadError[]
}

export interface MelpcApi {
  getCatalog(): Promise<CatalogPayload>
  listBuilds(): Promise<SavedBuild[]>
  saveBuild(input: SaveBuildInput): Promise<SavedBuild>
  deleteBuild(id: number): Promise<void>
}

export const IPC = {
  getCatalog: 'catalog:get',
  listBuilds: 'builds:list',
  saveBuild: 'builds:save',
  deleteBuild: 'builds:delete'
} as const
