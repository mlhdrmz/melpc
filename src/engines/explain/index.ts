import type { CategoryId, Part } from '../catalog/types'
import { specNum, specStr } from '../catalog/access'
import { formatNumber } from '../catalog/specDefs'
import { estimatePower, type Build, type CompatResult } from '../compat'
import type { BenchmarkResult } from '../benchmark/types'
import { COMPUTE_TYPE_LABELS } from '../benchmark/tests'
import { memoryLatencyNs, rankParts, renderResult, SORT_OPTIONS } from '../score/sorting'

// Açıklama motoru: toplanan sistem için "neden iyi, neden kötü" maddeleri. Önceden yazılmış kurallardır,
// canlı yapay zekâ yoktur. Her madde tek cümlelik bir başlık ve altında sayılarla kaynağından oluşur;
// kaynağı olmayan bir yargı yazılmaz.

export type ExplainTone = 'good' | 'bad' | 'info'

export interface Explanation {
  id: string
  tone: ExplainTone
  title: string
  detail: string
  categories: CategoryId[]
}

const n = (v: number): string => formatNumber(Math.round(v))

/** Sıra katalogdaki parçaların üst üçte birindeyse iyi, alt üçte birindeyse kötü. */
function toneForRank(rank: number, of: number): ExplainTone {
  const third = Math.floor(of / 3)
  if (third > 0 && rank <= third) return 'good'
  if (third > 0 && rank > of - third) return 'bad'
  return 'info'
}

function renderExplanation(part: Part, category: 'cpu' | 'gpu', catalog: Part[], results: BenchmarkResult[]): Explanation {
  const ctx = { results }
  const r = renderResult(part, ctx)
  const subject = category === 'cpu' ? 'İşlemci' : 'Ekran kartı'
  if (!r) {
    return {
      id: `${category}-render`,
      tone: 'info',
      title: `${subject} için render ölçümü yok`,
      detail: 'Bu parçanın Blender ölçümü bulunmadığı için sıralamaya ve mühendislik puanına katılamıyor.',
      categories: [category]
    }
  }
  const entry = rankParts(catalog.filter((p) => p.category === category), SORT_OPTIONS[category][0], ctx).get(part.id)
  const rank = entry?.rank ?? 0
  const of = entry?.of ?? 0
  const tone = toneForRank(rank, of)
  const work = category === 'cpu' ? 'çok çekirdekli işte (render)' : 'render işinde'
  const title =
    tone === 'good' ? `${subject} ${work} güçlü` : tone === 'bad' ? `${subject} ${work} zayıf kalıyor` : `${subject} ${work} orta sırada`
  const chip = category === 'gpu' ? specStr(part, 'gpuChip') : undefined
  const parts = [
    `Blender ${r.conditions.blenderVersion} render ölçümü: ${n(r.value)} örnek/dk; katalogdaki ${of} ${category === 'cpu' ? 'işlemci' : 'ekran kartı'} arasında ${rank}. sırada.`,
    `Kullanıcı ölçümlerinin ortancası${r.sampleCount ? ` (${r.sampleCount} ölçüm)` : ''}${
      r.conditions.computeType !== 'CPU' ? `, ${COMPUTE_TYPE_LABELS[r.conditions.computeType] ?? r.conditions.computeType}` : ''
    }.`
  ]
  if (chip) parts.push(`Ölçüm bu kartla değil, aynı grafik işlemcisiyle (${chip}) yapıldı.`)
  return { id: `${category}-render`, tone, title, detail: parts.join(' '), categories: [category] }
}

