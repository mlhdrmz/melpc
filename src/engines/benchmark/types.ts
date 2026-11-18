import type { CategoryId, SourceRef } from '../catalog/types'

// Performans ölçümleri (4. aşama). Kural: her ölçüm kaynağıyla, test adıyla ve koşuluyla gösterilir;
// ölçümü olmayan parça "ölçüm yok" görünür, tahmin edilmez.

/** Bilinen testler. Yeni bir kaynak eklenince buraya ve BENCHMARK_TESTS'e eklenir. */
export const TEST_IDS = ['blender-cycles'] as const
export type TestId = (typeof TEST_IDS)[number]

export interface BenchmarkTest {
  label: string
  /** Ölçümün birimi, ör. "örnek/dk". */
  unit: string
  higherIsBetter: boolean
  /** Arayüzde gösterilen açıklama: neyi, nasıl ölçtüğü. */
  description: string
  /** Hangi kategorideki parçalar için. */
  categories: CategoryId[]
  /** Her ölçümde bulunması gereken koşullar ve arayüzdeki adları. */
  conditions: Record<string, string>
}

/**
 * Ölçümün hangi parçalar için geçerli olduğu.
 * - partId: katalogdaki tek bir parça (işlemciler).
 * - gpuChip: aynı grafik işlemcisini kullanan bütün ekran kartları. Ölçüm kartın kendisiyle değil,
 *   o grafik işlemcisiyle yapılmıştır; arayüz bunu belirtir.
 */
export type BenchmarkSubject = { partId: string } | { gpuChip: string }

export interface BenchmarkResult {
  test: TestId
  subject: BenchmarkSubject
  /** Kaynakta cihazın geçtiği ad (hangi satırdan alındığı izlenebilsin diye). */
  device: string
  value: number
  /** Test koşulları; anahtarlar testin `conditions` tanımındakiler. */
  conditions: Record<string, string>
  /** Değer birden çok ölçümün ortancasıysa ölçüm sayısı. */
  sampleCount?: number
  /** Ölçümle ilgili not, ör. kaynağın ayırmadığı sürümler. */
  note?: string
  /** `sources` içindeki anahtar. */
  source: string
}

export interface BenchmarkSource extends SourceRef {
  /** Verinin lisansı, ör. "CC0". */
  license?: string
}

/** `data/benchmarks/*.json` dosyalarının biçimi. */
export interface BenchmarkFile {
  sources: Record<string, BenchmarkSource>
  results: BenchmarkResult[]
}

export interface BenchmarkLoadError {
  file: string
  index?: number
  message: string
}
