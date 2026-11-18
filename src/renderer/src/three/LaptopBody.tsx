import { useMemo, useRef, type ReactElement } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import type { CategoryId } from '@engines/catalog/types'
import type { BodyModel, BodyModelProps, Vec3 } from './bodyModel'

// Bilgisayarım (5. aşama) için genel bir laptop: alt kapağı açık, alttan bakılıyor. Marka kopyası değildir;
// yazı ve logo yoktur, parçaların yeri yaklaşıktır (design/bilgisayarim-taslak.html).
// Ölçüler milimetre: X soldan sağa, Y aşağıdan yukarı, Z arkadan (menteşe) öne (batarya).
// Arkada iki fan ve ısı boruları, altlarında işlemci ve ekran kartı; ortada bellek, SSD ve Wi-Fi kartı; önde batarya.

type Bounds = [x0: number, x1: number, y0: number, y1: number, z0: number, z1: number]

const C = {
  shell: '#3a3d45',
  floor: '#24252c',
  pcb: '#15161b',
  plate: '#2c2e36',
  plastic: '#1c1d22',
  chip: '#2b2740',
  copper: '#b07a55',
  battery: '#1d1b26',
  grille: '#2b2740',
  violet: '#a58bff',
  cyan: '#62d2f4'
}

function Box({ b, color, metalness = 0.4, roughness = 0.6, emissive, emissiveIntensity = 1 }: {
  b: Bounds
  color: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
}): ReactElement {
  const [x0, x1, y0, y1, z0, z1] = b
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}>
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

/** Değiştirilebilen parçanın ışıklı çerçevesi (bellek ve SSD mor, Wi-Fi turkuaz). */
function Frame({ b, color }: { b: Bounds; color: string }): ReactElement {
  const [x0, x1, , y1, z0, z1] = b
  const t = 1.6
  // Işık şiddeti düşük tutulur: yüksek olunca renk beyaza döner.
  const glow = 0.7
  return (
    <group>
      <Box b={[x0, x1, y1, y1 + 0.6, z0, z0 + t]} color={color} emissive={color} emissiveIntensity={glow} />
      <Box b={[x0, x1, y1, y1 + 0.6, z1 - t, z1]} color={color} emissive={color} emissiveIntensity={glow} />
      <Box b={[x0, x0 + t, y1, y1 + 0.6, z0, z1]} color={color} emissive={color} emissiveIntensity={glow} />
      <Box b={[x1 - t, x1, y1, y1 + 0.6, z0, z1]} color={color} emissive={color} emissiveIntensity={glow} />
    </group>
  )
}

function Pipe({ points, radius = 3, color = C.copper }: { points: Vec3[]; radius?: number; color?: string }): ReactElement {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 64, radius, 10, false)
  }, [points, radius])
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
    </mesh>
  )
}

/** Laptop fanı (üfleyici): yatay, kanatlar döner. */
function Fan({ center, radius = 42 }: { center: Vec3; radius?: number }): ReactElement {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += dt * 2.4
  })
  return (
    <group position={center}>
      <mesh position={[0, -5, 0]}>
        <cylinderGeometry args={[radius + 5, radius + 5, 2, 40]} />
        <meshStandardMaterial color={C.plastic} roughness={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, 0]}>
        <torusGeometry args={[radius + 4, 1.6, 8, 48]} />
        <meshStandardMaterial color="#3a3452" roughness={0.5} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[14, 14, 9, 24]} />
        <meshStandardMaterial color="#1a1b21" roughness={0.6} />
      </mesh>
      <group ref={blades}>
        {Array.from({ length: 13 }, (_, i) => (
          <group key={i} rotation={[0, (i / 13) * Math.PI * 2, 0]}>
            <mesh position={[radius * 0.62, 0, 0]} rotation={[0, 0.5, 0]}>
              <boxGeometry args={[radius * 0.62, 8, 1.4]} />
              <meshStandardMaterial color="#2a2150" roughness={0.5} transparent opacity={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Isı borularının bittiği soğutucu kanatçıkları (arkadaki hava çıkışında). */
function Fins({ x0, x1 }: { x0: number; x1: number }): ReactElement {
  const count = Math.floor((x1 - x0) / 4)
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} b={[x0 + i * 4, x0 + i * 4 + 1.2, 4, 18, 7, 22]} color="#4b4f58" metalness={0.8} roughness={0.35} />
      ))}
    </group>
  )
}

/** SO-DIMM bellek modülü (69,6 × 30 mm). */
function SoDimm({ x0, z0, present }: { x0: number; z0: number; present: boolean }): ReactElement {
  const b: Bounds = [x0, x0 + 69.6, 4, 6, z0, z0 + 30]
  if (!present) {
    // Boş yuva: yalnızca soket.
    return <Box b={[x0, x0 + 69.6, 3, 5, z0, z0 + 6]} color={C.plastic} />
  }
  return (
    <group>
      <Box b={b} color={C.pcb} />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} b={[x0 + 5 + i * 16, x0 + 17 + i * 16, 6, 7.4, z0 + 5, z0 + 18]} color={C.chip} />
      ))}
      <Box b={[x0 + 2, x0 + 67.6, 6, 6.4, z0 + 26, z0 + 29]} color="#b8964f" metalness={0.9} roughness={0.3} />
      <Frame b={b} color={C.violet} />
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
  const pad = 4
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} renderOrder={10}>
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
      <pointLight position={[(x0 + x1) / 2, y1 + 30, (z0 + z1) / 2]} color={C.violet} intensity={3} distance={2} />
    </group>
  )
}

