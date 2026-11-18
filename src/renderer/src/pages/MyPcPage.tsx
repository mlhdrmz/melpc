import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { CategoryId, Part } from '@engines/catalog/types'
import { formatNumber } from '@engines/catalog/specDefs'
import { partName } from '@engines/catalog/access'
import type { HardwareReading } from '@engines/hardware/types'
import {
  buildLaptopAdvice,
  displayDeviceName,
  formatCapacity,
  type AdviceItem,
  type LaptopAdvice,
  type PerfCompare
} from '@engines/laptop/advice'
import { useCatalog } from '../catalog/CatalogContext'
import { usePrices } from '../price/PriceContext'
import { PriceLine } from '../price/PriceLine'
import { formatFullDateTime } from '../price/format'
import { CaseViewer } from '../three/CaseViewer'
import { laptopBody } from '../three/LaptopBody'

// Bilgisayarım (Melih onayladı, 5. aşama): Windows'un donanım bilgisi + laptop profili (üreticinin kılavuzu).
// Okuma yalnızca "Oku"ya basınca yapılır; son okuma saklanır. Değerlerin nereden geldiği her satırda yazar.

const TAG_CLASS: Record<AdviceItem['tone'], string> = {
  full: 'mypc-tag mypc-tag--full',
  up: 'mypc-tag mypc-tag--up',
  info: 'mypc-tag mypc-tag--info',
  fixed: 'mypc-tag mypc-tag--fixed',
  unknown: 'mypc-tag mypc-tag--fixed'
}

/** Öneri satırının 3D'de vurgulanacak parçası. */
const ITEM_CATEGORY: Partial<Record<AdviceItem['kind'], CategoryId>> = { memory: 'memory', storage: 'storage', cpu: 'cpu', gpu: 'gpu' }

