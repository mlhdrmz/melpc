import type { Part } from '../catalog/types'
import { codesMatch, normalizeCode, normalizeText, tokens } from './text'
import type { CodeCheck, ParsedProduct } from './types'

// Mağazanın site haritasındaki ürün linklerinden, bir katalog parçasına en çok benzeyenleri bulur.
// Bu yalnızca "aday" üretir; eşleşme Melih onaylamadan kaydedilmez.
//
// Bir linkin aday sayılması için:
// - Marka linkte geçmeli (ya da linkte üretici kodu olmalı).
// - Modelin rakam içeren kelimeleri ("9800x3d", "b850", "2tb") linkte aynen geçmeli: "b850m", "245kf",
//   "5070 ti" gibi başka ürünler elenir. Birim bitişik yazılabilir ("6000mhz").
// - Modelin öbür kelimelerinden en fazla biri eksik olabilir. Parantez içindekiler ("(ATX 3.1, 2024)") zorunlu değil.
// - Bellek kitinde modül düzeni ("2x16") linktekiyle çelişmemeli.
// Puan, marka ve model kelimelerinin eşleşme oranıdır; linkte üretici kodu varsa artar, hazır sistem, paket
// ya da farklı sürüm kelimeleri varsa düşer.

/** Hazır sistem / bilgisayar sayfalarını ayırmak için kelimeler. */
const SYSTEM_WORDS = [
  'sistem', 'tavsiyesi', 'masaustu', 'bilgisayar', 'laptop', 'notebook', 'freedos', 'oyuncu pc', 'gaming pc', 'paket', 'bir arada'
]

/** Parçanın adında yoksa ama linkte varsa farklı bir sürümü gösteren kelimeler. */
const VARIANT_WORDS = [
  'pro', 'plus', 'max', 'mini', 'white', 'wh', 'tray', 'mpk', 'argb', 'rgb', 'digital', 'se', 'lcd', 'elite',
  'v2', 'v3', 'gaming', 'oc', 'snow', 'evo', 'neo', 'icue', 'heatsink', 'ddr4', 'shift', 'btf'
]

/** Farklı bir yonga anlamına gelen kelimeler (ör. 5070 ile 5070 Ti): bunlarla aday gösterilmez. */
const CHIP_WORDS = ['ti', 'super', 'xt', 'xtx', 'x3d']

/** Parçanın adında varsa linkte de olması gereken sürüm kelimeleri (Kraken Plus ≠ Kraken Core, 990 Evo Plus ≠ 990 Evo). */
const MODEL_VARIANT_WORDS = ['pro', 'plus', 'max', 'mini', 'elite', 'evo', 'se', 'ti', 'super', 'xt', 'xtx']

/** Mağaza linklerinde aynı şeyi anlatan kelimeler. */
const SYNONYMS: Record<string, string> = { beyaz: 'white', sogutuculu: 'heatsink', d4: 'ddr4', d5: 'ddr5' }

/** Mağazaların markayı farklı yazdığı durumlar. */
const BRAND_ALIASES: Record<string, string[]> = { teamgroup: ['team'], sandisk: ['wd'] }

/** Sayıya bitişik yazılabilen birimler ("6000mhz", "2tb", "750w"). */
const UNITS = ['mhz', 'ghz', 'gb', 'tb', 'mb', 'w', 'mm', 'b', 'hz']

export interface Candidate {
  url: string
  score: number
}

/** Parçanın aramada kullanılan kelimeleri. */
export interface PartTokens {
  brand: string[]
  /** Modelin zorunlu kelimeleri (parantez dışında, en az 2 karakter). */
  model: string[]
  /** Rakam içeren zorunlu kelimeler: linkte aynen geçmeli. */
  keys: string[]
  /** Puana az katkı veren, zorunlu olmayan kelimeler (parantez içi, tek rakam, anakartın bellek tipi). */
  optional: string[]
  /** Sürüm cezası almayan kelimeler: parçanın adında ya da özelliklerinde olanlar. */
  own: Set<string>
  /** Bellek kitinin modül düzeni, ör. "2x16". */
  layout?: string
  /** Linkte aranacak üretici kodu (yalnızca harf-rakam, küçük harf). */
  code?: string
}

interface Slug {
  words: string[]
  squash: string
  text: string
}

