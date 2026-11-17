import { specConnectors, specList, specMounts, specNum, specStr } from '../catalog/access'
import { formatNumber, RADIATOR_POSITION_LABELS } from '../catalog/specDefs'
import type { CategoryId } from '../catalog/types'
import { estimatePower, POWER_ASSUMPTIONS } from './power'
import type { Build, CompatResult, CompatStatus, Rule } from './types'

// Uyumluluk kuralları. Her kural ilgili parçalar seçili değilse null döner.
// Gereken bir değer katalogda "bilinmiyor" ise sonuç "uyarı: kontrol edilemedi" olur, asla uyumlu sayılmaz.

const fmt = formatNumber
const mm = (n: number): string => `${fmt(n)} mm`
const w = (n: number): string => `${fmt(n)} W`

function result(
  ruleId: string,
  status: CompatStatus,
  title: string,
  message: string,
  categories: CategoryId[]
): CompatResult {
  return { ruleId, status, title, message, categories }
}

function unknownResult(ruleId: string, title: string, categories: CategoryId[], missing: string[]): CompatResult {
  return result(ruleId, 'warn', title, `Kontrol edilemedi: ${missing.join(', ')} bilinmiyor.`, categories)
}

/** Bilinmeyen değerlerin Türkçe adlarını toplar. */
function missingOf(pairs: [unknown, string][]): string[] {
  return pairs.filter(([v]) => v === undefined).map(([, name]) => name)
}

