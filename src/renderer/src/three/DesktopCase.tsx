import { useMemo, useRef, type ReactElement, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import type { CategoryId } from '@engines/catalog/types'
import type { BodyModel, BodyModelProps, Vec3 } from './bodyModel'

// MelPC'ye özgü masaüstü kasa. Bütün ölçüler milimetredir ve design/kasa-olculeri.md tablosundan gelir:
// X arkadan öne, Y aşağıdan yukarı, Z sağ kapaktan (anakart tepsisi) sol cam kapağa.

type Bounds = [x0: number, x1: number, y0: number, y1: number, z0: number, z1: number]

const C = {
  metalDark: '#3a3d45',
  metal: '#4b4f58',
  metalLight: '#6a6f7a',
  front: '#454952',
  pcb: '#15161b',
  heatsink: '#383b44',
  plastic: '#1c1d22',
  black: '#0b0c0f',
  gpu: '#22252e',
  ram: '#efeaff',
  violet: '#a58bff',
  cyan: '#62d2f4'
}

// ---------- Yardımcı şekiller ----------

function Box({
  b,
  color,
  metalness = 0.5,
  roughness = 0.55,
  emissive,
  emissiveIntensity = 1
}: {
  b: Bounds
  color: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
}): ReactElement {
  const [x0, x1, y0, y1, z0, z1] = b
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} castShadow receiveShadow>
      <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  )
}

/** Dört köşesi verilen düz yüzey (kasa panelleri için). */
function Quad({ points, color }: { points: [Vec3, Vec3, Vec3, Vec3]; color: string }): ReactElement {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const [a, b, c, d] = points
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3))
    g.computeVertexNormals()
    return g
  }, [points])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
    </mesh>
  )
}

function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r)
  s.quadraticCurveTo(x1, y1, x1 - r, y1)
  s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}

/** Kablo, hortum gibi eğri borular. */
function Tube({
  points,
  radius,
  color,
  emissive
}: {
  points: Vec3[]
  radius: number
  color: string
  emissive?: string
}): ReactElement {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 64, radius, 10, false)
  }, [points, radius])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.1}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissive ? 0.35 : 0}
      />
    </mesh>
  )
}

/** Mor-siyah kılıflı kablo: iki ince boru yan yana. */
function SleevedCable({ points }: { points: Vec3[] }): ReactElement {
  const offset = (dz: number): Vec3[] => points.map(([x, y, z]) => [x, y, z + dz])
  return (
    <group>
      <Tube points={offset(-2.2)} radius={2.4} color="#6d4fd8" emissive="#6d4fd8" />
      <Tube points={offset(2.2)} radius={2.4} color="#141418" />
    </group>
  )
}