export function explainBuild(build: Build, compat: CompatResult[], catalog: Part[], results: BenchmarkResult[]): Explanation[] {
  const out: Explanation[] = []
  const any = build.cpu || build.motherboard || build.memory || build.gpu || build.psu || build.case || build.cooler || build.storage.length
  if (!any) return out

  // Uyumluluk özeti (ayrıntılar Uyumluluk bölümünde).
  const fails = compat.filter((c) => c.status === 'fail')
  const warns = compat.filter((c) => c.status === 'warn')
  if (fails.length) {
    out.push({
      id: 'compat',
      tone: 'bad',
      title: `${fails.length} uyumsuzluk var`,
      detail: `${fails.map((f) => f.title).join(', ')}. Ayrıntılar Uyumluluk bölümünde.`,
      categories: [...new Set(fails.flatMap((f) => f.categories))]
    })
  } else if (warns.length) {
    out.push({
      id: 'compat',
      tone: 'bad',
      title: `${warns.length} uyumluluk uyarısı var`,
      detail: `${warns.map((w) => w.title).join(', ')}. Ayrıntılar Uyumluluk bölümünde.`,
      categories: [...new Set(warns.flatMap((w) => w.categories))]
    })
  } else if (compat.length) {
    out.push({
      id: 'compat',
      tone: 'good',
      title: 'Parçalar birbiriyle uyumlu',
      detail: `${compat.length} uyumluluk kontrolünün hepsi geçti.`,
      categories: []
    })
  }

  if (build.cpu) out.push(renderExplanation(build.cpu, 'cpu', catalog, results))
  if (build.gpu) out.push(renderExplanation(build.gpu, 'gpu', catalog, results))

  // Bellek
  if (build.memory) {
    const modules = specNum(build.memory, 'modules')
    if (modules === 1) {
      out.push({
        id: 'memory-channels',
        tone: 'bad',
        title: 'Tek bellek modülü',
        detail: 'Tek modülle bellek tek kanal çalışır; çift kanal için iki modül gerekir.',
        categories: ['memory']
      })
    }
    const gb = specNum(build.memory, 'capacityGb')
    const maxGb = Math.max(0, ...catalog.filter((p) => p.category === 'memory').map((p) => specNum(p, 'capacityGb') ?? 0))
    if (gb) {
      out.push({
        id: 'memory-size',
        tone: maxGb && gb >= maxGb ? 'good' : 'info',
        title: `Bellek ${gb} GB`,
        detail: `Katalogdaki en büyük kit ${maxGb} GB. Simülasyon ve büyük modellerde bellek miktarı belirleyicidir; mühendislik puanında payı %30.`,
        categories: ['memory']
      })
    }
    const ns = memoryLatencyNs(build.memory)
    if (ns) {
      out.push({
        id: 'memory-latency',
        tone: 'info',
        title: `Bellek gecikmesi ${formatNumber(Math.round(ns * 100) / 100)} ns`,
        detail: `CL ${specNum(build.memory, 'casLatency')}, ${specNum(build.memory, 'speedMts')} MT/s (üretici). Hesap: CL × 2000 / hız.`,
        categories: ['memory']
      })
    }
  }

  // Depolama
  if (build.storage.length) {
    const nvme = build.storage.filter((d) => specStr(d, 'storageType') === 'M.2 NVMe')
    const speeds = build.storage
      .map((d) => ({ d, mbps: specNum(d, 'seqReadMbps') }))
      .filter((x): x is { d: Part; mbps: number } => x.mbps !== undefined)
      .sort((a, b) => b.mbps - a.mbps)
    if (!nvme.length) {
      out.push({
        id: 'storage-nvme',
        tone: 'bad',
        title: 'Toplamada NVMe disk yok',
        detail: `Seçilen diskler SATA${speeds.length ? `; en hızlısının okuma hızı ${n(speeds[0].mbps)} MB/s (üretici)` : ''}. SATA arayüzü NVMe disklerden yavaştır.`,
        categories: ['storage']
      })
    } else if (speeds.length) {
      out.push({
        id: 'storage-speed',
        tone: 'info',
        title: `En hızlı disk ${n(speeds[0].mbps)} MB/s okuyor`,
        detail: `${speeds[0].d.brand} ${speeds[0].d.model}: üreticinin "en fazla" diye verdiği sıralı okuma hızı.`,
        categories: ['storage']
      })
    }
  }

  // Güç payı (yük %80'i geçerse Uyumluluk zaten uyarır).
  const power = estimatePower(build)
  if (power.loadRatio !== undefined && !power.unknown.length && power.loadRatio <= 0.8) {
    const pct = Math.round(power.loadRatio * 100)
    out.push({
      id: 'power-headroom',
      tone: power.loadRatio <= 0.6 ? 'good' : 'info',
      title: power.loadRatio <= 0.6 ? 'Güç kaynağında pay var' : 'Güç kaynağı yeterli',
      detail: `Tahmini tüketim ~${n(power.totalW)} W, güç kaynağı ${n(power.psuW as number)} W (yük %${pct}). İşlemci ve ekran kartının üretici güç değerleri ve diğer parçalar için sabit ${power.otherW} W varsayımıyla.`,
      categories: ['psu']
    })
  }

  return out
}
