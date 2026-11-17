import { describe, expect, it } from 'vitest'
import { checkBuild, checkCandidate, estimatePower, worstStatus } from './index'
import {
  coolerFitRule,
  coolerSocketRule,
  cpuMemoryTypeRule,
  cpuSocketRule,
  caseFormFactorRule,
  gpuLengthRule,
  gpuPowerConnectorsRule,
  gpuRecommendedPsuRule,
  m2SlotsRule,
  memoryCapacityRule,
  memorySlotsRule,
  memoryTypeRule,
  powerCapacityRule,
  psuLengthRule,
  sataPortsRule
} from './rules'
import { airCooler, boardAm5Atx, caseAtx, cpuAm5, gpu, liquidCooler, nvme, psu, ramDdr5, sataSsd } from './testParts'
import type { Build } from './types'

const empty: Build = { storage: [] }

describe('işlemci soketi', () => {
  it('parçalardan biri yoksa çalışmaz', () => {
    expect(cpuSocketRule({ ...empty, cpu: cpuAm5() })).toBeNull()
  })
  it('aynı soket uyumlu', () => {
    expect(cpuSocketRule({ ...empty, cpu: cpuAm5(), motherboard: boardAm5Atx() })?.status).toBe('ok')
  })
  it('farklı soket uyumsuz ve açıklamada iki soket yazar', () => {
    const r = cpuSocketRule({ ...empty, cpu: cpuAm5({ socket: 'LGA1851' }), motherboard: boardAm5Atx() })
    expect(r?.status).toBe('fail')
    expect(r?.message).toContain('LGA1851')
    expect(r?.message).toContain('AM5')
  })
  it('soket bilinmiyorsa uyarı: kontrol edilemedi', () => {
    const r = cpuSocketRule({ ...empty, cpu: cpuAm5({ socket: null }), motherboard: boardAm5Atx() })
    expect(r?.status).toBe('warn')
    expect(r?.message).toContain('Kontrol edilemedi')
  })
})

describe('bellek', () => {
  it('tip anakartla aynıysa uyumlu, değilse uyumsuz', () => {
    expect(memoryTypeRule({ ...empty, memory: ramDdr5(), motherboard: boardAm5Atx() })?.status).toBe('ok')
    expect(
      memoryTypeRule({ ...empty, memory: ramDdr5({ memoryType: 'DDR4' }), motherboard: boardAm5Atx() })?.status
    ).toBe('fail')
  })
  it('işlemcinin desteklediği tipler kontrol edilir', () => {
    expect(cpuMemoryTypeRule({ ...empty, cpu: cpuAm5(), memory: ramDdr5() })?.status).toBe('ok')
    expect(
      cpuMemoryTypeRule({ ...empty, cpu: cpuAm5(), memory: ramDdr5({ memoryType: 'DDR4' }) })?.status
    ).toBe('fail')
    expect(
      cpuMemoryTypeRule({
        ...empty,
        cpu: cpuAm5({ memoryTypes: ['DDR4', 'DDR5'] }),
        memory: ramDdr5({ memoryType: 'DDR4' })
      })?.status
    ).toBe('ok')
  })
  it('modül sayısı yuva sayısını aşarsa uyumsuz', () => {
    expect(memorySlotsRule({ ...empty, memory: ramDdr5({ modules: 4 }), motherboard: boardAm5Atx() })?.status).toBe(
      'ok'
    )
    expect(
      memorySlotsRule({ ...empty, memory: ramDdr5({ modules: 4 }), motherboard: boardAm5Atx({ memorySlots: 2 }) })
        ?.status
    ).toBe('fail')
  })
  it('kapasite anakart sınırını aşarsa uyumsuz', () => {
    expect(
      memoryCapacityRule({ ...empty, memory: ramDdr5({ capacityGb: 192 }), motherboard: boardAm5Atx() })?.status
    ).toBe('ok')
    expect(
      memoryCapacityRule({
        ...empty,
        memory: ramDdr5({ capacityGb: 128 }),
        motherboard: boardAm5Atx({ maxMemoryGb: 96 })
      })?.status
    ).toBe('fail')
  })
})

describe('kasa ve anakart boyutu', () => {
  it('desteklenen boyut uyumlu', () => {
    expect(caseFormFactorRule({ ...empty, motherboard: boardAm5Atx(), case: caseAtx() })?.status).toBe('ok')
  })
  it('E-ATX anakart ATX kasaya uymaz', () => {
    const r = caseFormFactorRule({ ...empty, motherboard: boardAm5Atx({ formFactor: 'E-ATX' }), case: caseAtx() })
    expect(r?.status).toBe('fail')
  })
})

