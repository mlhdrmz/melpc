import { describe, expect, it } from 'vitest'
import { BlockedError, FetchError, StoreFetcher } from './fetcher'
import { STORES } from '../../engines/price/stores'

// Ağ yerine sahte yanıtlar: istek sırası, bekleme süreleri ve hata türleri denenir.

function fakeFetch(responses: Record<string, { status: number; body: string }>) {
  const calls: string[] = []
  const impl = async (url: string) => {
    calls.push(url)
    const r = responses[url] ?? { status: 404, body: '' }
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body }
  }
  return { impl, calls }
}

const store = { ...STORES.itopya, delayMs: 5000 }
const robots = { status: 200, body: 'User-agent: *\nDisallow: /Urun/\n' }

describe('mağaza istek kuyruğu', () => {
  it('robots.txt yasak adrese istek yapmaz', async () => {
    const { impl, calls } = fakeFetch({ 'https://www.itopya.com/robots.txt': robots })
    const f = new StoreFetcher(store, impl, async () => undefined)
    await expect(f.get('https://www.itopya.com/Urun/UrunOzellik')).rejects.toBeInstanceOf(FetchError)
    expect(calls).toEqual(['https://www.itopya.com/robots.txt'])
  })

  it('başka sitenin adresine istek yapmaz', async () => {
    const { impl, calls } = fakeFetch({})
    const f = new StoreFetcher(store, impl, async () => undefined)
    await expect(f.get('https://example.com/x')).rejects.toThrow('İtopya sitesinde değil')
    expect(calls).toEqual([])
  })

  it('istekler arasında mağazanın bekleme süresi kadar bekler', async () => {
    let clock = 0
    const waits: number[] = []
    const { impl } = fakeFetch({
      'https://www.itopya.com/robots.txt': robots,
      'https://www.itopya.com/a_u1': { status: 200, body: 'A' },
      'https://www.itopya.com/b_u2': { status: 200, body: 'B' }
    })
    const f = new StoreFetcher(store, impl, async (ms) => {
      waits.push(ms)
      clock += ms
    }, () => clock)
    expect(await Promise.all([f.get('https://www.itopya.com/a_u1'), f.get('https://www.itopya.com/b_u2')])).toEqual(['A', 'B'])
    // robots.txt → a → b: iki bekleme
    expect(waits).toEqual([5000, 5000])
  })

  it('hız sınırında (1015) mağazayı bırakır ve tekrar denemez', async () => {
    const { impl, calls } = fakeFetch({
      'https://www.itopya.com/robots.txt': robots,
      'https://www.itopya.com/a_u1': { status: 429, body: 'error code: 1015' }
    })
    const f = new StoreFetcher(store, impl, async () => undefined)
    await expect(f.get('https://www.itopya.com/a_u1')).rejects.toBeInstanceOf(BlockedError)
    await expect(f.get('https://www.itopya.com/b_u2')).rejects.toBeInstanceOf(BlockedError)
    expect(calls).toHaveLength(2)
    expect(f.blocked).toContain('HTTP 429')
  })

  it('robots.txt yoksa her yere izin var; sayfa yoksa anlaşılır hata', async () => {
    const { impl } = fakeFetch({})
    const f = new StoreFetcher(store, impl, async () => undefined)
    await expect(f.get('https://www.itopya.com/yok_u9')).rejects.toThrow('Sayfa bulunamadı')
  })

  it('mağazaya ulaşılamazsa (internet yok) o işte mağazayı bırakır; yeni işte tekrar dener', async () => {
    let online = false
    const calls: string[] = []
    const impl = async (url: string) => {
      calls.push(url)
      if (!online) throw new TypeError('fetch failed')
      return { status: 200, ok: true, text: async () => (url.endsWith('robots.txt') ? '' : 'A') }
    }
    const f = new StoreFetcher(store, impl, async () => undefined)
    await expect(f.get('https://www.itopya.com/a_u1')).rejects.toBeInstanceOf(BlockedError)
    await expect(f.get('https://www.itopya.com/b_u2')).rejects.toBeInstanceOf(BlockedError)
    expect(calls).toHaveLength(1)
    expect(f.responses).toBe(0)
    online = true
    f.resetForJob()
    expect(await f.get('https://www.itopya.com/a_u1')).toBe('A')
    expect(f.responses).toBe(2)
  })
})