const uniq = (xs: string[]): string[] => [...new Set(xs)]

/** "1 TB" → "1TB", "X870E-E" → "X870EE": birimi ve tek harflik model sonekini sayıya bitiştirir. */
function prepareName(s: string): string {
  return s.replace(/(\d)\s+(tb|gb|mb|w)\b/gi, '$1$2').replace(/([A-Za-z0-9]*\d[A-Za-z0-9]*)-([A-Za-z])\b/g, '$1$2')
}

export function partTokens(part: Part): PartTokens {
  const name = prepareName(part.model)
  const outside = tokens(name.replace(/\([^)]*\)/g, ' '))
  const inside = tokens((name.match(/\(([^)]*)\)/g) ?? []).join(' '))
  const brand = uniq(tokens(part.brand)).filter((t) => t.length > 1)
  const model = uniq(outside.filter((t) => t.length > 1 && !brand.includes(t)))
  const keys = model.filter((t) => /\d/.test(t))
  const extra: string[] = []
  // Anakartın bellek tipi linkte geçebilir ("ddr4"); DDR5 kartta "ddr4" geçen link başka bir sürümdür.
  const memoryType = part.category === 'motherboard' ? part.specs?.memoryType?.value : undefined
  if (typeof memoryType === 'string') extra.push(normalizeText(memoryType))
  const optional = uniq([
    ...outside.filter((t) => t.length === 1 && /\d/.test(t)),
    ...inside.filter((t) => t.length > 1 || /\d/.test(t)),
    ...extra
  ]).filter((t) => !model.includes(t) && !brand.includes(t))
  const layout = part.category === 'memory' ? /(\d+)x(\d+)/.exec(normalizeText(name)) : null
  const code = part.mpn ? normalizeCode(part.mpn).toLowerCase() : ''
  return {
    brand,
    model,
    keys,
    optional,
    own: new Set([...brand, ...outside, ...inside, ...extra]),
    ...(layout ? { layout: `${layout[1]}x${layout[2]}` } : {}),
    ...(code.length >= 5 ? { code } : {})
  }
}

function lastSegment(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
  } catch {
    return url
  }
}

const slugCache = new Map<string, Slug>()

function slugOf(url: string): Slug {
  const hit = slugCache.get(url)
  if (hit) return hit
  const words: string[] = []
  for (const raw of normalizeText(lastSegment(url).replace(/[_-]/g, ' ')).split(' ')) {
    if (!raw) continue
    const w = SYNONYMS[raw] ?? raw
    // "8400mhz-oc" bellek hız aşırtmasıdır, ürünün OC sürümü değil.
    if (w === 'oc' && words.length && /\dmhz$/.test(words[words.length - 1])) continue
    words.push(w)
  }
  // "mini-itx" kart boyutudur, "mini" sürümü değil.
  for (let i = words.length - 2; i >= 0; i--) if (words[i] === 'mini' && words[i + 1] === 'itx') words.splice(i, 1)
  // "gaming kasa" genel bir tanımdır, ürünün "Gaming" sürümü değil.
  for (let i = words.length - 2; i >= 0; i--) if (words[i] === 'gaming' && /^kasa/.test(words[i + 1])) words.splice(i, 1)
  const slug = { words, squash: words.join(''), text: words.join(' ') }
  if (slugCache.size > 100_000) slugCache.clear()
  slugCache.set(url, slug)
  return slug
}

/** Yonga kodu gibi ("b650", "x870e") kelimeler: linkte arkalarından tek harf gelirse ("b650-e") başka bir modeldir. */
const CHIP_CODE = /^[a-z]+\d+[a-z]*$/

/** Rakam içeren kelime linkte aynen var mı ("b850" ≠ "b850m"; "6000" = "6000mhz"; "x870ee" = "x870e e"). */
function hasKey(t: string, words: string[], own: Set<string>): boolean {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === t) {
      const next = words[i + 1]
      const letterSuffix = next !== undefined && /^[a-z]$/.test(next) && !(next === 'm' && words[i + 2] === '2')
      if (!(CHIP_CODE.test(t) && letterSuffix && !own.has(next))) return true
      continue
    }
    if (w.startsWith(t)) {
      const rest = w.slice(t.length)
      if (UNITS.includes(rest)) return true
      // "32gb2x16gb": kapasiteye bitişik modül düzeni
      if (/^\d/.test(rest) && UNITS.some((u) => t.endsWith(u))) return true
    }
    // "rtx5070": harflerle başlayan bitişik yazım
    if (/^\d/.test(t) && w.endsWith(t) && /^[a-z]+$/.test(w.slice(0, -t.length))) return true
    // Ayrı yazılmış: "x870e e" → "x870ee", "1 tb" → "1tb"
    let joined = w
    for (let j = i + 1; j < Math.min(words.length, i + 3) && joined.length < t.length; j++) {
      joined += words[j]
      if (joined === t) return true
    }
  }
  return false
}