describe('ekran kartı uzunluğu', () => {
  it('payı milimetreyle yazar', () => {
    const r = gpuLengthRule({ ...empty, gpu: gpu(), case: caseAtx() })
    expect(r?.status).toBe('ok')
    expect(r?.message).toBe('Ekran kartı 304 mm, kasa sınırı 360 mm: 56 mm pay var.')
  })
  it('tam sınırda sığar', () => {
    expect(gpuLengthRule({ ...empty, gpu: gpu({ lengthMm: 360 }), case: caseAtx() })?.status).toBe('ok')
  })
  it('uzunsa ne kadar uzun olduğunu yazar', () => {
    const r = gpuLengthRule({ ...empty, gpu: gpu({ lengthMm: 380 }), case: caseAtx() })
    expect(r?.status).toBe('fail')
    expect(r?.message).toContain('20 mm uzun')
  })
  it('uzunluk bilinmiyorsa uyarı', () => {
    expect(gpuLengthRule({ ...empty, gpu: gpu({ lengthMm: null }), case: caseAtx() })?.status).toBe('warn')
  })
})

describe('soğutucu', () => {
  it('soket desteği', () => {
    expect(coolerSocketRule({ ...empty, cooler: airCooler(), cpu: cpuAm5() })?.status).toBe('ok')
    expect(
      coolerSocketRule({ ...empty, cooler: airCooler({ sockets: ['LGA1700'] }), cpu: cpuAm5() })?.status
    ).toBe('fail')
  })
  it('hava soğutucu yüksekliği', () => {
    const ok = coolerFitRule({ ...empty, cooler: airCooler(), case: caseAtx() })
    expect(ok?.ruleId).toBe('cooler-height')
    expect(ok?.status).toBe('ok')
    expect(ok?.message).toContain('7 mm pay')
    expect(coolerFitRule({ ...empty, cooler: airCooler({ heightMm: 170 }), case: caseAtx() })?.status).toBe('fail')
  })
  it('radyatör boyu kasadaki yerlerden birine uymalı', () => {
    const r = coolerFitRule({ ...empty, cooler: liquidCooler(), case: caseAtx() })
    expect(r?.ruleId).toBe('radiator-fit')
    expect(r?.status).toBe('ok')
    expect(r?.message).toContain('Üst')
    expect(r?.message).not.toContain('Ön')
    expect(coolerFitRule({ ...empty, cooler: liquidCooler({ radiatorSizeMm: 420 }), case: caseAtx() })?.status).toBe(
      'fail'
    )
  })
  it('yalnızca en büyük boyu verilen yerde o boya kadar radyatör kabul edilir', () => {
    const kasa = caseAtx({ radiatorMounts: [{ position: 'top', maxMm: 360 }] })
    const ok = coolerFitRule({ ...empty, cooler: liquidCooler({ radiatorSizeMm: 280 }), case: kasa })
    expect(ok?.status).toBe('ok')
    expect(ok?.message).toContain('en fazla 360 mm')
    expect(coolerFitRule({ ...empty, cooler: liquidCooler({ radiatorSizeMm: 420 }), case: kasa })?.status).toBe('fail')
  })
  it('tipi bilinmiyorsa uyarı', () => {
    expect(coolerFitRule({ ...empty, cooler: airCooler({ coolerType: null }), case: caseAtx() })?.status).toBe('warn')
  })
})

describe('disk yuvaları', () => {
  it('M.2 disk sayısı yuva sayısını aşmamalı', () => {
    const board = boardAm5Atx({ m2Slots: 2 })
    expect(m2SlotsRule({ ...empty, motherboard: board, storage: [nvme('a'), nvme('b')] })?.status).toBe('ok')
    expect(m2SlotsRule({ ...empty, motherboard: board, storage: [nvme('a'), nvme('b'), nvme('c')] })?.status).toBe(
      'fail'
    )
  })
  it('SATA disk sayısı giriş sayısını aşmamalı', () => {
    const board = boardAm5Atx({ sataPorts: 1 })
    expect(sataPortsRule({ ...empty, motherboard: board, storage: [sataSsd('a')] })?.status).toBe('ok')
    expect(sataPortsRule({ ...empty, motherboard: board, storage: [sataSsd('a'), sataSsd('b')] })?.status).toBe('fail')
  })
  it('disk yoksa kural çalışmaz', () => {
    expect(m2SlotsRule({ ...empty, motherboard: boardAm5Atx() })).toBeNull()
    expect(sataPortsRule({ ...empty, motherboard: boardAm5Atx(), storage: [nvme()] })).toBeNull()
  })
})

