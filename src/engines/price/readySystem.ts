import type { CategoryId, Part } from '../catalog/types'
import { productFromJsonLd } from './jsonld'
import { scoreText, TEXT_MATCH_MIN, urlWords } from './match'
import { codesMatch, looksLikeCode, normalizeCode, normalizeText } from './text'
import type { Totals } from './totals'
import type { CodeCheck, StoreId } from './types'

// Hazır sistem karşılaştırması (Melih onayladı, 4. aşama): Melih İtopya ya da Gaming.gen.tr'deki hazır bir
// sistemin linkini yapıştırır; sayfa bir kez okunur, otomatik tarama yoktur. Sistemin adı, fiyatı ve parça listesi
// çıkarılır, parçalar katalogla eşleştirilir. Katalogda tanınmayan parçalar ve parça olmayan kalemler (montaj,
// kasa fanı, işletim sistemi...) ayrıca gösterilir; bunların fiyatı tahmin edilmez.

/** Hazır sistemin parça listesindeki bir satır. */
export interface ReadySystemLine {
  /** Mağazanın bileşen adı ("Ekran Kartı", "GÜÇ KAYNAĞI"). */
  label: string
  /** Katalogdaki kategori. Katalogda olmayan bir tür ya da parça olmayan bir kalemse yok. */
  category?: CategoryId
  /** Mağazanın yazdığı ürün adı. */
  name: string
  /** Mağazanın gösterdiği ürün kodu (kod gibi görünüyorsa). */
  code?: string
  /** Ürünün mağazadaki sayfası (varsa). */
  url?: string
}

/** Sayfadan okunanlar. */
export interface ParsedSystem {
  name?: string
  /** KDV dahil fiyat (TL). Okunamazsa ya da TL değilse yok. */
  price?: number
  /** true = stokta, false = stokta değil, yok = sayfada bilgi yok. */
  inStock?: boolean
  lines: ReadySystemLine[]
}

export interface ReadySystem extends ParsedSystem {
  storeId: StoreId
  /** Okunan sayfa. */
  url: string
  /** Okunduğu zaman (ISO). */
  fetchedAt: string
}

// ---------- Bileşen türü ----------

/** Mağazanın bileşen adından katalog kategorisi. Sıra önemli: "İşlemci Soğutucu" soğutucudur, "Kasa Fanı" kasa değildir. */
const LABEL_RULES: [RegExp, CategoryId | null][] = [
  [/fan|tutucu|kablo|aparat|macun|adaptor|aksesuar|montaj|hizmet|isletim/, null],
  [/sogutucu|sogutma/, 'cooler'],
  [/islemci/, 'cpu'],
  [/anakart/, 'motherboard'],
  [/ekran karti/, 'gpu'],
  [/\bram\b|bellek/, 'memory'],
  [/\bssd\b|\bhdd\b|sabit disk|harddisk|depolama/, 'storage'],
  [/guc kayna[gk]|\bpsu\b/, 'psu'],
  [/kasa/, 'case']
]

export function categoryFromLabel(label: string): CategoryId | undefined {
  const t = normalizeText(label)
  for (const [re, category] of LABEL_RULES) if (re.test(t)) return category ?? undefined
  return undefined
}

// ---------- HTML yardımcıları ----------

const NAMED_ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Etiketleri atar, karakter kodlarını çözer, boşlukları sadeleştirir. */
function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)
  const v = m ? cleanText(m[1]) : ''
  return v || undefined
}

/** Kod gibi görünen ama ölçü olan değerler ("1x16GB", "650W") ve harfsiz sayılar kod sayılmaz. */
export function isLikelyCode(s: string): boolean {
  const t = s.trim()
  return (
    looksLikeCode(t) &&
    /[a-z]/i.test(t) &&
    !/^\d+\s*x\s*\d+/i.test(t) &&
    !/^\d+([.,]\d+)?(gb|tb|mb|mhz|ghz|w|mm|cm|hz)$/i.test(t)
  )
}

/** Ürün adının sonlarındaki parantez içindeki kod: "... DDR5 Ram (GR165600U46RGB) - 2 Yıl Garanti" → "GR165600U46RGB". */
function codeInName(name: string): string | undefined {
  const groups = [...name.matchAll(/\(([^()]+)\)/g)].map((m) => m[1].trim()).reverse()
  return groups.find(isLikelyCode)
}

/** Mağazanın kendi alan adındaki link (göreli linkler çözülür); başka bir yere giden link alınmaz. */
function storeLink(href: string | undefined, homepage: string): string | undefined {
  if (!href) return undefined
  try {
    const u = new URL(decodeEntities(href), homepage)
    return u.protocol === 'https:' && u.host === new URL(homepage).host ? u.toString() : undefined
  } catch {
    return undefined
  }
}

