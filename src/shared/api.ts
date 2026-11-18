import type { CatalogLoadError, CategoryId, Part } from '../engines/catalog/types'
import type { OfferRecord, StoreId, StoreMatch } from '../engines/price/types'
import type { ReadySystem } from '../engines/price/readySystem'
import type { HardwareReading } from '../engines/hardware/types'
import type { BenchmarkResult, BenchmarkSource } from '../engines/benchmark/types'

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
  /** Kataloğa ya da ölçümlere alınamayan kayıtlar ve nedenleri. */
  errors: CatalogLoadError[]
  /** Performans ölçümleri (data/benchmarks). */
  benchmarks: { results: BenchmarkResult[]; sources: Record<string, BenchmarkSource> }
}

// ---------- Fiyat motoru ----------

export interface PriceRunInfo {
  startedAt: string
  finishedAt?: string
  summary?: string
}

/** Süren fiyat işi (güncelleme, eşleştirme, elle girilen link ya da hazır sistem sayfası). */
export interface PriceJob {
  kind: 'update' | 'match' | 'link' | 'system'
  startedAt: string
  done: number
  total: number
  /** Şu an okunan sayfa, ör. "İtopya · AMD Ryzen 7 9800X3D". */
  current?: string
  /** Ör. "Vatan Bilgisayar erişimi sınırladı". */
  notes: string[]
}

export interface PriceState {
  stores: { id: StoreId; name: string; homepage: string }[]
  matches: StoreMatch[]
  /** Onaylı eşleşmelerde her parça ve mağaza için son okuma (başarısız olmuş olabilir). */
  latest: OfferRecord[]
  /** Onaylı eşleşmelerde her parça ve mağaza için fiyatı okunabilmiş son okuma. */
  lastPriced: OfferRecord[]
  /** Son biten fiyat güncellemesi. */
  lastUpdate: PriceRunInfo | null
  /** Uygulama açıldığından beri biten son işin sonucu. */
  lastResult: { kind: PriceJob['kind']; finishedAt: string; summary: string } | null
  /** 24 saatte en fazla 2 güncelleme sınırına göre şimdi güncellenebilir mi. */
  canUpdateNow: boolean
  /** Sınır doluysa bir sonraki güncellemenin mümkün olacağı zaman. */
  nextUpdateAt: string | null
  job: PriceJob | null
}

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string }

export type MatchDecision = 'confirm' | 'reject'

export type ReadySystemResult = { ok: true; system: ReadySystem } | { ok: false; message: string }

export type HardwareResult = { ok: true; reading: HardwareReading } | { ok: false; message: string }

export interface MelpcApi {
  getCatalog(): Promise<CatalogPayload>
  listBuilds(): Promise<SavedBuild[]>
  saveBuild(input: SaveBuildInput): Promise<SavedBuild>
  deleteBuild(id: number): Promise<void>

  getPriceState(): Promise<PriceState>
  /** "Şimdi güncelle". İş arka planda sürer; ilerleme onPriceState ile gelir. */
  updatePrices(): Promise<ActionResult>
  /** Verilen parçalar (verilmezse eşleşmesi olmayan bütün parçalar) için mağazalarda aday arar. */
  findMatches(partIds?: string[]): Promise<ActionResult>
  decideMatch(partId: string, storeId: StoreId, decision: MatchDecision): Promise<ActionResult>
  /** Üretici kodu tutan bütün adayları onaylar. */
  confirmCodeMatches(): Promise<ActionResult>
  /** Elle girilen ürün linki: sayfa okunur ve onay için aday olarak gösterilir. */
  setMatchUrl(partId: string, storeId: StoreId, url: string): Promise<ActionResult>
  cancelPriceJob(): Promise<void>
  getPriceHistory(partId: string): Promise<OfferRecord[]>
  /** Hazır sistem linki (İtopya, Gaming.gen.tr): sayfa bir kez okunur; sistemin adı, fiyatı ve parça listesi döner. */
  readReadySystem(url: string): Promise<ReadySystemResult>

  /** Bilgisayarım: Windows'un donanım bilgisini okur ve son okuma olarak saklar. */
  readHardware(): Promise<HardwareResult>
  /** Saklanan son donanım okuması (yoksa null). */
  getLastHardware(): Promise<HardwareReading | null>
  /** Fiyat durumu değişince çağrılır. Dönen fonksiyon aboneliği bitirir. */
  onPriceState(listener: (state: PriceState) => void): () => void
}

export const IPC = {
  getCatalog: 'catalog:get',
  listBuilds: 'builds:list',
  saveBuild: 'builds:save',
  deleteBuild: 'builds:delete',
  priceState: 'price:state',
  priceUpdate: 'price:update',
  priceFindMatches: 'price:findMatches',
  priceDecide: 'price:decide',
  priceConfirmCodes: 'price:confirmCodes',
  priceSetUrl: 'price:setUrl',
  priceCancel: 'price:cancel',
  priceHistory: 'price:history',
  priceReadSystem: 'price:readSystem',
  hardwareRead: 'hardware:read',
  hardwareLast: 'hardware:last',
  /** Ana süreçten arayüze: fiyat durumu değişti. */
  priceChanged: 'price:changed'
} as const
