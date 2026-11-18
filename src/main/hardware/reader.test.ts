import { describe, expect, it } from 'vitest'
import { HARDWARE_SCRIPT, readHardware } from './reader'

// PowerShell çalıştırılmaz: sahte çıktı verilir. Değerler test değeridir.

describe('donanım okuyucu', () => {
  it('betiği çalıştırır, çıktıyı çözer, okuma zamanını ekler', async () => {
    let script = ''
    const reading = await readHardware(
      async (s) => {
        script = s
        return 'uyarı satırı\r\n{"system":{"Manufacturer":"Test","Model":"Test Laptop","PCSystemType":2},"cpu":{"Name":"Test CPU","NumberOfCores":4,"NumberOfLogicalProcessors":8}}\r\n'
      },
      () => new Date('2026-11-18T10:00:00Z')
    )
    expect(script).toBe(HARDWARE_SCRIPT)
    expect(reading.readAt).toBe('2026-11-18T10:00:00.000Z')
    expect(reading.system).toMatchObject({ model: 'Test Laptop', isLaptop: true })
    expect(reading.cpus).toEqual([{ name: 'Test CPU', cores: 4, threads: 8 }])
  })

  it('çözülemeyen çıktıda anlaşılır hata', async () => {
    await expect(readHardware(async () => 'beklenmeyen çıktı')).rejects.toThrow('donanım bilgisi çözülemedi')
  })

  it('betik seri numarası okumaz ve çift tırnak içermez', () => {
    expect(HARDWARE_SCRIPT).not.toMatch(/serial/i)
    expect(HARDWARE_SCRIPT).not.toContain('"')
  })
})
