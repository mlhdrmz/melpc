import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSitemap } from '../../engines/price/stores'
import { FetchError, type StoreFetcher } from './fetcher'

// Mağazanın ürün linkleri site haritasından alınır ve bir hafta saklanır; böylece eşleştirme sırasında
// site haritası her seferinde yeniden indirilmez.

export const SITEMAP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface CacheFile {
  fetchedAt: string
  urls: string[]
}

function readCache(file: string): CacheFile | null {
  try {
    const c = JSON.parse(readFileSync(file, 'utf8')) as CacheFile
    return typeof c.fetchedAt === 'string' && Array.isArray(c.urls) ? c : null
  } catch {
    return null
  }
}

/** Mağazanın ürün sayfası linkleri. Önbellek bir haftadan eskiyse site haritası yeniden okunur. */
export async function productUrls(fetcher: StoreFetcher, cacheDir: string, now: number): Promise<string[]> {
  const file = join(cacheDir, `${fetcher.store.id}-urls.json`)
  const cached = readCache(file)
  if (cached && now - Date.parse(cached.fetchedAt) < SITEMAP_MAX_AGE_MS) return cached.urls
  try {
    const urls = await readSitemaps(fetcher)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(`${file}.tmp`, JSON.stringify({ fetchedAt: new Date(now).toISOString(), urls }))
    renameSync(`${file}.tmp`, file)
    return urls
  } catch (e) {
    // Yenisi okunamazsa eski liste kullanılır (ürün linkleri sık değişmez).
    if (cached) return cached.urls
    throw e
  }
}

async function readSitemaps(fetcher: StoreFetcher): Promise<string[]> {
  const store = fetcher.store
  const root = parseSitemap(await fetcher.get(store.sitemapUrl))
  const pages: string[] = []
  if (root.isIndex) {
    for (const child of root.urls.filter((u) => store.isProductSitemap(u))) {
      pages.push(...parseSitemap(await fetcher.get(child)).urls)
    }
  } else {
    pages.push(...root.urls)
  }
  const urls = [...new Set(pages.filter((u) => store.isProductUrl(u)))]
  if (!urls.length) throw new FetchError('Site haritasında ürün linki bulunamadı')
  return urls
}