/** 120 mm fan. Eksen yönünde ışıklı halka; kanatlar döner. */
function Fan({
  center,
  axis,
  size = 120,
  depth = 25,
  ring = C.violet
}: {
  center: Vec3
  axis: 'x' | 'y' | 'z'
  size?: number
  depth?: number
  ring?: string
}): ReactElement {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 2.2
  })
  // Yerel eksen +Z; istenen eksene döndürülür.
  const rotation: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  const half = size / 2
  const t = 6
  return (
    <group position={center} rotation={rotation}>
      {/* Çerçeve */}
      <Box b={[-half, half, half - t, half, -depth / 2, depth / 2]} color={C.plastic} />
      <Box b={[-half, half, -half, -half + t, -depth / 2, depth / 2]} color={C.plastic} />
      <Box b={[-half, -half + t, -half, half, -depth / 2, depth / 2]} color={C.plastic} />
      <Box b={[half - t, half, -half, half, -depth / 2, depth / 2]} color={C.plastic} />
      {/* Işıklı halka */}
      <mesh>
        <torusGeometry args={[size * 0.43, 3, 10, 48]} />
        <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={2.2} />
      </mesh>
      {/* Göbek ve kanatlar */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[19, 19, depth * 0.8, 24]} />
        <meshStandardMaterial color="#1a1b21" roughness={0.6} />
      </mesh>
      <group ref={blades}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation={[0, 0, (i / 7) * Math.PI * 2]}>
            <mesh position={[size * 0.24, 0, 0]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[size * 0.36, 14, 2]} />
              <meshStandardMaterial color="#2a2150" roughness={0.5} transparent opacity={0.85} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Seçili parçanın etrafında yanıp sönen mor ışık. */
function Glow({ b }: { b: Bounds }): ReactElement {
  const material = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (material.current) material.current.opacity = 0.16 + Math.sin(clock.elapsedTime * 3) * 0.07
  })
  const [x0, x1, y0, y1, z0, z1] = b
  const pad = 5
  return (
    <group>
      <mesh
        position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
        renderOrder={10}
      >
        <boxGeometry args={[x1 - x0 + pad * 2, y1 - y0 + pad * 2, z1 - z0 + pad * 2]} />
        <meshBasicMaterial
          ref={material}
          color={C.violet}
          transparent
          opacity={0.18}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
        <Edges color="#c6b6ff" lineWidth={1.5} renderOrder={11} />
      </mesh>
      {/* Işık şiddeti ve menzili dünya biriminde (1 birim = 100 mm). */}
      <pointLight position={[(x0 + x1) / 2, (y0 + y1) / 2, z1 + 40]} color={C.violet} intensity={4} distance={3} />

    </group>
  )
}

// ---------- Kategorilerin yerleri ----------

/** Vurgulama kutuları (mm). Kasa için bütün gövde. */
const HIGHLIGHT_BOUNDS: Record<CategoryId, Bounds[]> = {
  cpu: [[97, 147, 320, 370, 6, 16]],
  cooler: [
    [85, 159, 308, 382, 8, 50],
    [22, 420, 447, 499, 66, 194]
  ],
  motherboard: [[12, 256, 115, 420, 6, 8]],
  memory: [[180, 213, 274.6, 408, 8, 41]],
  gpu: [[2, 304, 199.1, 259.1, 10, 140]],
  storage: [[45, 125, 273.5, 295.5, 8, 17]],
  psu: [[6, 166, 22, 108, 40, 190]],
  case: [[0, 476, 0, 510, 0, 230]]
}

const ANCHORS: Partial<Record<CategoryId, Vec3>> = {
  cpu: [100, 360, 52],
  cooler: [300, 486, 196],
  motherboard: [205, 172, 18],
  memory: [200, 398, 44],
  gpu: [240, 229, 142],
  storage: [85, 284, 19],
  psu: [120, 112, 200],
  case: [463, 470, 214]
}

// ---------- Kasa ----------

/** Ön panelin dış hattı (Z, Y): köşeleri kesik sekizgen. Gövde bu kesitle arkadan öne uzanır. */
const OCTAGON: [number, number][] = [
  [0, 44],
  [0, 476],
  [34, 510],
  [196, 510],
  [230, 476],
  [230, 44],
  [206, 20],
  [24, 20]
]
const HEXAGON: [number, number][] = [
  [115, 484],
  [184, 444],
  [184, 92],
  [115, 52],
  [46, 92],
  [46, 444]
]

function shapeFrom(points: [number, number][]): THREE.Shape {
  const s = new THREE.Shape()
  points.forEach(([a, b], i) => (i === 0 ? s.moveTo(a, b) : s.lineTo(a, b)))
  s.closePath()
  return s
}

