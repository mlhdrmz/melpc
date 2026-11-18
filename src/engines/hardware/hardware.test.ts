import { describe, expect, it } from 'vitest'
import { normalizeDeviceName, parseHardwareJson } from './parse'

// Windows'un (PowerShell ConvertTo-Json) çıktısına benzetilmiş test girdileri; cihaz adları ve sayılar test değeridir.

const laptop = {
  system: [{ Manufacturer: 'Test Inc.', Model: 'Test Laptop 15', SystemFamily: 'TestSeries', PCSystemType: 2 }],
  enclosure: [{ ChassisTypes: [10] }],
  cpu: [{ Name: '12th Gen Intel(R) Core(TM) i7-12700H', NumberOfCores: 14, NumberOfLogicalProcessors: 20 }],
  gpu: [{ Name: 'Intel(R) Iris(R) Xe Graphics' }, { Name: 'NVIDIA GeForce RTX 3060 Laptop GPU' }, { Name: 'Microsoft Basic Display Adapter' }],
  memory: [
    { Capacity: 34359738368, Speed: 4800, ConfiguredClockSpeed: 4800, FormFactor: 12, SMBIOSMemoryType: 34, DeviceLocator: 'DIMM A', PartNumber: 'TEST-32G    ' },
    { Capacity: 17179869184, Speed: 5600, ConfiguredClockSpeed: 4800, FormFactor: 12, SMBIOSMemoryType: 34, DeviceLocator: 'DIMM B', PartNumber: 'TEST-16G' }
  ],
  memoryArray: [
    { MemoryDevices: 2, Use: 3 },
    { MemoryDevices: 1, Use: 7 }
  ],
  disk: [
    { FriendlyName: 'Test NVMe 1024GB', BusType: 17, MediaType: 4, Size: 1024209543168 },
    { FriendlyName: 'Test USB Disk', BusType: 7, MediaType: 0, Size: 64000000000 }
  ],
  network: [
    { Name: 'Test(R) Wi-Fi 6 AX000 Wireless Network Adapter', PhysicalAdapter: true },
    { Name: 'Test Gigabit Ethernet Controller', PhysicalAdapter: true },
    { Name: 'Microsoft Wi-Fi Direct Virtual Adapter', PhysicalAdapter: false }
  ],
  board: [{ Manufacturer: 'Test Inc.', Product: 'T0001' }]
}

describe('donanım okuma', () => {
  it('taşınabilir bilgisayarın parçaları', () => {
    const r = parseHardwareJson(laptop, '2026-11-18T10:00:00.000Z')
    expect(r.system).toEqual({ manufacturer: 'Test Inc.', model: 'Test Laptop 15', family: 'TestSeries', isLaptop: true })
    expect(r.cpus).toEqual([{ name: '12th Gen Intel(R) Core(TM) i7-12700H', cores: 14, threads: 20 }])
    // Microsoft'un yedek görüntü sürücüsü ekran kartı sayılmaz.
    expect(r.gpus.map((g) => g.name)).toEqual(['Intel(R) Iris(R) Xe Graphics', 'NVIDIA GeForce RTX 3060 Laptop GPU'])
    // Çalıştığı hız (ConfiguredClockSpeed) önce gelir; SMBIOS 34 = DDR5, form faktörü 12 = SO-DIMM.
    expect(r.memory).toEqual({
      slots: 2,
      modules: [
        { capacityGb: 32, speedMts: 4800, type: 'DDR5', formFactor: 'SO-DIMM', slot: 'DIMM A', partNumber: 'TEST-32G' },
        { capacityGb: 16, speedMts: 4800, type: 'DDR5', formFactor: 'SO-DIMM', slot: 'DIMM B', partNumber: 'TEST-16G' }
      ]
    })
    expect(r.disks).toEqual([
      { name: 'Test NVMe 1024GB', sizeGb: 1024, bus: 'NVMe', media: 'SSD' },
      { name: 'Test USB Disk', sizeGb: 64, bus: 'USB', media: null }
    ])
    // Yalnızca fiziksel kablosuz kart; Ethernet ve sanal bağdaştırıcı sayılmaz.
    expect(r.wifi).toEqual([{ name: 'Test(R) Wi-Fi 6 AX000 Wireless Network Adapter' }])
    expect(r.board).toEqual({ manufacturer: 'Test Inc.', product: 'T0001' })
  })

  it('tek elemanlı listeler nesne olarak gelse de okunur; masaüstü taşınabilir sayılmaz', () => {
    const r = parseHardwareJson(
      {
        system: { Manufacturer: 'Test', Model: 'Test Desktop', PCSystemType: 1 },
        enclosure: { ChassisTypes: 3 },
        cpu: { Name: 'AMD Ryzen 7 9800X3D 8-Core Processor', NumberOfCores: 8, NumberOfLogicalProcessors: 16 },
        memory: { Capacity: 17179869184, Speed: 6000, FormFactor: 8, SMBIOSMemoryType: 26 },
        memoryArray: { MemoryDevices: 4, Use: 3 },
        disk: { FriendlyName: 'Test SATA', BusType: 11, MediaType: 3, Size: 2000398934016 }
      },
      '2026-11-18T10:00:00.000Z'
    )
    expect(r.system.isLaptop).toBe(false)
    expect(r.cpus).toHaveLength(1)
    expect(r.memory).toEqual({
      slots: 4,
      modules: [{ capacityGb: 16, speedMts: 6000, type: 'DDR4', formFactor: 'DIMM', slot: null, partNumber: null }]
    })
    expect(r.disks).toEqual([{ name: 'Test SATA', sizeGb: 2000, bus: 'SATA', media: 'HDD' }])
    expect(r.gpus).toEqual([])
    expect(r.wifi).toEqual([])
  })

  it('bozuk ya da boş girdide boş okuma', () => {
    const r = parseHardwareJson(null, '2026-11-18T10:00:00.000Z')
    expect(r.cpus).toEqual([])
    expect(r.memory).toEqual({ slots: null, modules: [] })
    expect(r.system.isLaptop).toBe(false)
  })

  it('cihaz adları ölçüm verisiyle karşılaştırılacak biçime gelir', () => {
    expect(normalizeDeviceName('12th Gen Intel(R) Core(TM) i7-12700H')).toBe('intel core i7-12700h')
    expect(normalizeDeviceName('Intel Core i7-12700H')).toBe('intel core i7-12700h')
    expect(normalizeDeviceName('NVIDIA GeForce RTX 3060 Laptop GPU')).toBe('nvidia geforce rtx 3060 laptop gpu')
    expect(normalizeDeviceName('Intel(R) Core(TM) i7-8750H CPU @ 2.20GHz')).toBe('intel core i7-8750h')
    expect(normalizeDeviceName('AMD Ryzen 7 9800X3D 8-Core Processor')).toBe('amd ryzen 7 9800x3d 8-core')
  })
})
