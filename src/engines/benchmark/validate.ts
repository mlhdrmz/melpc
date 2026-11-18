import type { PartRecord } from '../catalog/types'
import { normalizeDeviceName } from '../hardware/parse'
import { BENCHMARK_TESTS } from './tests'
import { TEST_IDS, type BenchmarkFile, type BenchmarkLoadError, type BenchmarkResult } from './types'

// `data/benchmarks/*.json` dosyalarını okur ve katalogla birlikte doğrular. Hatalı ölçüm yüklenmez.

const DATE = /^\d{4}-\d{2}-\d{2}$/

export interface BenchmarkLoadResult {
  results: BenchmarkResult[]
  sources: BenchmarkFile['sources']
  errors: BenchmarkLoadError[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Bir ölçümün sorunları (boşsa geçerli). `parts`: katalogdaki kayıtlar. */
export function validateResult(raw: unknown, sources: BenchmarkFile['sources'], parts: PartRecord[]): string[] {
  const problems: string[] = []
  if (!isObject(raw)) return ['ölçüm bir nesne olmalı']
  const test = raw.test as string
  if (!(TEST_IDS as readonly string[]).includes(test)) return [`bilinmeyen test: ${String(test)}`]
  const def = BENCHMARK_TESTS[test as BenchmarkResult['test']]

  const subject = raw.subject
  if (!isObject(subject)) problems.push('subject eksik')
  else if (typeof subject.partId === 'string') {
    const part = parts.find((p) => p.id === subject.partId)
    if (!part) problems.push(`katalogda olmayan parça: ${subject.partId}`)
    else if (!def.categories.includes(part.category)) problems.push(`${def.label} ${part.category} için değil`)
  } else if (typeof subject.gpuChip === 'string') {
    if (!def.categories.includes('gpu')) problems.push(`${def.label} ekran kartı için değil`)
    else if (!parts.some((p) => p.category === 'gpu' && p.specs.gpuChip?.value === subject.gpuChip)) {
      problems.push(`katalogda bu grafik işlemcisini kullanan kart yok: ${subject.gpuChip}`)
    }
  } else if (typeof subject.deviceName === 'string' && subject.deviceName.trim()) {
    if (subject.category !== 'cpu' && subject.category !== 'gpu') problems.push('deviceName ile category (cpu ya da gpu) gerekli')
    else if (!def.categories.includes(subject.category)) problems.push(`${def.label} ${subject.category} için değil`)
  } else problems.push('subject partId, gpuChip ya da deviceName içermeli')

  if (typeof raw.device !== 'string' || !raw.device.trim()) problems.push('device (kaynaktaki cihaz adı) eksik')
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value) || raw.value <= 0) problems.push('value pozitif bir sayı olmalı')
  if (raw.sampleCount !== undefined && (!Number.isInteger(raw.sampleCount) || (raw.sampleCount as number) < 1)) {
    problems.push('sampleCount pozitif bir tam sayı olmalı')
  }
  if (raw.note !== undefined && typeof raw.note !== 'string') problems.push('note metin olmalı')
  const conditions = raw.conditions
  if (!isObject(conditions)) problems.push('conditions eksik')
  else {
    for (const key of Object.keys(def.conditions)) {
      if (typeof conditions[key] !== 'string' || !(conditions[key] as string).trim()) problems.push(`koşul eksik: ${key}`)
    }
  }
  if (typeof raw.source !== 'string' || !sources[raw.source]) problems.push(`kaynak bulunamadı: ${String(raw.source)}`)
  return problems
}

function subjectKey(r: BenchmarkResult): string {
  const s = r.subject
  if ('partId' in s) return `part:${s.partId}`
  if ('gpuChip' in s) return `chip:${s.gpuChip}`
  return `device:${s.category}:${normalizeDeviceName(s.deviceName)}`
}

/** Ölçüm dosyalarını okur; katalogdaki parçalarla karşılaştırarak doğrular. */
export function parseBenchmarkFiles(files: { name: string; content: string }[], parts: PartRecord[]): BenchmarkLoadResult {
  const results: BenchmarkResult[] = []
  const sources: BenchmarkFile['sources'] = {}
  const errors: BenchmarkLoadError[] = []
  const seen = new Set<string>()

  for (const file of files) {
    let data: unknown
    try {
      data = JSON.parse(file.content)
    } catch (e) {
      errors.push({ file: file.name, message: `JSON okunamadı: ${(e as Error).message}` })
      continue
    }
    if (!isObject(data) || !isObject(data.sources) || !Array.isArray(data.results)) {
      errors.push({ file: file.name, message: 'Dosya { sources, results } biçiminde olmalı' })
      continue
    }
    const fileSources = data.sources as BenchmarkFile['sources']
    for (const [key, s] of Object.entries(fileSources)) {
      if (!isObject(s) || typeof s.url !== 'string' || !/^https?:\/\//.test(s.url) || typeof s.retrieved !== 'string' || !DATE.test(s.retrieved)) {
        errors.push({ file: file.name, message: `kaynak ${key}: url ve retrieved (YYYY-AA-GG) gerekli` })
        continue
      }
      sources[key] = s
    }
    data.results.forEach((raw, index) => {
      const problems = validateResult(raw, sources, parts)
      const r = raw as BenchmarkResult
      if (!problems.length) {
        const key = [r.test, subjectKey(r), ...Object.entries(r.conditions).sort().map(([k, v]) => `${k}=${v}`)].join('|')
        if (seen.has(key)) problems.push('aynı test, parça ve koşulla ikinci ölçüm')
        seen.add(key)
      }
      if (problems.length) for (const message of problems) errors.push({ file: file.name, index, message })
      else results.push(r)
    })
  }
  return { results, sources, errors }
}

/** Bir parçaya ait ölçümler: işlemcide parça id'si, ekran kartında grafik işlemcisi üzerinden. */
export function resultsForPart(results: BenchmarkResult[], part: { id: string; category: string; specs: Record<string, { value: unknown }> }): BenchmarkResult[] {
  const chip = part.category === 'gpu' ? part.specs.gpuChip?.value : undefined
  return results.filter((r) =>
    'partId' in r.subject ? r.subject.partId === part.id : 'gpuChip' in r.subject && chip !== undefined && r.subject.gpuChip === chip
  )
}

/** Katalogda olmayan bir cihazın ölçümleri; ad Windows'un okuduğu biçimde olabilir ("12th Gen Intel(R) Core(TM) i7-12700H"). */
export function resultsForDevice(results: BenchmarkResult[], name: string, category: 'cpu' | 'gpu'): BenchmarkResult[] {
  const n = normalizeDeviceName(name)
  return results.filter((r) => 'deviceName' in r.subject && r.subject.category === category && normalizeDeviceName(r.subject.deviceName) === n)
}