function Shell({ highlightCase }: { highlightCase: boolean }): ReactElement {
  const LEN = 450
  // Sol cam kenarı (Z = 230, Y 44–476) dışındaki kenarlar düz paneller.
  const panels = useMemo(() => {
    const out: [Vec3, Vec3, Vec3, Vec3][] = []
    for (let i = 0; i < OCTAGON.length; i++) {
      const [z1, y1] = OCTAGON[i]
      const [z2, y2] = OCTAGON[(i + 1) % OCTAGON.length]
      if (z1 === 230 && z2 === 230) continue
      out.push([
        [0, y1, z1],
        [LEN, y1, z1],
        [LEN, y2, z2],
        [0, y2, z2]
      ])
    }
    return out
  }, [])

  const sideFrame = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 44)
    s.lineTo(LEN, 44)
    s.lineTo(LEN, 476)
    s.lineTo(0, 476)
    s.closePath()
    s.holes.push(roundedRect(16, 152, 434, 466, 16))
    return new THREE.ShapeGeometry(s, 8)
  }, [])
  const glass = useMemo(() => new THREE.ShapeGeometry(roundedRect(16, 152, 434, 466, 16), 8), [])
  const backPlate = useMemo(() => new THREE.ShapeGeometry(shapeFrom(OCTAGON)), [])
  const frontFrame = useMemo(
    () => new THREE.ExtrudeGeometry(shapeFrom(OCTAGON), { depth: 26, bevelEnabled: false }),
    []
  )
  const hexFill = useMemo(() => new THREE.ShapeGeometry(shapeFrom(HEXAGON)), [])
  const hexLine = useMemo(() => {
    const pts = [...HEXAGON, HEXAGON[0]].map(([z, y]) => new THREE.Vector3(477, y, z))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 120, 2.4, 8, false)
  }, [])

  const stripSegments = 10
  return (
    <group>
      {panels.map((p, i) => (
        <Quad key={i} points={p} color={i % 2 ? C.metal : C.metalDark} />
      ))}
      {/* Sol yan: cam pencereli çerçeve */}
      <mesh geometry={sideFrame} position={[0, 0, 230]}>
        <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={glass} position={[0, 0, 230.5]} renderOrder={5}>
        <meshPhysicalMaterial
          color="#cfd8ff"
          transparent
          opacity={0.1}
          roughness={0.05}
          metalness={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Cam vidaları */}
      {(
        [
          [30, 166],
          [420, 166],
          [30, 452],
          [420, 452]
        ] as [number, number][]
      ).map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, y, 232]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[5, 5, 3, 16]} />
          <meshStandardMaterial color={C.metalLight} metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {/* Camın altındaki mor → turkuaz ışık çizgisi */}
      {Array.from({ length: stripSegments }, (_, i) => {
        const x0 = 26 + ((424 - 26) / stripSegments) * i
        const x1 = 26 + ((424 - 26) / stripSegments) * (i + 1)
        const color = new THREE.Color(C.violet).lerp(new THREE.Color(C.cyan), i / (stripSegments - 1))
        const hex = `#${color.getHexString()}`
        return <Box key={i} b={[x0, x1, 139, 147, 229, 232]} color={hex} emissive={hex} emissiveIntensity={2} />
      })}
      {/* Güç kaynağını örten bantta havalandırma yarıkları */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = 62 + i * 13
        return <Box key={i} b={[250, 426, y, y + 6, 229.6, 231]} color={C.black} />
      })}
      {/* Arka panel */}
      <mesh geometry={backPlate} rotation={[0, -Math.PI / 2, 0]} position={[0, 0, 0]}>
        <meshStandardMaterial color={C.metalDark} metalness={0.6} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Ön panel: sekizgen çerçeve ve ışıklı altıgen */}
      <mesh geometry={frontFrame} rotation={[0, -Math.PI / 2, 0]} position={[476, 0, 0]}>
        <meshStandardMaterial color={C.front} metalness={0.55} roughness={0.5} />
      </mesh>
      <mesh geometry={hexFill} rotation={[0, -Math.PI / 2, 0]} position={[476.6, 0, 0]}>
        <meshStandardMaterial color={C.black} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={hexLine}>
        <meshStandardMaterial color={C.violet} emissive={C.violet} emissiveIntensity={2.5} />
      </mesh>
      {/* Ayaklar */}
      {(
        [
          [10, 60, 20, 60],
          [10, 60, 170, 210],
          [390, 440, 20, 60],
          [390, 440, 170, 210]
        ] as [number, number, number, number][]
      ).map(([x0, x1, z0, z1]) => (
        <Box key={`${x0}-${z0}`} b={[x0, x1, 0, 20, z0, z1]} color="#1d1e22" />
      ))}
      {highlightCase && (
        <mesh position={[238, 255, 115]}>
          <boxGeometry args={[480, 514, 234]} />
          <meshBasicMaterial visible={false} />
          <Edges color="#c6b6ff" lineWidth={2} />
        </mesh>
      )}
    </group>
  )
}

