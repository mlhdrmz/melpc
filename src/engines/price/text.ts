// Mağaza sayfalarındaki adlarla katalog adlarını karşılaştırmak için metin yardımcıları.

const TR_MAP: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' }

/** Küçük harf, Türkçe harfler sadeleşmiş, yalnızca harf-rakam ve tek boşluk. */
export function normalizeText(s: string): string {
  return s
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokens(s: string): string[] {
  const n = normalizeText(s)
  return n ? n.split(' ') : []
}

/** Üretici kodu karşılaştırması için: büyük harf, yalnızca harf ve rakam ("CP-9020270-NA" → "CP9020270NA"). */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Katalogdaki üretici kodu ile mağazanın gösterdiği kod aynı mı?
 * Mağaza kodun sonuna bölge/sürüm eki koyabilir ("WDS200T2X0E" ↔ "WDS200T2X0E-00BCA0"); bu yüzden
 * en az 8 karakterlik bir kodun öbürünün başı olması da eşleşme sayılır.
 */
export function codesMatch(catalogCode: string, pageCode: string): boolean {
  const a = normalizeCode(catalogCode)
  const b = normalizeCode(pageCode)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 8 && long.startsWith(short)
}

/** "29.256,56" / "29256.56" / "29,256.56" → 29256.56. Okunamazsa undefined. */
export function parsePrice(raw: string | number | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : undefined
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return undefined
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // Türkçe biçim: nokta binlik, virgül ondalık
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma && lastComma !== -1) {
    // İngilizce biçim: virgül binlik
    s = s.replace(/,/g, '')
  } else if (lastDot !== -1 && lastComma === -1) {
    // Yalnızca nokta: ondalık mı binlik mi? Noktadan sonra tam 3 rakam ve birden fazla nokta → binlik
    const parts = s.split('.')
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join('')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
