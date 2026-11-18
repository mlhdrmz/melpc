import type { Part } from '../../engines/catalog/types'
import { checkCode, findCandidates } from '../../engines/price/match'
import { canRunNow, nextAllowedAt, shouldAutoRun } from '../../engines/price/schedule'
import { normalizeStoreUrl, storeForUrl, STORES, type StoreConfig } from '../../engines/price/stores'
import { STORE_IDS, type CodeCheck, type OfferRecord, type ParsedProduct, type StoreId, type StoreMatch } from '../../engines/price/types'
import type { ActionResult, MatchDecision, PriceJob, PriceState, ReadySystemResult } from '../../shared/api'
import type { MelpcDb } from '../db'
import { BlockedError, StoreFetcher } from './fetcher'
import { productUrls } from './sitemaps'

// Fiyat servisi: mağaza eşleştirme ve fiyat güncelleme işlerini yürütür.
// - Aynı anda tek iş çalışır; mağazalar paralel, bir mağazanın içindeki istekler sırayla gider.
// - Güncelleme yalnızca Melih'in onayladığı linklerden yapılır.
// - Okunamayan fiyat tahmin edilmez: okuma hatasıyla birlikte "fiyat yok" diye kaydedilir.

/** Bir parça için bir mağazada en fazla kaç aday sayfa okunur. */
const MAX_CANDIDATE_PAGES = 3
const CODE_RANK: Record<CodeCheck, number> = { match: 0, missing: 1, mismatch: 2 }
const BUSY = 'Şu an başka bir fiyat işi sürüyor; bitince tekrar deneyin.'
const CHECK_TEXT: Record<CodeCheck, string> = {
  match: 'Sayfa okundu; üretici kodu katalogla aynı.',
  missing: 'Sayfa okundu; sayfada ya da katalogda üretici kodu yok, ürün adına bakarak onaylayın.',
  mismatch: 'Dikkat: sayfadaki üretici kodu katalogdakiyle aynı değil.'
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export interface PriceServiceOptions {
  db: MelpcDb
  /** Katalogdaki parçalar. */
  parts: () => Part[]
  /** Site haritası önbelleğinin klasörü. */
  cacheDir: string
  makeFetcher?: (store: StoreConfig) => StoreFetcher
  now?: () => number
  onChange?: (state: PriceState) => void
}

interface Target {
  part: Part
  store: StoreConfig
  url: string
}

/** Ürün sayfasından okunanı fiyat kaydına çevirir. Fiyat yoksa ya da TL değilse fiyat boş kalır. */
export function offerFromProduct(
  partId: string,
  storeId: StoreId,
  url: string,
  p: ParsedProduct,
  fetchedAt: string
): OfferRecord {
  const base = { partId, storeId, url, fetchedAt }
  if (p.price === undefined) return { ...base, price: null, inStock: p.inStock ?? null, error: 'Sayfada fiyat okunamadı' }
  if (p.currency && !/^(TRY|TL)$/i.test(p.currency)) {
    return { ...base, price: null, inStock: null, error: `Fiyat TL değil (${p.currency})` }
  }
  return { ...base, price: p.price, inStock: p.inStock ?? null }
}

/** Sayfa bir ürün sayfası mı (yapılandırılmış veride en azından ad ya da fiyat var). */
function looksLikeProduct(p: ParsedProduct): boolean {
  return Boolean(p.name) || p.price !== undefined
}

export class PriceService {
  private readonly fetchers = new Map<StoreId, StoreFetcher>()
  private job: PriceJob | null = null
  private readonly active = new Map<StoreId, string>()
  private running: Promise<void> | null = null
  private cancelRequested = false
  private lastResult: PriceState['lastResult'] = null

  constructor(private readonly o: PriceServiceOptions) {}

  private get db(): MelpcDb {
    return this.o.db
  }

  private now(): number {
    return (this.o.now ?? Date.now)()
  }

  private iso(): string {
    return new Date(this.now()).toISOString()
  }

  private fetcher(store: StoreConfig): StoreFetcher {
    let f = this.fetchers.get(store.id)
    if (!f) {
      f = this.o.makeFetcher ? this.o.makeFetcher(store) : new StoreFetcher(store)
      this.fetchers.set(store.id, f)
    }
    return f
  }

  state(): PriceState {
    const now = this.now()
    const runs = this.db.listRuns('update')
    const starts = runs.map((r) => r.startedAt)
    const can = canRunNow(starts, now)
    return {
      stores: STORE_IDS.map((id) => ({ id, name: STORES[id].name, homepage: STORES[id].homepage })),
      matches: this.db.listMatches(),
      latest: this.db.latestOffers(),
      lastPriced: this.db.latestPricedOffers(),
      lastUpdate: runs.find((r) => r.finishedAt) ?? null,
      lastResult: this.lastResult,
      canUpdateNow: can,
      nextUpdateAt: can ? null : new Date(nextAllowedAt(starts, now)).toISOString(),
      job: this.job && { ...this.job, notes: [...this.job.notes] }
    }
  }

  history(partId: string): OfferRecord[] {
    return this.db.offerHistory(partId)
  }

  /** Süren iş bitince çözülür. */
  whenIdle(): Promise<void> {
    return this.running ?? Promise.resolve()
  }

  /** Süren işi durdurur; o an okunan sayfa bitince durur. */
  cancel(): void {
    if (!this.job || this.cancelRequested) return
    this.cancelRequested = true
    this.note('Durduruluyor; okunan sayfa bitince duracak.')
  }

  // ---------- Fiyat güncelleme ----------

  /**
   * auto: uygulama açıkken düzenli çağrılır; son güncellemeden 12 saat geçmediyse bir şey yapmaz.
   * manual: "Şimdi güncelle". İkisi birlikte 24 saatte en fazla 2 kez.
   */
  update(kind: 'auto' | 'manual'): ActionResult {
    if (this.job) return kind === 'manual' ? { ok: false, message: BUSY } : { ok: true }
    const now = this.now()
    const starts = this.db.listRuns('update').map((r) => r.startedAt)
    if (kind === 'auto' && !shouldAutoRun(starts, now)) return { ok: true }
    if (kind === 'manual' && !canRunNow(starts, now)) {
      return {
        ok: false,
        message: `Mağazaları yormamak için 24 saatte en fazla 2 güncelleme yapılıyor. Bir sonraki: ${dateFmt.format(nextAllowedAt(starts, now))}.`
      }
    }
    const targets = this.confirmedTargets()
    if (!targets.length) {
      return kind === 'manual'
        ? { ok: false, message: 'Henüz onaylanmış mağaza eşleşmesi yok. Önce "Mağaza eşleştirme" ekranında ürünleri eşleştirin.' }
        : { ok: true }
    }
    this.startJob('update', targets.length, () => this.runUpdate(targets))
    return { ok: true }
  }

  private confirmedTargets(): Target[] {
    const parts = new Map(this.o.parts().map((p) => [p.id, p]))
    const out: Target[] = []
    for (const m of this.db.listMatches()) {
      const part = parts.get(m.partId)
      if (m.status === 'confirmed' && m.url && part) out.push({ part, store: STORES[m.storeId], url: m.url })
    }
    return out
  }

  private async runUpdate(targets: Target[]): Promise<string> {
    const runId = this.db.startRun('update', this.job!.startedAt)
    let reached = 0
    const lines = await Promise.all(
      STORE_IDS.map(async (storeId) => {
        const items = targets.filter((t) => t.store.id === storeId)
        if (!items.length) return null
        const store = STORES[storeId]
        const f = this.fetcher(store)
        let read = 0
        let failed = 0
        for (let i = 0; i < items.length; i++) {
          if (this.cancelRequested) break
          const t = items[i]
          this.progress(storeId, `${store.name} · ${t.part.brand} ${t.part.model}`)
          try {
            const offer = offerFromProduct(t.part.id, storeId, t.url, store.parse(await f.get(t.url)), this.iso())
            this.db.addOffer(offer)
            if (offer.price === null) failed++
            else read++
          } catch (e) {
            if (e instanceof BlockedError) {
              this.note(e.message)
              this.step(items.length - i)
              break
            }
            const error = (e as Error).message
            this.db.addOffer({ partId: t.part.id, storeId, url: t.url, price: null, inStock: null, fetchedAt: this.iso(), error })
            failed++
          }
          this.db.persist()
          this.step(1)
        }
        this.idle(storeId)
        if (f.responses > 0) reached++
        return `${store.name}: ${read} fiyat okundu${failed ? `, ${failed} okunamadı` : ''}`
      })
    )
    if (reached === 0) {
      // Hiçbir mağazaya ulaşılamadı (ör. internet yok): bu deneme günlük sınırdan düşülmez.
      this.db.deleteRun(runId)
      return 'Hiçbir mağazaya ulaşılamadı; fiyatlar güncellenmedi.'
    }
    const summary = lines.filter(Boolean).join(' · ')
    this.db.finishRun(runId, this.iso(), summary)
    return summary
  }

  // ---------- Eşleştirme ----------

  /**
   * Verilen parçalar için (verilmezse bütün katalog) mağazalarda aday arar. Onaylı ya da onay bekleyen
   * eşleşmelere dokunmaz; reddedilmiş ve bulunamamış olanları yeniden arar.
   */
  findMatches(partIds?: string[]): ActionResult {
    if (this.job) return { ok: false, message: BUSY }
    const wanted = partIds ? new Set(partIds) : null
    const parts = this.o.parts().filter((p) => !wanted || wanted.has(p.id))
    const existing = new Map(this.db.listMatches().map((m) => [`${m.partId}|${m.storeId}`, m]))
    const work: { part: Part; storeId: StoreId }[] = []
    for (const storeId of STORE_IDS) {
      for (const part of parts) {
        const m = existing.get(`${part.id}|${storeId}`)
        if (!m || m.status === 'rejected' || m.status === 'notFound') work.push({ part, storeId })
      }
    }
    if (!work.length) return { ok: true, message: 'Aranacak parça yok: hepsi eşleştirilmiş ya da onay bekliyor.' }
    this.startJob('match', work.length, () => this.runMatch(work))
    return { ok: true }
  }

  private async runMatch(work: { part: Part; storeId: StoreId }[]): Promise<string> {
    const lines = await Promise.all(
      STORE_IDS.map(async (storeId) => {
        const items = work.filter((w) => w.storeId === storeId).map((w) => w.part)
        if (!items.length) return null
        const store = STORES[storeId]
        const f = this.fetcher(store)
        let urls: string[]
        try {
          this.progress(storeId, `${store.name} · ürün listesi (site haritası)`)
          urls = await productUrls(f, this.o.cacheDir, this.now())
        } catch (e) {
          this.note(e instanceof BlockedError ? e.message : `${store.name}: ürün listesi okunamadı (${(e as Error).message})`)
          this.step(items.length)
          this.idle(storeId)
          return `${store.name}: aranamadı`
        }
        let found = 0
        let notFound = 0
        let unread = 0
        for (let i = 0; i < items.length; i++) {
          if (this.cancelRequested) break
          const part = items[i]
          this.progress(storeId, `${store.name} · ${part.brand} ${part.model}`)
          const rejected = new Set(this.db.rejectedUrls(part.id, storeId))
          const candidates = findCandidates(
            part,
            urls.filter((u) => !rejected.has(u)),
            MAX_CANDIDATE_PAGES
          )
          if (!candidates.length) {
            this.db.upsertMatch({ partId: part.id, storeId, status: 'notFound', updatedAt: this.iso() })
            notFound++
            this.step(1)
            continue
          }
          let best: Awaited<ReturnType<PriceService['bestCandidate']>>
          try {
            best = await this.bestCandidate(part, store, f, candidates.map((c) => c.url))
          } catch (e) {
            if (!(e instanceof BlockedError)) throw e
            this.note(e.message)
            this.step(items.length - i)
            break
          }
          if (best) {
            this.db.upsertMatch({
              partId: part.id,
              storeId,
              status: 'candidate',
              url: best.url,
              product: best.product,
              codeCheck: best.check,
              updatedAt: this.iso()
            })
            found++
          } else {
            unread++
          }
          this.step(1)
        }
        this.idle(storeId)
        return `${store.name}: ${found} aday bulundu${notFound ? `, ${notFound} parça bulunamadı` : ''}${unread ? `, ${unread} parçanın aday sayfası okunamadı` : ''}`
      })
    )
    return lines.filter(Boolean).join(' · ')
  }

  /** Aday sayfaları sırayla okur; üretici kodu tutan ilk sayfada durur. Yoksa en iyisini (kod yok > kod farklı) verir. */
  private async bestCandidate(
    part: Part,
    store: StoreConfig,
    f: StoreFetcher,
    urls: string[]
  ): Promise<{ url: string; product: ParsedProduct; check: CodeCheck } | null> {
    let best: { url: string; product: ParsedProduct; check: CodeCheck } | null = null
    for (const url of urls) {
      let product: ParsedProduct
      try {
        product = store.parse(await f.get(url))
      } catch (e) {
        if (e instanceof BlockedError) throw e
        continue
      }
      if (!looksLikeProduct(product)) continue
      const check = checkCode(part, product)
      if (!best || CODE_RANK[check] < CODE_RANK[best.check]) best = { url, product, check }
      if (check === 'match') break
    }
    return best
  }

  decide(partId: string, storeId: StoreId, decision: MatchDecision): ActionResult {
    const m = this.db.listMatches().find((x) => x.partId === partId && x.storeId === storeId)
    if (!m || !m.url || (m.status !== 'candidate' && m.status !== 'confirmed')) {
      return { ok: false, message: 'Bu parça için bu mağazada bir eşleşme yok.' }
    }
    if (decision === 'confirm') {
      if (m.status !== 'candidate') return { ok: false, message: 'Bu eşleşme zaten onaylı.' }
      this.confirm(m)
    } else {
      // "Bu ürün değil": link bir daha önerilmez. Onaylı eşleşme reddedilirse o linkin fiyatları da gösterilmez.
      this.db.addRejected(partId, storeId, m.url, this.iso())
      this.db.upsertMatch({ partId, storeId, status: 'rejected', updatedAt: this.iso() }, false)
    }
    this.db.persist()
    this.emit()
    return { ok: true }
  }

  /** "Kodu tutanları onayla": üretici kodu katalogla aynı olan bütün adaylar. */
  confirmCodeMatches(): ActionResult {
    const list = this.db.listMatches().filter((m) => m.status === 'candidate' && m.codeCheck === 'match' && m.url)
    for (const m of list) this.confirm(m)
    this.db.persist()
    this.emit()
    return {
      ok: true,
      message: list.length ? `${list.length} eşleşme onaylandı.` : 'Üretici kodu tutan, onay bekleyen aday yok.'
    }
  }

  private confirm(m: StoreMatch): void {
    this.db.upsertMatch({ ...m, status: 'confirmed', updatedAt: this.iso() }, false)
    // Aday sayfası okunduğunda görülen fiyat, okunduğu zamanla ilk fiyat kaydı olur.
    if (m.product && m.url) this.db.addOffer(offerFromProduct(m.partId, m.storeId, m.url, m.product, m.updatedAt))
  }

  /** Elle girilen ürün linki: sayfa okunur ve onay için aday olarak kaydedilir. */
  async setUrl(partId: string, storeId: StoreId, raw: string): Promise<ActionResult> {
    if (this.job) return { ok: false, message: BUSY }
    const part = this.o.parts().find((p) => p.id === partId)
    const store = STORES[storeId]
    if (!part || !store) return { ok: false, message: 'Parça ya da mağaza bulunamadı.' }
    const url = normalizeStoreUrl(raw, store)
    if (!url) return { ok: false, message: `Bu link bir ${store.name} ürün sayfası değil. Ürünün sayfasındaki linki yapıştırın.` }
    let result: ActionResult = { ok: false, message: 'Sayfa okunamadı.' }
    this.startJob('link', 1, async () => {
      this.progress(storeId, `${store.name} · ${part.brand} ${part.model}`)
      try {
        const product = store.parse(await this.fetcher(store).get(url))
        if (!looksLikeProduct(product)) {
          result = { ok: false, message: 'Sayfada ürün bilgisi bulunamadı.' }
        } else {
          const check = checkCode(part, product)
          this.db.removeRejected(partId, storeId, url)
          this.db.upsertMatch({ partId, storeId, status: 'candidate', url, product, codeCheck: check, updatedAt: this.iso() })
          result = { ok: true, message: CHECK_TEXT[check] }
        }
      } catch (e) {
        result = { ok: false, message: (e as Error).message }
      }
      this.idle(storeId)
      this.step(1)
      return result.message ?? ''
    })
    await this.whenIdle()
    return result
  }

  // ---------- Hazır sistem ----------

  /**
   * Hazır sistem linki (Melih onayladı, 4. aşama): sayfa bir kez, mağazanın okuma kuyruğundan (robots.txt ve
   * bekleme süreleriyle) okunur. Sistemin adı, fiyatı ve parça listesi döner; hiçbir şey kaydedilmez.
   */
  async readSystem(raw: string): Promise<ReadySystemResult> {
    if (this.job) return { ok: false, message: BUSY }
    const text = raw.trim()
    const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
    const store = storeForUrl(withScheme)
    if (!store) return { ok: false, message: 'Bu link bir İtopya ya da Gaming.gen.tr linki değil.' }
    const reader = store.readySystem
    if (!reader) {
      return { ok: false, message: `${store.name} hazır sistemleri okunmuyor; İtopya ya da Gaming.gen.tr linki yapıştırın.` }
    }
    const url = normalizeStoreUrl(withScheme, store, reader.isUrl)
    if (!url) return { ok: false, message: `Bu link bir ${store.name} hazır sistem sayfası değil. Sistemin kendi sayfasının linkini yapıştırın.` }
    let result: ReadySystemResult = { ok: false, message: 'Sayfa okunamadı.' }
    this.startJob('system', 1, async () => {
      this.progress(store.id, `${store.name} · hazır sistem`)
      try {
        const parsed = reader.parse(await this.fetcher(store).get(url))
        result = parsed.lines.length
          ? { ok: true, system: { ...parsed, storeId: store.id, url, fetchedAt: this.iso() } }
          : { ok: false, message: 'Bu sayfada sistemin parça listesi bulunamadı. Hazır sistemin kendi sayfasının linkini yapıştırın.' }
      } catch (e) {
        result = { ok: false, message: (e as Error).message }
      }
      this.idle(store.id)
      this.step(1)
      return result.ok ? `${store.name}: hazır sistem okundu` : result.message
    })
    await this.whenIdle()
    return result
  }

  // ---------- İş takibi ----------

  private startJob(kind: PriceJob['kind'], total: number, work: () => Promise<string>): void {
    this.cancelRequested = false
    for (const f of this.fetchers.values()) f.resetForJob()
    this.active.clear()
    this.job = { kind, startedAt: this.iso(), done: 0, total, notes: [] }
    this.emit()
    this.running = work()
      .catch((e: unknown) => `Beklenmeyen hata: ${(e as Error).message}`)
      .then((summary) => {
        const parts = [summary, ...(this.job?.notes ?? []).filter((n) => !n.startsWith('Durduruluyor'))]
        if (this.cancelRequested) parts.push('Durduruldu.')
        this.lastResult = { kind, finishedAt: this.iso(), summary: parts.filter(Boolean).join(' · ') }
        this.job = null
        this.running = null
        this.active.clear()
        this.emit()
      })
  }

  private progress(storeId: StoreId, label: string): void {
    if (!this.job) return
    this.active.set(storeId, label)
    this.job.current = [...this.active.values()].join('  |  ')
    this.emit()
  }

  /** Mağazanın bu işteki sırası bitti. */
  private idle(storeId: StoreId): void {
    this.active.delete(storeId)
    if (this.job) this.job.current = [...this.active.values()].join('  |  ') || undefined
  }

  private step(n: number): void {
    if (!this.job) return
    this.job.done = Math.min(this.job.total, this.job.done + n)
    this.emit()
  }

  private note(message: string): void {
    if (!this.job || this.job.notes.includes(message)) return
    this.job.notes.push(message)
    this.emit()
  }

  private emit(): void {
    this.o.onChange?.(this.state())
  }
}