describe('güç', () => {
  it('tahmin: işlemci + ekran kartı + 100 W sabit pay', () => {
    const p = estimatePower({ ...empty, cpu: cpuAm5(), gpu: gpu(), psu: psu() })
    expect(p.totalW).toBe(120 + 300 + 100)
    expect(p.loadRatio).toBeCloseTo(520 / 850)
  })
  it('işlemcide yayımlanmış en yüksek değer kullanılır (Intel turbo gücü)', () => {
    const p = estimatePower({ ...empty, cpu: cpuAm5({ tdpW: 125, maxTurboPowerW: 253 }) })
    expect(p.cpuW).toBe(253)
  })
  it('%80 altı uyumlu, %80–100 uyarı, %100 üstü uyumsuz', () => {
    const b = { ...empty, cpu: cpuAm5(), gpu: gpu() } // 520 W
    expect(powerCapacityRule({ ...b, psu: psu({ wattage: 850 }) })?.status).toBe('ok')
    expect(powerCapacityRule({ ...b, psu: psu({ wattage: 600 }) })?.status).toBe('warn')
    expect(powerCapacityRule({ ...b, psu: psu({ wattage: 500 }) })?.status).toBe('fail')
  })
  it('tam %80 uyumlu sayılır', () => {
    // 120 + 300 + 100 = 520; 520 / 650 = 0.8
    expect(powerCapacityRule({ ...empty, cpu: cpuAm5(), gpu: gpu(), psu: psu({ wattage: 650 }) })?.status).toBe('ok')
  })
  it('güç bilinmiyorsa uyarı', () => {
    expect(
      powerCapacityRule({ ...empty, cpu: cpuAm5({ tdpW: null }), gpu: gpu(), psu: psu() })?.status
    ).toBe('warn')
  })
  it('ekran kartı üreticisinin önerdiği güç', () => {
    expect(gpuRecommendedPsuRule({ ...empty, gpu: gpu(), psu: psu() })?.status).toBe('ok')
    expect(gpuRecommendedPsuRule({ ...empty, gpu: gpu(), psu: psu({ wattage: 650 }) })?.status).toBe('warn')
  })
})

describe('ekran kartı güç soketleri', () => {
  it('16-pin varsa uyumlu', () => {
    expect(gpuPowerConnectorsRule({ ...empty, gpu: gpu(), psu: psu() })?.status).toBe('ok')
  })
  it('16-pin yoksa ama 8-pin varsa adaptör uyarısı', () => {
    const r = gpuPowerConnectorsRule({ ...empty, gpu: gpu(), psu: psu({ gpuConnectors: { '8-pin': 4 } }) })
    expect(r?.status).toBe('warn')
    expect(r?.message).toContain('adaptör')
  })
  it('hiç soket yoksa uyumsuz', () => {
    expect(gpuPowerConnectorsRule({ ...empty, gpu: gpu(), psu: psu({ gpuConnectors: {} }) })?.status).toBe('fail')
  })
  it('8-pin sayısı yetmezse uyumsuz', () => {
    const g = gpu({ powerConnectors: { '8-pin': 3 } })
    expect(gpuPowerConnectorsRule({ ...empty, gpu: g, psu: psu({ gpuConnectors: { '8-pin': 2 } }) })?.status).toBe(
      'fail'
    )
    expect(gpuPowerConnectorsRule({ ...empty, gpu: g, psu: psu({ gpuConnectors: { '8-pin': 3 } }) })?.status).toBe('ok')
  })
  it('6-pin isteyen karta 8-pin (6+2) soket de yeter', () => {
    const g = gpu({ powerConnectors: { '8-pin': 1, '6-pin': 1 } })
    expect(gpuPowerConnectorsRule({ ...empty, gpu: g, psu: psu({ gpuConnectors: { '8-pin': 2 } }) })?.status).toBe('ok')
    expect(gpuPowerConnectorsRule({ ...empty, gpu: g, psu: psu({ gpuConnectors: { '8-pin': 1 } }) })?.status).toBe(
      'fail'
    )
  })
  it('ek güç istemeyen kart uyumlu', () => {
    expect(
      gpuPowerConnectorsRule({ ...empty, gpu: gpu({ powerConnectors: {} }), psu: psu({ gpuConnectors: {} }) })?.status
    ).toBe('ok')
  })
})

describe('güç kaynağı uzunluğu', () => {
  it('kasa sınırına göre', () => {
    expect(psuLengthRule({ ...empty, psu: psu(), case: caseAtx() })?.status).toBe('ok')
    expect(psuLengthRule({ ...empty, psu: psu({ lengthMm: 220 }), case: caseAtx() })?.status).toBe('fail')
  })
})

describe('toplama ve aday kontrolü', () => {
  const full: Build = {
    cpu: cpuAm5(),
    motherboard: boardAm5Atx(),
    memory: ramDdr5(),
    gpu: gpu(),
    storage: [nvme()],
    psu: psu(),
    case: caseAtx(),
    cooler: liquidCooler()
  }
  it('uyumlu tam toplamada bütün sonuçlar uyumlu', () => {
    const results = checkBuild(full)
    expect(results.length).toBeGreaterThan(10)
    expect(worstStatus(results)).toBe('ok')
  })
  it('aday parça yalnızca kendi kategorisindeki sorunları döndürür', () => {
    const intelCpu = cpuAm5({ socket: 'LGA1851' })
    const problems = checkCandidate(full, intelCpu)
    expect(problems.map((p) => p.ruleId).sort()).toEqual(['cooler-socket', 'cpu-socket'])
    expect(worstStatus(problems)).toBe('fail')
  })
  it('depolama adayı mevcut disklere eklenir', () => {
    const b = { ...full, motherboard: boardAm5Atx({ m2Slots: 1 }) }
    expect(checkCandidate(b, nvme('ikinci')).map((p) => p.ruleId)).toEqual(['m2-slots'])
  })
})
