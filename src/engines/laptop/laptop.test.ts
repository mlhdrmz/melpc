import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { HardwareReading } from '../hardware/types'
import { findLaptopProfile, matchCpuOption, matchGpuOption, parseLaptopFiles, validateLaptopProfile } from './validate'

// Laptop profilleri: data/laptops içindeki gerçek dosyalar doğrulanır; kural testleri test değerleriyle.

const DIR = join(__dirname, '../../../data/laptops')
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((name) => ({ name, content: readFileSync(join(DIR, name), 'utf8') }))

const reading = (manufacturer: string, model: string): HardwareReading => ({
  readAt: '2026-11-18T10:00:00.000Z',
  system: { manufacturer, model, family: null, isLaptop: true },
  cpus: [],
  gpus: [],
  memory: { slots: null, modules: [] },
  disks: [],
  wifi: [],
  board: { manufacturer: null, product: null }
})

describe('laptop profilleri', () => {
  it('data/laptops dosyaları hatasız', () => {
    const { profiles, errors } = parseLaptopFiles(files)
    expect(errors).toEqual([])
    expect(profiles.map((p) => p.id)).toContain('dell-g15-5520')
  })

  it('kaynaksız ya da yanlış biçimli bilgi kabul edilmez', () => {
    const good = JSON.parse(files.find((f) => f.name === 'dell-g15-5520.json')!.content)
    expect(validateLaptopProfile(good)).toEqual([])
    const bad = structuredClone(good)
    bad.memory.slots = { value: 2 }
    bad.memory.moduleSizesGb = { value: [], source: 'memory' }
    bad.storage.options.value[0].formFactor = 'M.2 9999'
    bad.wifi.slot = { value: 'M.2 2230', source: 'yok' }
    bad.cpus = { value: null, note: 'bilinmiyor' }
    delete bad.gpus
    expect(validateLaptopProfile(bad)).toEqual([
      '"memory.slots": kaynak gösterilmemiş',
      '"memory.moduleSizesGb": boş olmayan liste olmalı',
      '"storage.options": formFactor: şunlardan biri olmalı: M.2 2230, M.2 2242, M.2 2280',
      '"wifi.slot": "yok" kaynağı tanımlı değil',
      '"gpus": { value, source } biçiminde olmalı'
    ])
  })

  it('aynı id iki kez yüklenmez; bozuk JSON bildirilir', () => {
    const r = parseLaptopFiles([...files, { ...files[0], name: 'kopya.json' }, { name: 'bozuk.json', content: '{' }])
    expect(r.errors.map((e) => e.file)).toEqual(['kopya.json', 'bozuk.json'])
  })
})

describe('okunan bilgisayarla eşleştirme', () => {
  const { profiles } = parseLaptopFiles(files)

  it('Windows\'un üretici ve model adıyla', () => {
    expect(findLaptopProfile(reading('Dell Inc.', 'Dell G15 5520'), profiles)?.id).toBe('dell-g15-5520')
    expect(findLaptopProfile(reading('dell inc. ', 'DELL  G15 5520'), profiles)?.id).toBe('dell-g15-5520')
    expect(findLaptopProfile(reading('Dell Inc.', 'Dell G15 5530'), profiles)).toBeNull()
    expect(findLaptopProfile(reading('', ''), profiles)).toBeNull()
  })

  it('işlemci ve ekran kartı seçenekleri', () => {
    const p = profiles.find((x) => x.id === 'dell-g15-5520')!
    expect(matchGpuOption('NVIDIA GeForce RTX 3060 Laptop GPU', p.gpus.value!)).toMatchObject({ vramGb: 6 })
    expect(matchGpuOption('NVIDIA GeForce RTX 3060 Ti Laptop GPU', p.gpus.value!)).toBeNull()
    expect(matchGpuOption('Intel(R) Iris(R) Xe Graphics', p.gpus.value!)).toBeNull()
    expect(matchCpuOption('12th Gen Intel(R) Core(TM) i7-12700H', p.cpus.value!)).toMatchObject({ cores: 14, threads: 20 })
    expect(matchCpuOption('12th Gen Intel(R) Core(TM) i7-12800H', p.cpus.value!)).toBeNull()
  })
})