export function MyPcPage(): ReactElement {
  const { catalog } = useCatalog()
  const [reading, setReading] = useState<HardwareReading | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<CategoryId | null>(null)

  useEffect(() => {
    window.melpc
      .getLastHardware()
      .then(setReading)
      .catch(() => setReading(null))
  }, [])

  const read = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const r = await window.melpc.readHardware()
      if (r.ok) setReading(r.reading)
      else setError(r.message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const advice = useMemo(
    () => (reading ? buildLaptopAdvice(reading, catalog.laptops, catalog.parts, catalog.benchmarks.results) : null),
    [reading, catalog]
  )

  if (reading === undefined) return <p className="muted">Yükleniyor…</p>

  const button = (
    <button type="button" className="button button--primary" onClick={() => void read()} disabled={busy}>
      {busy ? 'Okunuyor…' : reading ? 'Yeniden oku' : 'Oku'}
    </button>
  )

  if (!reading || !advice) {
    return (
      <div className="mypc-page">
        <div className="page-head">
          <div className="page-title">
            <span className="page-title__sub">Kendi bilgisayarın ve yükseltme seçenekleri</span>
            <h1>BİLGİSAYARIM</h1>
          </div>
          <div className="page-actions">{button}</div>
        </div>
        <div className="panel mypc-intro">
          <p>
            Bilgisayarının parçaları Windows'un kendi donanım bilgisinden okunur. Okuma yalnızca "Oku"ya basınca yapılır;
            hiçbir yere gönderilmez ve seri numaraları okunmaz. Son okuma bu bilgisayarda saklanır.
          </p>
          <p className="muted small">
            Yükseltme bilgileri (boş yuvalar, en çok bellek, SSD yuvası) üreticinin kılavuzundan gelir; şimdilik Dell G15 5520
            için var.
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const p = advice.profile
  const firstSource = p ? Object.values(p.sources)[0] : undefined
  return (
    <div className="mypc-page">
      <div className="page-head">
        <div className="page-title">
          <span className="page-title__sub">
            {reading.system.model ?? 'Bilgisayar'} · okundu {formatFullDateTime(reading.readAt)} · Windows{p ? ` + ${p.brand} kılavuzu` : ''}
          </span>
          <h1>BİLGİSAYARIM</h1>
        </div>
        <div className="page-actions">
          {firstSource && (
            <a className="button button--ghost" href={firstSource.url} target="_blank" rel="noreferrer">
              {p?.brand} kılavuzunu aç
            </a>
          )}
          {button}
        </div>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="mypc-grid">
        <div className="mypc-col">
          <LaptopView reading={reading} advice={advice} focus={focus} onFocus={setFocus} />
          <PerformanceCard performance={advice.performance} />
        </div>
        <div className="mypc-col">
          <HardwareCard advice={advice} />
          <UpgradeCard advice={advice} focus={focus} onFocus={setFocus} />
        </div>
      </div>
    </div>
  )
}

function LaptopView({
  reading,
  advice,
  focus,
  onFocus
}: {
  reading: HardwareReading
  advice: LaptopAdvice
  focus: CategoryId | null
  onFocus: (c: CategoryId | null) => void
}): ReactElement {
  if (!reading.system.isLaptop || !advice.profile) {
    return (
      <section className="stage mypc-stage mypc-stage--empty" aria-label="Görünüm">
        <p className="muted">
          {reading.system.isLaptop
            ? 'Bu laptop modeli için üreticinin kılavuzundan hazırlanmış bir profil yok; içini gösteremiyorum.'
            : 'Masaüstü bilgisayarlar için Bilgisayarım görünümü sonraki sürümde.'}
        </p>
      </section>
    )
  }
  const memory = advice.items.find((i) => i.kind === 'memory')
  const storage = advice.items.find((i) => i.kind === 'storage')
  const mods = reading.memory.modules
  const disk = reading.disks.find((d) => d.bus === 'NVMe')
  const partNames: Partial<Record<CategoryId, string>> = {
    memory: `${mods.map((m) => `${m.capacityGb ?? '?'} GB`).join(' + ') || 'boş'} · ${memory?.status ?? ''}`,
    storage: `${disk?.sizeGb ? formatCapacity(disk.sizeGb) : 'SSD'} · ${storage?.status ?? ''}`,
    cpu: `${reading.cpus[0] ? displayDeviceName(reading.cpus[0].name) : ''} · ${advice.items.find((i) => i.kind === 'cpu')?.status ?? ''}`,
    gpu: `${advice.hardware.find((h) => h.label === 'Ekran kartı')?.value ?? ''} · ${advice.items.find((i) => i.kind === 'gpu')?.status ?? ''}`
  }
  return (
    <section className="stage mypc-stage" aria-label="Laptopun içi">
      <CaseViewer
        model={laptopBody}
        highlight={focus}
        memoryModules={mods.length}
        partNames={partNames}
        onPick={(c) => onFocus(focus === c ? null : c)}
      />
      <div className="mypc-legend">
        <span>
          <i className="mypc-swatch mypc-swatch--violet" />
          Değiştirilebilir
        </span>
        <span>
          <i className="mypc-swatch mypc-swatch--cyan" />
          Değiştirilebilir · yalnızca bilgi
        </span>
        <span>
          <i className="mypc-swatch mypc-swatch--gray" />
          Değiştirilemez
        </span>
        <span className="muted">Genel bir laptop görseli; parçaların yeri yaklaşık.</span>
      </div>
    </section>
  )
}

function HardwareCard({ advice }: { advice: LaptopAdvice }): ReactElement {
  const p = advice.profile
  return (
    <section className="panel" aria-label="Okunan donanım">
      <span className="section-title">OKUNAN DONANIM</span>
      <div className="mypc-rows">
        {advice.hardware.map((h, i) => {
          const src = h.sourceKey ? p?.sources[h.sourceKey] : undefined
          return (
            <div key={i} className="mypc-row">
              <span className="mypc-row__label">{h.label}</span>
              <span className="mypc-row__value">{h.value}</span>
              {h.from === 'profile' && src ? (
                <a className="mypc-src mypc-src--profile" href={src.url} target="_blank" rel="noreferrer" title={src.title}>
                  {p?.brand} kılavuzu
                </a>
              ) : (
                <span className="mypc-src">Windows</span>
              )}
              {h.note && <span className="mypc-row__note">{h.note}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SourceLinks({ advice, keys }: { advice: LaptopAdvice; keys: string[] }): ReactElement | null {
  const p = advice.profile
  const sources = keys.map((k) => p?.sources[k]).filter((s): s is NonNullable<typeof s> => !!s)
  if (!sources.length) return null
  return (
    <span className="mypc-sources">
      Kaynak:{' '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title ?? s.url}
          </a>
        </span>
      ))}
    </span>
  )
}

function UpgradeCard({
  advice,
  focus,
  onFocus
}: {
  advice: LaptopAdvice
  focus: CategoryId | null
  onFocus: (c: CategoryId | null) => void
}): ReactElement {
  const { byId } = useCatalog()
  const { index } = usePrices()
  if (!advice.profile) {
    return (
      <section className="panel" aria-label="Ne değiştirilebilir">
        <span className="section-title">NE DEĞİŞTİRİLEBİLİR</span>
        <p className="muted small">
          Bu bilgisayarın modeli için üreticinin kılavuzundan hazırlanmış profil yok; boş yuvalar ve en çok bellek Windows'tan
          güvenilir biçimde okunamadığı için öneri gösterilmiyor.
        </p>
      </section>
    )
  }
  // SSD adayları: önce fiyatı olanlar ucuzdan pahalıya, sonra fiyatı olmayanlar.
  const candidates = advice.storageCandidates
    .map((c) => ({ ...c, part: byId.get(c.partId) as Part | undefined, price: index.get(c.partId).best?.price ?? null }))
    .filter((c): c is typeof c & { part: Part } => !!c.part)
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY) || partName(a.part).localeCompare(partName(b.part), 'tr'))
  return (
    <section className="panel" aria-label="Ne değiştirilebilir">
      <span className="section-title">NE DEĞİŞTİRİLEBİLİR</span>
      {advice.items.map((item) => {
        const cat = ITEM_CATEGORY[item.kind]
        return (
          <div
            key={item.kind}
            className={`mypc-item${cat && focus === cat ? ' mypc-item--focus' : ''}`}
            onMouseEnter={() => cat && onFocus(cat)}
            onMouseLeave={() => cat && onFocus(null)}
          >
            <div className="mypc-item__head">
              <span className="mypc-item__title">{item.title}</span>
              <span className={TAG_CLASS[item.tone]}>{item.status}</span>
            </div>
            {item.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {item.kind === 'storage' && (
              <>
                {candidates.length > 0 ? (
                  <ul className="mypc-ssd" aria-label="Uygun SSD'ler">
                    {candidates.map((c) => {
                      const read = c.part.specs.seqReadMbps?.value as number | null | undefined
                      const iface = c.part.specs.interface?.value as string | undefined
                      return (
                        <li key={c.partId}>
                          <span className="mypc-ssd__name">{partName(c.part)}</span>
                          <span className="mypc-ssd__meta">
                            {[iface, read ? `${formatNumber(read)} MB/s okuma` : null].filter(Boolean).join(' · ')}
                          </span>
                          <PriceLine partId={c.partId} className="mypc-ssd__price" showCount={false} />
                          {c.note && <span className="mypc-ssd__note">{c.note}</span>}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="muted small">Katalogda bu yuvaya uyan ve soğutucusuz olduğu bilinen SSD yok.</p>
                )}
                <p className="muted small">
                  Yalnızca soğutucusuz olduğu üreticinin sayfasından bilinen SSD'ler önerilir
                  {advice.unknownHeatsink ? `; soğutucu bilgisi bilinmeyen ${advice.unknownHeatsink} SSD önerilmedi` : ''}.
                </p>
              </>
            )}
            <SourceLinks advice={advice} keys={item.sources} />
          </div>
        )
      })}
    </section>
  )
}

function PerformanceCard({ performance }: { performance: PerfCompare[] }): ReactElement {
  const mine = performance.flatMap((pc) => pc.entries.filter((e) => e.mine))
  return (
    <section className="panel" aria-label="Performans">
      <span className="section-title">PERFORMANS · BLENDER RENDER</span>
      {performance.map((pc) => {
        const max = Math.max(...pc.entries.map((e) => e.value), 1)
        return (
          <div key={pc.category} className="mypc-chart">
            <span className="mypc-chart__title">{pc.category === 'cpu' ? 'İşlemci' : 'Ekran kartı'} · örnek/dk (yüksek iyi)</span>
            {pc.entries.map((e) => (
              <div key={`${e.name}-${e.mine}`} className={`mypc-bar${e.mine ? ' mypc-bar--mine' : ''}`} title={`${e.result.device} · ${e.result.sampleCount ?? '?'} ölçüm`}>
                <span className="mypc-bar__name">{e.mine ? `${e.name} · senin` : e.name}</span>
                <span className="mypc-bar__track">
                  <span className="mypc-bar__fill" style={{ width: `${(e.value / max) * 100}%` }} />
                </span>
                <span className="mypc-bar__value">{formatNumber(Math.round(e.value))}</span>
              </div>
            ))}
            {pc.missing && <p className="muted small">{pc.missing}</p>}
            {pc.reference && (
              <p className="mypc-takeaway">
                {pc.category === 'cpu' ? 'İşlemcin' : 'Ekran kartın'} render'da yaklaşık %{Math.round(pc.reference.ratio * 100)} düzeyinde
                (karşılaştırma: {pc.reference.name} = %100).
              </p>
            )}
          </div>
        )
      })}
      <p className="muted small">
        Blender Open Data, Blender 5.2.0, kullanıcı ölçümlerinin ortancası (CC0). Ekran kartları kendi üreticisinin hızlandırıcısıyla
        ölçüldü (NVIDIA OptiX, AMD HIP, Intel oneAPI). Masaüstü parçalar katalogdan.
        {mine.map((e) => ` ${e.name}: ${e.result.sampleCount ?? '?'} ölçüm${e.result.note ? `; ${e.result.note}` : '.'}`).join('')}
      </p>
    </section>
  )
}