const HIGHLIGHT_BOUNDS: Partial<Record<CategoryId, Bounds>> = {
  memory: [46, 194, 3, 9, 148, 182],
  storage: [212, 298, 3, 9, 154, 180],
  cpu: [128, 172, 4, 15, 85, 130],
  gpu: [190, 250, 4, 15, 82, 135]
}

const ANCHORS: Partial<Record<CategoryId, Vec3>> = {
  memory: [118, 12, 165],
  storage: [254, 12, 167],
  cpu: [150, 22, 104],
  gpu: [220, 22, 104]
}

function LaptopComponent({ highlight, memoryModules }: BodyModelProps): ReactElement {
  const glow = highlight ? HIGHLIGHT_BOUNDS[highlight] : undefined
  return (
    <group>
      {/* Gövde: taban ve kenarlar (alt kapak açık) */}
      <Box b={[0, 357, 0, 3, 0, 265]} color={C.floor} metalness={0.5} roughness={0.5} />
      <Box b={[0, 6, 0, 20, 0, 265]} color={C.shell} metalness={0.6} roughness={0.45} />
      <Box b={[351, 357, 0, 20, 0, 265]} color={C.shell} metalness={0.6} roughness={0.45} />
      <Box b={[0, 357, 0, 20, 0, 6]} color={C.shell} metalness={0.6} roughness={0.45} />
      <Box b={[0, 357, 0, 20, 259, 265]} color={C.shell} metalness={0.6} roughness={0.45} />
      {/* Anakart */}
      <Box b={[36, 321, 3, 4, 26, 196]} color={C.pcb} />

      {/* Arkada iki fan, hava çıkışındaki kanatçıklar ve ısı boruları */}
      <Fan center={[78, 13, 66]} />
      <Fan center={[279, 13, 66]} />
      <Fins x0={34} x1={122} />
      <Fins x0={235} x1={323} />
      <Pipe points={[[118, 15, 24], [150, 15, 90], [215, 15, 90], [244, 15, 24]]} />
      <Pipe points={[[110, 15, 38], [148, 15, 108], [225, 15, 108], [252, 15, 38]]} />
      <Pipe points={[[100, 15, 60], [140, 15, 124], [236, 15, 124], [262, 15, 60]]} />

      {/* İşlemci ve ekran kartı: ısı borularının altındaki plakalar (değiştirilemez) */}
      <Box b={[128, 172, 4, 12, 85, 130]} color={C.plate} metalness={0.7} roughness={0.4} />
      <Box b={[190, 250, 4, 12, 82, 135]} color={C.plate} metalness={0.7} roughness={0.4} />

      {/* Bellek: iki SO-DIMM yuvası */}
      <SoDimm x0={48} z0={150} present={memoryModules >= 1} />
      <SoDimm x0={123} z0={150} present={memoryModules >= 2} />

      {/* SSD: M.2 2280 */}
      <group>
        <Box b={[214, 294, 4, 6, 156, 178]} color={C.pcb} />
        <Box b={[220, 236, 6, 7.4, 160, 174]} color="#3a3452" />
        <Box b={[241, 263, 6, 7.4, 159, 175]} color={C.chip} />
        <Box b={[267, 289, 6, 7.4, 159, 175]} color={C.chip} />
        <mesh position={[298, 5, 167]}>
          <cylinderGeometry args={[3, 3, 4, 16]} />
          <meshStandardMaterial color="#6a6f7a" metalness={0.9} roughness={0.3} />
        </mesh>
        <Frame b={[214, 294, 4, 6, 156, 178]} color={C.violet} />
      </group>

      {/* Wi-Fi: M.2 2230 kart ve anten kabloları */}
      <group>
        <Box b={[302, 324, 4, 6, 150, 180]} color={C.pcb} />
        <Box b={[306, 320, 6, 7.2, 158, 170]} color={C.chip} />
        <Frame b={[302, 324, 4, 6, 150, 180]} color={C.cyan} />
        <Pipe points={[[308, 8, 152], [322, 9, 110], [334, 10, 40], [338, 11, 10]]} radius={1.1} color="#1a1b21" />
        <Pipe points={[[316, 8, 152], [330, 9, 112], [342, 10, 44], [344, 11, 10]]} radius={1.1} color="#5b5f6a" />
      </group>

      {/* Önde batarya ve hoparlörler */}
      <Box b={[62, 295, 3, 12, 200, 254]} color={C.battery} roughness={0.8} />
      {[120, 178, 236].map((x) => (
        <Box key={x} b={[x, x + 1.5, 12, 12.6, 202, 252]} color="#2b2740" />
      ))}
      <Box b={[12, 56, 3, 9, 212, 254]} color={C.grille} roughness={0.9} />
      <Box b={[301, 345, 3, 9, 212, 254]} color={C.grille} roughness={0.9} />

      {/* İçeriyi aydınlatan mor ve turkuaz ışıklar */}
      <pointLight position={[180, 120, 140]} color={C.violet} intensity={6} distance={6} />
      <pointLight position={[300, 90, 60]} color={C.cyan} intensity={3} distance={5} />
      {glow && <Glow b={glow} />}
    </group>
  )
}

export const laptopBody: BodyModel = {
  id: 'laptop',
  label: 'Laptop',
  center: [178.5, 10, 132.5],
  anchors: ANCHORS,
  cameraPresets: [
    { id: 'top', label: 'Üstten', position: [0, 6.2, 1.9], target: [0, 0, 0.12] },
    { id: 'free', label: 'Serbest', position: [3.4, 3.6, 4.4], target: [0, -0.1, 0] }
  ],
  Component: LaptopComponent
}
