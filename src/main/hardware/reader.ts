import { execFile } from 'node:child_process'
import { parseHardwareJson } from '../../engines/hardware/parse'
import type { HardwareReading } from '../../engines/hardware/types'

// Donanım okuma (Melih onayladı, 5. aşama): Windows'un kendi donanım bilgisi (WMI/CIM) PowerShell ile okunur.
// - Yalnızca "Oku"ya basınca çalışır; internete bir şey gitmez; ek paket yoktur.
// - Seri numarası alanları sorguda yoktur.
// Betikte yalnızca tek tırnak kullanılır (komut satırında kaçış sorunu olmasın).

export const HARDWARE_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Q([string]$class, [string[]]$props, [string]$ns = 'root/cimv2') {
  try { @(Get-CimInstance -Namespace $ns -ClassName $class | Select-Object -Property $props) } catch { @() }
}
$r = [ordered]@{
  system      = Q 'Win32_ComputerSystem' @('Manufacturer', 'Model', 'SystemFamily', 'PCSystemType')
  enclosure   = Q 'Win32_SystemEnclosure' @('ChassisTypes')
  cpu         = Q 'Win32_Processor' @('Name', 'NumberOfCores', 'NumberOfLogicalProcessors')
  gpu         = Q 'Win32_VideoController' @('Name')
  memory      = Q 'Win32_PhysicalMemory' @('Capacity', 'Speed', 'ConfiguredClockSpeed', 'FormFactor', 'SMBIOSMemoryType', 'DeviceLocator', 'PartNumber')
  memoryArray = Q 'Win32_PhysicalMemoryArray' @('MemoryDevices', 'Use')
  disk        = Q 'MSFT_PhysicalDisk' @('FriendlyName', 'BusType', 'MediaType', 'Size') 'root/Microsoft/Windows/Storage'
  network     = Q 'Win32_NetworkAdapter' @('Name', 'PhysicalAdapter')
  board       = Q 'Win32_BaseBoard' @('Manufacturer', 'Product')
}
$r | ConvertTo-Json -Depth 5 -Compress
`

export type RunPowerShell = (script: string) => Promise<string>

export const runPowerShell: RunPowerShell = (script) =>
  new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || error.message).trim().split('\n')[0]
          reject(new Error(`Windows'un donanım bilgisi okunamadı: ${detail}`))
        } else resolve(String(stdout))
      }
    )
  })

/** Betiği çalıştırır ve sonucu çözer. */
export async function readHardware(run: RunPowerShell = runPowerShell, now: () => Date = () => new Date()): Promise<HardwareReading> {
  const out = (await run(HARDWARE_SCRIPT)).trim()
  let json: unknown
  try {
    json = JSON.parse(out.slice(out.indexOf('{')))
  } catch {
    throw new Error("Windows'un donanım bilgisi çözülemedi.")
  }
  return parseHardwareJson(json, now().toISOString())
}
