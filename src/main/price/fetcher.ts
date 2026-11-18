import { isAllowed, parseRobots, type RobotsRule } from '../../engines/price/robots'
import type { StoreConfig } from '../../engines/price/stores'

// Mağazaları yormayan istek kuyruğu:
// - Bir mağazaya istekler sırayla gider, aralarında mağazanın bekleme süresi kadar beklenir.
// - robots.txt'nin yasakladığı adrese istek yapılmaz.
// - Mağaza erişimi sınırlarsa (403, 429, 503, Cloudflare 1015) o işte o mağazaya başka istek yapılmaz; tekrar denenmez.
// Kendini tanıtan bir User-Agent kullanılır; kişisel bilgi gönderilmez.

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MelPC/0.3 (kisisel fiyat takibi)'
const TIMEOUT_MS = 30000
/** robots.txt bu süreden eskiyse yeni işte yeniden okunur. */
const ROBOTS_MAX_AGE_MS = 6 * 60 * 60 * 1000

/** Mağazaya bu işte istek yapılamaz (erişim sınırı ya da mağazaya ulaşılamıyor). */
export class BlockedError extends Error {}
/** Tek bir sayfa okunamadı (bulunamadı, zaman aşımı, robots.txt yasağı...). */
export class FetchError extends Error {}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<{
  status: number
  ok: boolean
  text: () => Promise<string>
}>

export class StoreFetcher {
  private lastRequestAt: number | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private robots: RobotsRule[] | null = null
  private robotsAt = 0
  /** Mağaza erişimi sınırladıysa ya da ulaşılamıyorsa nedeni. */
  blocked: string | null = null
  /** Bu işte mağazadan gelen yanıt sayısı (hiç yanıt yoksa mağazaya ulaşılamamıştır). */
  responses = 0

  constructor(
    readonly store: StoreConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly now: () => number = Date.now
  ) {}

  /** Yeni bir iş (güncelleme, eşleştirme) başlarken: önceki işin engeli kalkar, eski robots.txt yeniden okunur. */
  resetForJob(): void {
    this.blocked = null
    this.responses = 0
    if (this.now() - this.robotsAt > ROBOTS_MAX_AGE_MS) this.robots = null
  }

  /** Sayfayı kuyruğa ekler; sırası gelince okur. */
  get(url: string): Promise<string> {
    const run = async (): Promise<string> => {
      if (this.blocked) throw new BlockedError(this.blocked)
      let u: URL
      try {
        u = new URL(url)
      } catch {
        throw new FetchError('Geçersiz adres')
      }
      if (u.host !== new URL(this.store.homepage).host) throw new FetchError(`Bu adres ${this.store.name} sitesinde değil`)
      if (!this.robots) {
        this.robots = await this.loadRobots()
        this.robotsAt = this.now()
      }
      if (!isAllowed(this.robots, u.pathname + u.search)) throw new FetchError('Mağazanın robots.txt dosyası bu sayfayı yasaklıyor')
      return this.request(url)
    }
    const p = this.chain.then(run, run)
    this.chain = p.catch(() => undefined)
    return p
  }

  private async request(url: string): Promise<string> {
    if (this.lastRequestAt !== null) {
      const wait = this.lastRequestAt + this.store.delayMs - this.now()
      if (wait > 0) await this.sleep(wait)
    }
    this.lastRequestAt = this.now()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await this.fetchImpl(url, {
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'tr-TR,tr;q=0.9',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: ctrl.signal
      })
      this.responses++
      const body = await res.text()
      if ([403, 429, 503].includes(res.status) || /error code:\s*10(15|20)/i.test(body.slice(0, 300))) {
        this.blocked = `${this.store.name} erişimi sınırladı (HTTP ${res.status}); bu işte bu mağaza atlandı`
        throw new BlockedError(this.blocked)
      }
      if (res.status === 404 || res.status === 410) throw new FetchError('Sayfa bulunamadı; ürün mağazadan kaldırılmış olabilir')
      if (!res.ok) throw new FetchError(`Mağaza HTTP ${res.status} döndürdü`)
      return body
    } catch (e) {
      if (e instanceof BlockedError || e instanceof FetchError) throw e
      const err = e as Error
      throw new FetchError(err.name === 'AbortError' ? 'Zaman aşımı' : `Bağlantı hatası: ${err.message}`)
    } finally {
      clearTimeout(timer)
    }
  }

  private async loadRobots(): Promise<RobotsRule[]> {
    try {
      return parseRobots(await this.request(this.store.robotsUrl))
    } catch (e) {
      // robots.txt yoksa (404) her şey serbesttir. Başka bir hatada kurallar bilinemez: güvenli tarafta kalınıp
      // bu işte mağazaya istek yapılmaz.
      if (e instanceof FetchError && /bulunamadı/.test(e.message)) return []
      if (e instanceof BlockedError) throw e
      this.blocked = `${this.store.name} sitesine ulaşılamadı (${(e as Error).message}); bu işte bu mağaza atlandı`
      throw new BlockedError(this.blocked)
    }
  }
}