function Motherboard({ memoryModules }: { memoryModules: number }): ReactElement {
  // Çift kanal için A2 ve B2 dolu; 4 modülde dördü de.
  const slots: { x: [number, number]; filled: boolean }[] = [
    { x: [180, 186], filled: memoryModules >= 4 },
    { x: [188.5, 195.5], filled: memoryModules >= 1 || memoryModules === 0 },
    { x: [197, 203], filled: memoryModules >= 4 },
    { x: [205.5, 212.5], filled: memoryModules >= 2 || memoryModules === 0 }
  ]
  return (
    <group>
      <Box b={[12, 256, 115, 420, 6, 8]} color={C.pcb} metalness={0.2} roughness={0.8} />
      <Box b={[14, 48, 261.25, 418, 8, 40]} color={C.metal} />
      <Box b={[50, 160, 388, 412, 8, 30]} color={C.heatsink} />
      <Box b={[30, 60, 408, 418, 8, 20]} color={C.plastic} />
      <Box b={[244, 255, 285, 338, 8, 24]} color={C.plastic} />
      <Box b={[170, 232, 150, 195, 8, 16]} color={C.heatsink} />
      <Box b={[248, 255, 140, 182, 8, 18]} color={C.plastic} />
      <Box b={[45, 125, 273.5, 295.5, 8, 17]} color={C.heatsink} />
      {/* İşlemci soketi (pompanın altında) */}
      <Box b={[97, 147, 320, 370, 8, 12]} color="#8a8e99" metalness={0.8} roughness={0.3} />
      {slots.map((s, i) => (
        <group key={i}>
          <Box b={[s.x[0], s.x[1], 274.6, 408, 8, 13]} color={C.plastic} />
          {s.filled && (
            <>
              <Box b={[s.x[0], s.x[1], 274.6, 408, 13, 38]} color={C.ram} metalness={0.3} roughness={0.4} />
              <Box b={[s.x[0], s.x[1], 274.6, 408, 38, 41]} color={C.violet} emissive={C.violet} emissiveIntensity={1.6} />
            </>
          )}
        </group>
      ))}
    </group>
  )
}

function Gpu(): ReactElement {
  return (
    <group>
      <Box b={[0, 2, 190, 262, 4, 140]} color={C.metalLight} metalness={0.8} />
      <Box b={[2, 304, 199.1, 259.1, 10, 140]} color={C.gpu} />
      <Box b={[2, 304, 255, 259.1, 10, 140]} color="#2f3340" />
      <Box b={[20, 290, 222, 226, 139.5, 141]} color={C.violet} emissive={C.violet} emissiveIntensity={1.8} />
      <Box b={[196, 216, 259.1, 266, 108, 122]} color={C.plastic} />
    </group>
  )
}