function makeLine(label: string, name: string, code: string | undefined, url: string | undefined): ReadySystemLine {
  const category = categoryFromLabel(label)
  return {
    label,
    name,
    ...(category ? { category } : {}),
    ...(code && isLikelyCode(code) ? { code: code.trim() } : {}),
    ...(url ? { url } : {})
  }
}

/** Sistemin adı, fiyatı ve stok durumu sayfanın yapılandırılmış verisinden (schema.org Product). */
function systemInfo(html: string): Omit<ParsedSystem, 'lines'> {
  const p = productFromJsonLd(html)
  const tl = !p?.currency || /^(TRY|TL)$/i.test(p.currency)
  return {
    ...(p?.name ? { name: cleanText(p.name) } : {}),
    ...(p?.price !== undefined && tl ? { price: p.price } : {}),
    ...(p?.inStock !== undefined ? { inStock: p.inStock } : {})
  }
}

// ---------- Mağazalar ----------

/**
 * İtopya: sayfada her bileşenin bütün seçenekleri ürün kartı olarak durur; sistemin kendi parçaları "active"
 * işaretli kartlardır. Kartta bileşen adı (data-kategori-adi), ürün kodu (data-stok-kodu), ürün adı (h3) ve
 * ürün sayfasının linki ("Ürüne Git") vardır. Çevre birimleri (monitör, klavye...) isteğe bağlı eklerdir;
 * sistemde seçili değillerse "active" kartları olmaz.
 */
export function parseItopyaSystem(html: string, homepage: string): ParsedSystem {
  const lines: ReadySystemLine[] = []
  const cards = [...html.matchAll(/<div\b[^>]*\sdata-kategori-adi\s*=\s*"[^"]*"[^>]*>/gi)]
  cards.forEach((card, i) => {
    const tag = card[0]
    if (!/(^|\s)active(\s|$)/.test(attr(tag, 'class') ?? '')) return
    const start = (card.index ?? 0) + tag.length
    const body = html.slice(start, cards[i + 1]?.index ?? start + 20_000)
    const label = attr(tag, 'data-kategori-adi')
    const name = cleanText(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(body)?.[1] ?? '')
    if (!label || !name) return
    const href = /<a\b[^>]*\shref\s*=\s*"([^"]*_u\d+)"/i.exec(body)?.[1]
    lines.push(makeLine(label, name, attr(tag, 'data-stok-kodu'), storeLink(href, homepage)))
  })
  return { ...systemInfo(html), lines }
}

/**
 * Gaming.gen.tr: sayfadaki "sistem parçaları" tablosunda her satır bir bileşen (beta-parts-component-link) ve
 * seçili ürünüdür (beta-parts-model-link). Montaj, kablolama gibi hizmetler de bu tabloda satır olarak durur.
 */
export function parseGamingSystem(html: string, homepage: string): ParsedSystem {
  const lines: ReadySystemLine[] = []
  const first = html.indexOf('beta-parts-component-link')
  if (first >= 0) {
    const start = html.lastIndexOf('<table', first)
    const end = html.indexOf('</table>', first)
    const table = html.slice(start >= 0 ? start : first, end >= 0 ? end : undefined)
    for (const row of table.split(/<tr[\s>]/i).slice(1)) {
      const label = cleanText(/class\s*=\s*"[^"]*\bbeta-parts-component-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(row)?.[1] ?? '')
      const model = /<a\b([^>]*class\s*=\s*"[^"]*\bbeta-parts-model-link\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/i.exec(row)
      const name = cleanText(model?.[2] ?? '')
      if (!label || !name) continue
      const href = /\shref\s*=\s*"([^"]+)"/i.exec(` ${model?.[1] ?? ''}`)?.[1]
      lines.push(makeLine(label, name, codeInName(name), storeLink(href, homepage)))
    }
  }
  return { ...systemInfo(html), lines }
}

// ---------- Katalogla eşleştirme ----------

export interface LineMatch {
  line: ReadySystemLine
  /** Katalogda tanınan parça. */
  partId?: string
  /** Neye göre tanındı: onaylı mağaza linki, üretici kodu ya da ürün adı. */
  by?: 'link' | 'code' | 'name'
  /** Mağazanın kodu ile katalogdaki kodun karşılaştırması (biri yoksa "missing"). */
  codeCheck?: CodeCheck
  /** Katalogdaki birden fazla parçaya aynı ölçüde benziyorsa onlar; bu durumda tanınmış sayılmaz. */
  ambiguous?: string[]
}

function codeCheckOf(part: Part, line: ReadySystemLine): CodeCheck {
  if (!part.mpn || !line.code) return 'missing'
  return codesMatch(part.mpn, line.code) ? 'match' : 'mismatch'
}

/**
 * Bir satırı katalogla eşleştirir.
 * - Satırın ürün linki Melih'in onayladığı bir mağaza eşleşmesinin linkiyse o parça (confirmedUrls: link → parça).
 * - Mağazanın kodu (ya da adın içinde geçen kod) katalogdaki üretici koduyla tutuyorsa o parça.
 * - Değilse ad karşılaştırması: modelin bütün kelimeleri geçmeli, sürüm farkı olmamalı (TEXT_MATCH_MIN).
 *   Ad tutup kod farklıysa parça tanınır ama "kod farklı" diye işaretlenir; Melih ekranda görür.
 */
