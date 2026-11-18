import type { Part } from '../catalog/types'
import { codesMatch, normalizeCode, normalizeText, tokens } from './text'
import type { CodeCheck, ParsedProduct } from './types'

// Mağazanın site haritasındaki ürün linklerinden, bir katalog parçasına en çok benzeyenleri bulur.
// Bu yalnızca "aday" üretir; eşleşme Melih onaylamadan kaydedilmez.

/** Hazır sistem / bilgisayar sayfalarını ayırmak için kelimeler. */
const SYSTEM_WORDS = ['sistem', 'tavsiyesi', 'masaustu', 'bilgisayar', 'laptop', 'notebook', 'freedos', 'oyuncu pc', 'gaming pc']

/** Parçanın adında yoksa ama linkte varsa farklı bir sürümü gösteren kelimeler. */
const VARIANT_WORDS = [
  'ti', 'super', 'xt', 'xtx', 'x3d', 'pro', 'plus', 'max', 'mini', 'white', 'beyaz', 'wh', 'tray', 'argb', 'rgb',
  'digital', 'se', 'lcd', 'elite', 'v2', 'v3', 'gaming', 'oc', 'snow', 'evo'
]

export interface Candidate {
  url: string
  score: number
}

function lastSegment(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
  } catch {
    return url
  }
}

/** Parçanın aramada kullanılan kelimeleri ve "anahtar" kelimeleri (rakam içerenler). */
export function partTokens(part: Part): { all: string[]; keys: string[] } {
  const all = [...new Set(tokens(`${part.brand} ${part.model}`))].filter((t) => t.length > 1 || /\d/.test(t))
  const keys = all.filter((t) => /\d/.test(t) && t.length >= 3)
  return { all, keys }
}

/** Bir linkin bir parçaya ne kadar benzediği. Anahtar kelimelerden biri bile yoksa null. */
export function scoreUrl(part: Part, url: string): number | null {
  const slugText = normalizeText(lastSegment(url).replace(/[_-]/g, ' '))
  const words = new Set(slugText.split(' '))
  const squash = slugText.replace(/ /g, '')
  const { all, keys } = partTokens(part)
  const has = (t: string): boolean => words.has(t) || ((/\d/.test(t) || t.length >= 4) && squash.includes(t))
  if (!keys.every(has)) return null
  let score = all.filter(has).length / Math.max(1, all.length)
  if (part.mpn && squash.includes(normalizeCode(part.mpn).toLowerCase())) score += 1
  if (part.category !== 'case' && SYSTEM_WORDS.some((w) => slugText.includes(w))) score -= 1.5
  const own = new Set(all)
  for (const v of VARIANT_WORDS) if (words.has(v) && !own.has(v)) score -= 0.4
  return score
}

/** En iyi adaylar (en fazla `limit` tane), puana göre azalan, eşitlikte kısa link önce. */
export function findCandidates(part: Part, urls: Iterable<string>, limit = 3): Candidate[] {
  const out: Candidate[] = []
  for (const url of urls) {
    const score = scoreUrl(part, url)
    if (score !== null && score > 0.5) out.push({ url, score })
  }
  return out.sort((a, b) => b.score - a.score || a.url.length - b.url.length).slice(0, limit)
}

/** Aday sayfadaki üretici kodu katalogdakiyle aynı mı. */
export function checkCode(part: Part, product: ParsedProduct): CodeCheck {
  if (!part.mpn || !product.mpn) return 'missing'
  return codesMatch(part.mpn, product.mpn) ? 'match' : 'mismatch'
}