export const cpuSocketRule: Rule = (b) => {
  if (!b.cpu || !b.motherboard) return null
  const id = 'cpu-socket'
  const title = 'İşlemci soketi'
  const cats: CategoryId[] = ['cpu', 'motherboard']
  const cpu = specStr(b.cpu, 'socket')
  const board = specStr(b.motherboard, 'socket')
  const missing = missingOf([
    [cpu, 'işlemcinin soketi'],
    [board, 'anakartın soketi']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return cpu === board
    ? result(id, 'ok', title, `İşlemci ve anakart aynı sokette: ${cpu}.`, cats)
    : result(id, 'fail', title, `İşlemci ${cpu}, anakart ${board} soketli: işlemci bu anakarta takılmaz.`, cats)
}

export const memoryTypeRule: Rule = (b) => {
  if (!b.memory || !b.motherboard) return null
  const id = 'memory-type'
  const title = 'Bellek tipi'
  const cats: CategoryId[] = ['memory', 'motherboard']
  const ram = specStr(b.memory, 'memoryType')
  const board = specStr(b.motherboard, 'memoryType')
  const missing = missingOf([
    [ram, 'belleğin tipi'],
    [board, 'anakartın bellek tipi']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return ram === board
    ? result(id, 'ok', title, `Bellek ${ram}, anakart ${board} destekliyor.`, cats)
    : result(id, 'fail', title, `Bellek ${ram}, anakart yalnızca ${board} destekliyor: yuvaya takılmaz.`, cats)
}

export const cpuMemoryTypeRule: Rule = (b) => {
  if (!b.memory || !b.cpu) return null
  const id = 'cpu-memory-type'
  const title = 'İşlemcinin bellek desteği'
  const cats: CategoryId[] = ['cpu', 'memory']
  const ram = specStr(b.memory, 'memoryType')
  const supported = specList(b.cpu, 'memoryTypes')
  const missing = missingOf([
    [ram, 'belleğin tipi'],
    [supported, 'işlemcinin desteklediği bellek tipleri']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return supported!.includes(ram!)
    ? result(id, 'ok', title, `İşlemci ${ram} destekliyor.`, cats)
    : result(id, 'fail', title, `İşlemci yalnızca ${supported!.join(', ')} destekliyor, bellek ${ram}.`, cats)
}

export const memorySlotsRule: Rule = (b) => {
  if (!b.memory || !b.motherboard) return null
  const id = 'memory-slots'
  const title = 'Bellek yuvaları'
  const cats: CategoryId[] = ['memory', 'motherboard']
  const modules = specNum(b.memory, 'modules')
  const slots = specNum(b.motherboard, 'memorySlots')
  const missing = missingOf([
    [modules, 'belleğin modül sayısı'],
    [slots, 'anakartın bellek yuvası sayısı']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return modules! <= slots!
    ? result(id, 'ok', title, `${modules} modül, anakartta ${slots} yuva var.`, cats)
    : result(id, 'fail', title, `${modules} modül var ama anakartta yalnızca ${slots} yuva var.`, cats)
}

export const memoryCapacityRule: Rule = (b) => {
  if (!b.memory || !b.motherboard) return null
  const id = 'memory-capacity'
  const title = 'Bellek kapasitesi'
  const cats: CategoryId[] = ['memory', 'motherboard']
  const cap = specNum(b.memory, 'capacityGb')
  const max = specNum(b.motherboard, 'maxMemoryGb')
  const missing = missingOf([
    [cap, 'belleğin kapasitesi'],
    [max, 'anakartın en yüksek bellek desteği']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return cap! <= max!
    ? result(id, 'ok', title, `${fmt(cap!)} GB bellek, anakart en fazla ${fmt(max!)} GB destekliyor.`, cats)
    : result(id, 'fail', title, `${fmt(cap!)} GB bellek, anakartın sınırı ${fmt(max!)} GB.`, cats)
}

export const caseFormFactorRule: Rule = (b) => {
  if (!b.motherboard || !b.case) return null
  const id = 'case-form-factor'
  const title = 'Anakart boyutu ve kasa'
  const cats: CategoryId[] = ['motherboard', 'case']
  const ff = specStr(b.motherboard, 'formFactor')
  const support = specList(b.case, 'motherboardSupport')
  const missing = missingOf([
    [ff, 'anakartın form faktörü'],
    [support, 'kasanın desteklediği anakart boyutları']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return support!.includes(ff!)
    ? result(id, 'ok', title, `${ff} anakart bu kasaya takılır.`, cats)
    : result(id, 'fail', title, `Kasa ${support!.join(', ')} anakartları destekliyor; ${ff} anakart takılmaz.`, cats)
}

export const gpuLengthRule: Rule = (b) => {
  if (!b.gpu || !b.case) return null
  const id = 'gpu-length'
  const title = 'Ekran kartı uzunluğu'
  const cats: CategoryId[] = ['gpu', 'case']
  const len = specNum(b.gpu, 'lengthMm')
  const max = specNum(b.case, 'maxGpuLengthMm')
  const missing = missingOf([
    [len, 'ekran kartının uzunluğu'],
    [max, 'kasanın ekran kartı sınırı']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  const margin = max! - len!
  return margin >= 0
    ? result(id, 'ok', title, `Ekran kartı ${mm(len!)}, kasa sınırı ${mm(max!)}: ${mm(margin)} pay var.`, cats)
    : result(id, 'fail', title, `Ekran kartı ${mm(len!)}, kasa sınırı ${mm(max!)}: ${mm(-margin)} uzun, sığmaz.`, cats)
}

export const coolerSocketRule: Rule = (b) => {
  if (!b.cooler || !b.cpu) return null
  const id = 'cooler-socket'
  const title = 'Soğutucu soketi'
  const cats: CategoryId[] = ['cooler', 'cpu']
  const socket = specStr(b.cpu, 'socket')
  const sockets = specList(b.cooler, 'sockets')
  const missing = missingOf([
    [socket, 'işlemcinin soketi'],
    [sockets, 'soğutucunun desteklediği soketler']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return sockets!.includes(socket!)
    ? result(id, 'ok', title, `Soğutucu ${socket} soketini destekliyor.`, cats)
    : result(id, 'fail', title, `Soğutucu ${sockets!.join(', ')} soketlerini destekliyor; işlemci ${socket}.`, cats)
}

export const coolerFitRule: Rule = (b) => {
  if (!b.cooler || !b.case) return null
  const cats: CategoryId[] = ['cooler', 'case']
  const type = specStr(b.cooler, 'coolerType')
  if (type === undefined) return unknownResult('cooler-fit', 'Soğutucu ve kasa', cats, ['soğutucunun tipi'])

  if (type === 'air') {
    const id = 'cooler-height'
    const title = 'Soğutucu yüksekliği'
    const h = specNum(b.cooler, 'heightMm')
    const max = specNum(b.case, 'maxCoolerHeightMm')
    const missing = missingOf([
      [h, 'soğutucunun yüksekliği'],
      [max, 'kasanın soğutucu sınırı']
    ])
    if (missing.length) return unknownResult(id, title, cats, missing)
    const margin = max! - h!
    return margin >= 0
      ? result(id, 'ok', title, `Soğutucu ${mm(h!)}, kasa sınırı ${mm(max!)}: ${mm(margin)} pay var.`, cats)
      : result(id, 'fail', title, `Soğutucu ${mm(h!)}, kasa sınırı ${mm(max!)}: ${mm(-margin)} yüksek, kapak kapanmaz.`, cats)
  }

  const id = 'radiator-fit'
  const title = 'Radyatör yeri'
  const size = specNum(b.cooler, 'radiatorSizeMm')
  const mounts = specMounts(b.case, 'radiatorMounts')
  const missing = missingOf([
    [size, 'radyatörün boyu'],
    [mounts, 'kasanın radyatör yerleri']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  const fits = mounts!.filter((m) => m.sizesMm.includes(size!)).map((m) => RADIATOR_POSITION_LABELS[m.position])
  return fits.length
    ? result(id, 'ok', title, `${mm(size!)} radyatör kasaya takılabilir: ${fits.join(', ')}.`, cats)
    : result(id, 'fail', title, `Kasada ${mm(size!)} radyatör takılabilecek bir yer yok.`, cats)
}

function countStorage(b: Build): { m2: number; sata: number; unknown: number } {
  let m2 = 0
  let sata = 0
  let unknown = 0
  for (const d of b.storage) {
    const t = specStr(d, 'storageType')
    if (t === 'M.2 NVMe') m2++
    else if (t === 'SATA SSD' || t === 'SATA HDD') sata++
    else unknown++
  }
  return { m2, sata, unknown }
}

export const m2SlotsRule: Rule = (b) => {
  if (!b.motherboard) return null
  const { m2, unknown } = countStorage(b)
  if (m2 === 0 && unknown === 0) return null
  const id = 'm2-slots'
  const title = 'M.2 yuvaları'
  const cats: CategoryId[] = ['storage', 'motherboard']
  const slots = specNum(b.motherboard, 'm2Slots')
  const missing = missingOf([[slots, 'anakartın M.2 yuvası sayısı']])
  if (unknown) missing.push('bazı disklerin tipi')
  if (missing.length) return unknownResult(id, title, cats, missing)
  return m2 <= slots!
    ? result(id, 'ok', title, `${m2} M.2 disk, anakartta ${slots} M.2 yuvası var.`, cats)
    : result(id, 'fail', title, `${m2} M.2 disk var ama anakartta ${slots} M.2 yuvası var.`, cats)
}

export const sataPortsRule: Rule = (b) => {
  if (!b.motherboard) return null
  const { sata } = countStorage(b)
  if (sata === 0) return null
  const id = 'sata-ports'
  const title = 'SATA girişleri'
  const cats: CategoryId[] = ['storage', 'motherboard']
  const ports = specNum(b.motherboard, 'sataPorts')
  if (ports === undefined) return unknownResult(id, title, cats, ['anakartın SATA sayısı'])
  return sata <= ports
    ? result(id, 'ok', title, `${sata} SATA disk, anakartta ${ports} SATA girişi var.`, cats)
    : result(id, 'fail', title, `${sata} SATA disk var ama anakartta ${ports} SATA girişi var.`, cats)
}

export const powerCapacityRule: Rule = (b) => {
  if (!b.psu || (!b.cpu && !b.gpu)) return null
  const id = 'power-capacity'
  const title = 'Güç kaynağı yeterliliği'
  const cats: CategoryId[] = ['psu', 'cpu', 'gpu']
  const p = estimatePower(b)
  if (p.unknown.length || p.psuW === undefined) return unknownResult(id, title, cats, p.unknown)
  const pct = Math.round(p.loadRatio! * 100)
  const base = `Tahmini tüketim ${w(p.totalW)} / ${w(p.psuW)} (yük %${pct}).`
  if (p.loadRatio! > POWER_ASSUMPTIONS.failLoadRatio)
    return result(id, 'fail', title, `${base} Güç kaynağı yetmez.`, cats)
  if (p.loadRatio! > POWER_ASSUMPTIONS.warnLoadRatio)
    return result(
      id,
      'warn',
      title,
      `${base} Yük %${Math.round(POWER_ASSUMPTIONS.warnLoadRatio * 100)}'in üstünde; pay az.`,
      cats
    )
  return result(id, 'ok', title, base, cats)
}

export const gpuRecommendedPsuRule: Rule = (b) => {
  if (!b.psu || !b.gpu) return null
  const id = 'gpu-recommended-psu'
  const title = 'Ekran kartının önerdiği güç'
  const cats: CategoryId[] = ['psu', 'gpu']
  const rec = specNum(b.gpu, 'recommendedPsuW')
  const psuW = specNum(b.psu, 'wattage')
  const missing = missingOf([
    [rec, 'ekran kartı üreticisinin önerdiği güç'],
    [psuW, 'güç kaynağının gücü']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  return psuW! >= rec!
    ? result(id, 'ok', title, `Üretici en az ${w(rec!)} öneriyor, güç kaynağı ${w(psuW!)}.`, cats)
    : result(id, 'warn', title, `Üretici en az ${w(rec!)} öneriyor, güç kaynağı ${w(psuW!)}.`, cats)
}

export const gpuPowerConnectorsRule: Rule = (b) => {
  if (!b.psu || !b.gpu) return null
  const id = 'gpu-power-connectors'
  const title = 'Ekran kartı güç soketleri'
  const cats: CategoryId[] = ['psu', 'gpu']
  const need = specConnectors(b.gpu, 'powerConnectors')
  const have = specConnectors(b.psu, 'gpuConnectors')
  const missing = missingOf([
    [need, 'ekran kartının güç soketleri'],
    [have, 'güç kaynağının ekran kartı soketleri']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)

  const n16 = need!['16-pin'] ?? 0
  const n8 = need!['8-pin'] ?? 0
  const n6 = need!['6-pin'] ?? 0
  const h16 = have!['16-pin'] ?? 0
  const h8 = have!['8-pin'] ?? 0
  const h6 = have!['6-pin'] ?? 0

  if (n16 + n8 + n6 === 0) return result(id, 'ok', title, 'Ekran kartı ek güç soketi istemiyor.', cats)

  const problems: string[] = []
  let adapter = false
  if (n16 > h16) {
    // 16-pin yoksa kartın kutusundan çıkan 8-pin → 16-pin adaptörüyle bağlanabilir.
    if (h8 > 0) adapter = true
    else problems.push(`${n16} × 16-pin gerekiyor, güç kaynağında ${h16} var ve adaptör için 8-pin de yok`)
  }
  // 8-pin (6+2) soketler 6-pin isteyen kartlara da takılır.
  if (n8 > h8) problems.push(`${n8} × 8-pin gerekiyor, güç kaynağında ${h8} var`)
  else if (n6 > h6 + (h8 - n8)) problems.push(`${n6} × 6-pin gerekiyor, güç kaynağında yeterli soket yok`)

  if (problems.length) return result(id, 'fail', title, `${problems.join('; ')}.`, cats)
  if (adapter)
    return result(
      id,
      'warn',
      title,
      'Güç kaynağında 16-pin soket yok; ekran kartının kutusundan çıkan adaptörle bağlanır. ' +
        'Adaptörün kaç adet 8-pin istediğini kartın kılavuzundan kontrol et.',
      cats
    )
  return result(id, 'ok', title, 'Güç kaynağında ekran kartının istediği soketler var.', cats)
}

export const psuLengthRule: Rule = (b) => {
  if (!b.psu || !b.case) return null
  const id = 'psu-length'
  const title = 'Güç kaynağı uzunluğu'
  const cats: CategoryId[] = ['psu', 'case']
  const len = specNum(b.psu, 'lengthMm')
  const max = specNum(b.case, 'maxPsuLengthMm')
  const missing = missingOf([
    [len, 'güç kaynağının uzunluğu'],
    [max, 'kasanın güç kaynağı sınırı']
  ])
  if (missing.length) return unknownResult(id, title, cats, missing)
  const margin = max! - len!
  return margin >= 0
    ? result(id, 'ok', title, `Güç kaynağı ${mm(len!)}, kasa sınırı ${mm(max!)}: ${mm(margin)} pay var.`, cats)
    : result(id, 'fail', title, `Güç kaynağı ${mm(len!)}, kasa sınırı ${mm(max!)}: ${mm(-margin)} uzun, sığmaz.`, cats)
}

export const RULES: Rule[] = [
  cpuSocketRule,
  memoryTypeRule,
  cpuMemoryTypeRule,
  memorySlotsRule,
  memoryCapacityRule,
  caseFormFactorRule,
  gpuLengthRule,
  coolerSocketRule,
  coolerFitRule,
  m2SlotsRule,
  sataPortsRule,
  powerCapacityRule,
  gpuRecommendedPsuRule,
  gpuPowerConnectorsRule,
  psuLengthRule
]
