import type { BenchmarkTest, TestId } from './types'

// Testlerin tanımı. Açıklamalar kaynağın kendi tanımına dayanır.

export const BENCHMARK_TESTS: Record<TestId, BenchmarkTest> = {
  'blender-cycles': {
    label: 'Blender render (Cycles)',
    unit: 'örnek/dk',
    higherIsBetter: true,
    // Blender Open Data: "the estimated number of samples per minute, summed for all benchmark scenes"
    description:
      'Blender Cycles motorunun bir dakikada işlediği tahmini örnek (sample) sayısı, test sahnelerinin toplamı. ' +
      'Değer, kullanıcıların Blender Open Data\'ya gönderdiği ölçümlerin ortancasıdır; laboratuvar ölçümü değildir.',
    categories: ['cpu', 'gpu'],
    conditions: {
      blenderVersion: 'Blender sürümü',
      computeType: 'Hesaplama türü',
      statistic: 'İstatistik'
    }
  }
}

/** Hesaplama türlerinin arayüzdeki adları. */
export const COMPUTE_TYPE_LABELS: Record<string, string> = {
  CPU: 'İşlemci',
  OPTIX: 'NVIDIA OptiX',
  CUDA: 'NVIDIA CUDA',
  HIP: 'AMD HIP',
  ONEAPI: 'Intel oneAPI'
}