function hasWord(t: string, slug: Slug, own: Set<string>): boolean {
  if (/\d/.test(t)) return hasKey(t, slug.words, own)
  return slug.words.includes(t) || (t.length >= 4 && slug.squash.includes(t))
}

/** Bellek kitinin modül düzeni linktekiyle uyuşuyor mu ("2x16" ararken "1x32gb" ya da "single kit" olmaz). */
function layoutOk(layout: string, slug: Slug): boolean {
  const m = /(\d)x(\d{1,3})gb/.exec(slug.squash)
  if (m) return `${m[1]}x${m[2]}` === layout
  const count = Number(layout.split('x')[0])
  if (count > 1 && slug.words.includes('single')) return false
  if (count === 1 && (slug.words.includes('dual') || slug.words.includes('quad'))) return false
  return true
}

/** Parçanın kendi adında olan sürüm kelimesi ceza almaz ("9800x3d" içindeki "x3d" de sayılır). */
function isOwn(v: string, own: Set<string>): boolean {
  if (own.has(v)) return true
  for (const t of own) if (/\d/.test(t) && t.endsWith(v)) return true
  return false
}

function scoreSlug(p: PartTokens, slug: Slug): number | null {
  const has = (t: string): boolean => hasWord(t, slug, p.own)
  const codeInSlug = Boolean(p.code && slug.squash.includes(p.code))
  if (!codeInSlug) {
    const brandOk = p.brand.some(has) || p.brand.some((b) => (BRAND_ALIASES[b] ?? []).some((a) => slug.words.includes(a)))
    if (!brandOk) return null
    if (!p.keys.every(has)) return null
    const missing = p.model.filter((t) => !has(t)).length
    if (missing > (p.model.length >= 3 ? 1 : 0)) return null
    if (p.model.some((t) => MODEL_VARIANT_WORDS.includes(t) && !slug.words.includes(t))) return null
  }
  if (p.layout && !layoutOk(p.layout, slug)) return null
  const required = [...p.brand, ...p.model]
  let score = required.filter(has).length / Math.max(1, required.length)
  if (p.optional.length) score += (0.2 * p.optional.filter(has).length) / p.optional.length
  if (codeInSlug) score += 1
  if (SYSTEM_WORDS.some((w) => slug.text.includes(w))) score -= 1.5
  const inSlug = new Set(slug.words)
  for (const v of VARIANT_WORDS) if (inSlug.has(v) && !isOwn(v, p.own)) score -= 0.4
  for (const v of CHIP_WORDS) if (inSlug.has(v) && !isOwn(v, p.own)) score -= 1
  return score
}

/** Bir linkin bir parçaya ne kadar benzediği. Aday olamıyorsa null. */
export function scoreUrl(part: Part, url: string): number | null {
  return scoreSlug(partTokens(part), slugOf(url))
}

/** En iyi adaylar (en fazla `limit` tane), puana göre azalan, eşitlikte kısa link önce. */
export function findCandidates(part: Part, urls: Iterable<string>, limit = 3): Candidate[] {
  const p = partTokens(part)
  const out: Candidate[] = []
  for (const url of urls) {
    const score = scoreSlug(p, slugOf(url))
    if (score !== null && score > 0.5) out.push({ url, score })
  }
  return out.sort((a, b) => b.score - a.score || a.url.length - b.url.length).slice(0, limit)
}

/** Aday sayfadaki üretici kodu katalogdakiyle aynı mı. */
export function checkCode(part: Part, product: ParsedProduct): CodeCheck {
  if (!part.mpn || !product.mpn) return 'missing'
  return codesMatch(part.mpn, product.mpn) ? 'match' : 'mismatch'
}