export function matchSystemLine(
  line: ReadySystemLine,
  parts: Part[],
  confirmedUrls?: ReadonlyMap<string, string>
): LineMatch {
  if (!line.category) return { line }
  const pool = parts.filter((p) => p.category === line.category)
  const linkedId = line.url ? confirmedUrls?.get(line.url) : undefined
  const linked = linkedId ? pool.find((p) => p.id === linkedId) : undefined
  if (linked) return { line, partId: linked.id, by: 'link', codeCheck: codeCheckOf(linked, line) }

  const text = [line.name, line.url ? urlWords(line.url) : '', line.code ?? ''].join(' ')
  const squash = normalizeCode(text)
  const byCode = pool.filter((p) => {
    if (!p.mpn) return false
    const c = normalizeCode(p.mpn)
    return Boolean(line.code && codesMatch(p.mpn, line.code)) || (c.length >= 6 && squash.includes(c))
  })
  if (byCode.length === 1) return { line, partId: byCode[0].id, by: 'code', codeCheck: 'match' }

  const scored = pool
    .map((part) => ({ part, score: scoreText(part, text) }))
    .filter((x): x is { part: Part; score: number } => x.score !== null && x.score >= TEXT_MATCH_MIN)
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return { line }
  const top = scored.filter((x) => x.score === scored[0].score)
  if (top.length > 1) return { line, ambiguous: top.map((x) => x.part.id) }
  const part = top[0].part
  return { line, partId: part.id, by: 'name', codeCheck: codeCheckOf(part, line) }
}

export function matchSystemLines(
  lines: ReadySystemLine[],
  parts: Part[],
  confirmedUrls?: ReadonlyMap<string, string>
): LineMatch[] {
  return lines.map((l) => matchSystemLine(l, parts, confirmedUrls))
}

// ---------- "Kendin toplasan" karşılaştırması ----------

export interface ReadySummary {
  /** Katalogda kategorisi olan satırlar (parçalar), sayfadaki sırayla. */
  parts: LineMatch[]
  /** Katalogda karşılığı olmayan kalemler (montaj, kasa fanı...). */
  others: LineMatch[]
  /** Katalogda tanınan parçalar. */
  recognized: LineMatch[]
  /** Tanınan ve güncel, stokta fiyatı olan parça sayısı. */
  priced: number
  /** Bütün parçalar tanındı ve hepsinin fiyatı var: karşılaştırma tam. */
  complete: boolean
  /** Fiyatı olan tanınmış parçaların en ucuz mağazalardan toplamı; hiçbirinin fiyatı yoksa null. */
  selfBuild: number | null
  /** Tam karşılaştırmada aynı parçaların tek mağazadan en ucuz toplamı. */
  singleStore: Totals['singleStore']
  /** Tam karşılaştırmada sistem fiyatı − kendin toplasan (artı: hazır sistem daha pahalı). */
  difference: number | null
  /** Kısmi karşılaştırmada sistem fiyatı − fiyatı bilinen parçaların toplamı (geri kalan parçalara ve kalemlere düşen). */
  remainder: number | null
  /** Adına göre tanınıp mağazanın kodu katalogdakinden farklı çıkan parça sayısı. */
  codeMismatches: number
}

/**
 * Hazır sistemin fiyatını, tanınan parçaların fiyatlarıyla karşılaştırır. Fiyatı bilinmeyen parça tahmin edilmez:
 * bir parça tanınmadıysa ya da fiyatı yoksa fark hesaplanmaz, yalnızca fiyatı bilinenlerin toplamı ve kalan verilir.
 * totalsOf: fiyat motorunun toplam hesabı (yalnızca güncel ve stokta fiyatlar).
 */
export function summarizeReadySystem(
  price: number | undefined,
  matches: LineMatch[],
  totalsOf: (partIds: string[]) => Totals
): ReadySummary {
  const parts = matches.filter((m) => m.line.category)
  const others = matches.filter((m) => !m.line.category)
  const recognized = parts.filter((m) => m.partId)
  const totals = totalsOf(recognized.map((m) => m.partId as string))
  const priced = recognized.length - totals.missing.length
  const complete = parts.length > 0 && priced === parts.length
  return {
    parts,
    others,
    recognized,
    priced,
    complete,
    selfBuild: priced > 0 ? totals.cheapest : null,
    singleStore: complete ? totals.singleStore : null,
    difference: complete && price !== undefined ? price - totals.cheapest : null,
    remainder: !complete && price !== undefined && priced > 0 ? price - totals.cheapest : null,
    codeMismatches: recognized.filter((m) => m.by === 'name' && m.codeCheck === 'mismatch').length
  }
}