function LiquidCooling(): ReactElement {
  return (
    <group>
      {/* Pompa */}
      <mesh position={[122, 345, 29]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[37, 37, 42, 40]} />
        <meshStandardMaterial color="#1a1b21" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[122, 345, 50.5]}>
        <torusGeometry args={[27, 3, 12, 48]} />
        <meshStandardMaterial color={C.violet} emissive={C.violet} emissiveIntensity={2.4} />
      </mesh>
      {/* Radyatör ve tavan fanları */}
      <Box b={[34, 408, 472, 499, 66, 194]} color="#2c2f37" />
      <Box b={[22, 34, 470, 501, 64, 196]} color={C.plastic} />
      <Box b={[408, 420, 470, 501, 64, 196]} color={C.plastic} />
      {[100, 220, 340].map((x) => (
        <Fan key={x} center={[x, 459.5, 130]} axis="y" />
      ))}
      {/* Hortumlar */}
      <Tube points={[[112, 345, 52], [150, 410, 80], [300, 452, 98], [404, 471, 110]]} radius={5} color="#16161b" />
      <Tube points={[[132, 345, 52], [175, 405, 110], [320, 448, 140], [414, 471, 150]]} radius={5} color="#16161b" />
    </group>
  )
}

function PsuArea({ reveal }: { reveal: boolean }): ReactElement {
  return (
    <group>
      {/* Güç kaynağı (örtünün altında) */}
      <Box b={[6, 166, 22, 108, 40, 190]} color="#202228" />
      {/* Örtü: güç kaynağı vurgulanınca yarı saydam olur */}
      <mesh position={[200, 66, 115]}>
        <boxGeometry args={[400, 92, 230]} />
        <meshStandardMaterial
          color={C.metalDark}
          metalness={0.5}
          roughness={0.55}
          transparent={reveal}
          opacity={reveal ? 0.25 : 1}
        />
      </mesh>
    </group>
  )
}

function Cables(): ReactElement {
  return (
    <group>
      <SleevedCable points={[[250, 311, 24], [262, 311, 32], [272, 322, 14], [277, 328, 2]]} />
      <SleevedCable
        points={[[206, 266, 115], [208, 290, 120], [228, 280, 146], [239, 200, 146], [239, 112, 146]]}
      />
      <SleevedCable points={[[45, 418, 20], [46, 432, 18], [50, 437, 2]]} />
    </group>
  )
}

function DesktopCaseComponent({ highlight, memoryModules }: BodyModelProps): ReactElement {
  const glow: ReactNode = highlight && highlight !== 'case' ? HIGHLIGHT_BOUNDS[highlight].map((b, i) => <Glow key={i} b={b} />) : null
  return (
    <group>
      <Shell highlightCase={highlight === 'case'} />
      <Motherboard memoryModules={memoryModules} />
      <Gpu />
      <LiquidCooling />
      <PsuArea reveal={highlight === 'psu'} />
      <Cables />
      <Fan center={[12.5, 385, 120]} axis="x" ring={C.cyan} />
      {[150, 275, 400].map((y) => (
        <Fan key={y} center={[436.5, y, 115]} axis="x" />
      ))}
      {/* İçeriyi aydınlatan mor ve turkuaz ışıklar */}
      <pointLight position={[230, 300, 170]} color={C.violet} intensity={14} distance={8} />
      <pointLight position={[400, 220, 170]} color={C.cyan} intensity={6} distance={6} />
      <pointLight position={[150, 420, 200]} color="#ffffff" intensity={5} distance={6} />
      {glow}
    </group>
  )
}

export const desktopCase: BodyModel = {
  id: 'desktop-case',
  label: 'Masaüstü kasa',
  center: [238, 255, 115],
  anchors: ANCHORS,
  cameraPresets: [
    // "Yan": design/kasa-olculeri.md'deki örnek çizimin kamera yönü ((900, 272, 1550) → (215, 262, 115)),
    // kasa ekranı dolduracak kadar yakından.
    { id: 'side', label: 'Yan', position: [4.75, 0.25, 10.3], target: [-0.23, 0.07, 0] },
    { id: 'front', label: 'Ön', position: [11, 0.8, 1.6], target: [0, 0, 0] },
    { id: 'top', label: 'Üst', position: [0.4, 11, 2.2], target: [0, 0, 0] },
    { id: 'free', label: 'Serbest', position: [8.2, 4.6, 8.8], target: [0, -0.2, 0] }
  ],
  Component: DesktopCaseComponent
}
