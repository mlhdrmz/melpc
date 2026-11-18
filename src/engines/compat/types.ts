import type { CategoryId, Part } from '../catalog/types'

export type CompatStatus = 'ok' | 'warn' | 'fail'

export interface CompatResult {
  ruleId: string
  status: CompatStatus
  /** Kısa başlık, ör. "Ekran kartı uzunluğu". */
  title: string
  /** İlgili değerlerle Türkçe açıklama. */
  message: string
  /** Kuralın ilgilendiği parça kategorileri (vurgulama ve parça seçme penceresi için). */
  categories: CategoryId[]
}

/** Uyumluluk motorunun gördüğü toplama. Depolama birden fazla olabilir. */
export interface Build {
  cpu?: Part
  motherboard?: Part
  memory?: Part
  gpu?: Part
  storage: Part[]
  psu?: Part
  case?: Part
  cooler?: Part
}

export type Rule = (build: Build) => CompatResult | null
