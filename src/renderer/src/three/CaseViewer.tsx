import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, Html } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import type { CategoryId } from '@engines/catalog/types'
import { CATEGORY_LABELS } from '@engines/catalog/specDefs'
import { MM, type BodyModel, type CameraPresetId } from './bodyModel'

interface CaseViewerProps {
  model: BodyModel
  highlight: CategoryId | null
  memoryModules: number
  /** İşaret noktasının üstüne gelince görünen ad (seçili parçanın adı). */
  partNames: Partial<Record<CategoryId, string>>
  onPick: (category: CategoryId) => void
}

export function CaseViewer({ model, highlight, memoryModules, partNames, onPick }: CaseViewerProps): ReactElement {
  const controls = useRef<CameraControlsImpl>(null)
  const [preset, setPreset] = useState<CameraPresetId>('side')
  const [hovered, setHovered] = useState<CategoryId | null>(null)
  const Body = model.Component
  const [cx, cy, cz] = model.center

  useEffect(() => {
    const p = model.cameraPresets.find((c) => c.id === preset)
    if (p && controls.current) void controls.current.setLookAt(...p.position, ...p.target, true)
  }, [preset, model])

  const zoom = (factor: number): void => {
    if (controls.current) void controls.current.dolly(factor, true)
  }

  const initial = model.cameraPresets[0]

  return (
    <div className="viewer">
      <div className="viewer__canvas">
        <Canvas
          shadows={false}
          dpr={[1, 2]}
          camera={{ position: initial.position, fov: 32, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.9} />
          <hemisphereLight args={['#e6e0ff', '#15111f', 1]} />
          <directionalLight position={[6, 9, 10]} intensity={2.4} />
          <directionalLight position={[10, 3, -4]} intensity={0.9} color="#62d2f4" />
          <directionalLight position={[-8, 4, -6]} intensity={0.5} color="#a58bff" />
          <Suspense fallback={null}>
            <group scale={MM} position={[-cx * MM, -cy * MM, -cz * MM]}>
              <Body highlight={highlight} memoryModules={memoryModules} />
              {(Object.entries(model.anchors) as [CategoryId, [number, number, number]][]).map(([cat, pos]) => (
                <Html key={cat} position={pos} center zIndexRange={[20, 0]}>
                  <button
                    type="button"
                    className={`marker${highlight === cat ? ' marker--active' : ''}`}
                    aria-label={CATEGORY_LABELS[cat]}
                    onMouseEnter={() => setHovered(cat)}
                    onMouseLeave={() => setHovered((h) => (h === cat ? null : h))}
                    onClick={() => onPick(cat)}
                  >
                    <span className="marker__dot" />
                    {(hovered === cat || highlight === cat) && (
                      <span className="marker__label">
                        <strong>{CATEGORY_LABELS[cat]}</strong>
                        <span>{partNames[cat] ?? 'Seçilmedi'}</span>
                      </span>
                    )}
                  </button>
                </Html>
              ))}
            </group>
          </Suspense>
          <CameraControls
            ref={controls}
            makeDefault
            minDistance={5}
            maxDistance={28}
            smoothTime={0.35}
          />
        </Canvas>
      </div>
      <div className="viewer__controls">
        <div role="group" aria-label="Görünüm" className="segmented">
          {model.cameraPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              className={`segmented__item${preset === p.id ? ' segmented__item--active' : ''}`}
              onClick={() => {
                // Aynı açıya tekrar basınca da kamerayı o açıya döndür.
                if (preset === p.id && controls.current) void controls.current.setLookAt(...p.position, ...p.target, true)
                setPreset(p.id)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className="round-button" aria-label="Yakınlaştır" onClick={() => zoom(1.5)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="line-icon">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5M11 8v6M8 11h6" />
          </svg>
        </button>
        <button type="button" className="round-button" aria-label="Uzaklaştır" onClick={() => zoom(-1.5)}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="line-icon">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5M8 11h6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
