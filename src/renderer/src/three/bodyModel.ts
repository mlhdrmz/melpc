import type { ComponentType } from 'react'
import type { CategoryId } from '@engines/catalog/types'

// 3D görünümde gösterilen "gövde modeli". Şimdilik yalnızca masaüstü kasa var;
// ileride laptop gibi başka modeller aynı arayüzle eklenebilir.

/** Milimetre cinsinden nokta: [x, y, z] (bkz. design/kasa-olculeri.md). */
export type Vec3 = [number, number, number]

export type CameraPresetId = 'side' | 'front' | 'top' | 'free'

export interface CameraPreset {
  id: CameraPresetId
  label: string
  /** Sahne birimiyle (1 birim = 100 mm, gövdenin merkezi orijinde) kamera konumu ve bakış noktası. */
  position: Vec3
  target: Vec3
}

export interface BodyModelProps {
  /** Mor ışıkla vurgulanan parça kategorisi. */
  highlight: CategoryId | null
  /** Seçili belleğin modül sayısı (görselde kaç modül takılı görüneceği). */
  memoryModules: number
}

export interface BodyModel {
  id: string
  label: string
  /** Modelin milimetre cinsinden kapladığı alanın merkezi; sahne bu noktayı orijine taşır. */
  center: Vec3
  /** Her kategori için işaret noktasının yeri (mm). */
  anchors: Partial<Record<CategoryId, Vec3>>
  cameraPresets: CameraPreset[]
  Component: ComponentType<BodyModelProps>
}

/** mm → sahne birimi. */
export const MM = 0.01
