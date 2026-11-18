// Mağazaları yormamak için çekim sınırı (Melih onayladı):
// - Uygulama açılınca son çekimden 12 saat geçmişse otomatik çekim.
// - "Şimdi güncelle" de dahil son 24 saatte en fazla 2 çekim.

export const AUTO_INTERVAL_MS = 12 * 60 * 60 * 1000
export const WINDOW_MS = 24 * 60 * 60 * 1000
export const MAX_RUNS_PER_WINDOW = 2

/** runStarts: önceki çekimlerin başlangıç zamanları (ISO). */
export function runsInWindow(runStarts: string[], now: number): number {
  return runStarts.filter((s) => now - Date.parse(s) < WINDOW_MS).length
}

export function canRunNow(runStarts: string[], now: number): boolean {
  return runsInWindow(runStarts, now) < MAX_RUNS_PER_WINDOW
}

export function shouldAutoRun(runStarts: string[], now: number): boolean {
  const last = runStarts.map((s) => Date.parse(s)).sort((a, b) => b - a)[0]
  return canRunNow(runStarts, now) && (last === undefined || now - last >= AUTO_INTERVAL_MS)
}

/** Bir sonraki çekimin mümkün olacağı zaman (ms). Şimdi mümkünse now. */
export function nextAllowedAt(runStarts: string[], now: number): number {
  if (canRunNow(runStarts, now)) return now
  const inWindow = runStarts
    .map((s) => Date.parse(s))
    .filter((t) => now - t < WINDOW_MS)
    .sort((a, b) => a - b)
  // En eski çekim pencereden çıkınca yer açılır.
  return inWindow[inWindow.length - MAX_RUNS_PER_WINDOW] + WINDOW_MS
}
