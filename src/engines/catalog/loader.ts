import type { CatalogLoadError, PartRecord } from './types'
import { validatePartRecord } from './validate'

export interface CatalogFile {
  name: string
  content: string
}

export interface CatalogLoadResult {
  records: PartRecord[]
  errors: CatalogLoadError[]
}

/**
 * `data/catalog/*.json` dosyalarını okur ve doğrular. Her dosya parça kayıtlarından oluşan bir dizidir.
 * Hatalı kayıt kataloğa alınmaz, hata listesine yazılır; diğer kayıtlar yüklenmeye devam eder.
 */
export function parseCatalogFiles(files: CatalogFile[]): CatalogLoadResult {
  const records: PartRecord[] = []
  const errors: CatalogLoadError[] = []
  const seen = new Set<string>()

  for (const file of files) {
    let data: unknown
    try {
      data = JSON.parse(file.content)
    } catch (e) {
      errors.push({ file: file.name, message: `JSON okunamadı: ${(e as Error).message}` })
      continue
    }
    if (!Array.isArray(data)) {
      errors.push({ file: file.name, message: 'Dosya bir parça dizisi olmalı' })
      continue
    }
    for (const raw of data) {
      const partId = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : undefined
      const problems = validatePartRecord(raw)
      if (partId && seen.has(partId)) problems.push('aynı id başka bir kayıtta da var')
      if (problems.length) {
        for (const message of problems) errors.push({ file: file.name, partId, message })
        continue
      }
      seen.add(partId!)
      records.push(raw as PartRecord)
    }
  }
  return { records, errors }
}
