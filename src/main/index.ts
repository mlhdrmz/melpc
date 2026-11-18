import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { parseCatalogFiles } from '../engines/catalog/loader'
import { resolvePart } from '../engines/catalog/validate'
import { CATEGORY_IDS } from '../engines/catalog/types'
import { parseBenchmarkFiles } from '../engines/benchmark/validate'
import { STORE_IDS, type StoreId } from '../engines/price/types'
import { IPC, type BuildSelection, type CatalogPayload, type SaveBuildInput } from '../shared/api'
import { MelpcDb } from './db'
import { PriceService } from './price/service'

let db: MelpcDb
let price: PriceService
let catalog: CatalogPayload = { parts: [], errors: [], benchmarks: { results: [], sources: {} } }

/** `data/catalog/*.json` dosyalarını okur, doğrular ve veritabanına yükler. */
function loadCatalog(): void {
  const dir = join(app.getAppPath(), 'data', 'catalog')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))
  const { records, errors } = parseCatalogFiles(files)
  db.replaceCatalog(records)
  // Performans ölçümleri katalogla birlikte doğrulanır (katalogda olmayan parçanın ölçümü yüklenmez).
  const benchDir = join(app.getAppPath(), 'data', 'benchmarks')
  const benchFiles = readdirSync(benchDir)
    .filter((f) => f.endsWith('.json'))
    .map((name) => ({ name, content: readFileSync(join(benchDir, name), 'utf8') }))
  const bench = parseBenchmarkFiles(benchFiles, records)
  for (const e of bench.errors) {
    errors.push({ file: `benchmarks/${e.file}`, message: `${e.index !== undefined ? `#${e.index}: ` : ''}${e.message}` })
  }
  catalog = { parts: db.readCatalog().map(resolvePart), errors, benchmarks: { results: bench.results, sources: bench.sources } }
  for (const e of errors) console.warn(`[katalog] ${e.file}${e.partId ? ` / ${e.partId}` : ''}: ${e.message}`)
  console.log(`[katalog] ${catalog.parts.length} parça, ${bench.results.length} ölçüm yüklendi, ${errors.length} hata.`)
}

function isValidSelection(v: unknown): v is BuildSelection {
  if (typeof v !== 'object' || v === null) return false
  const sel = v as Record<string, unknown>
  if (!Array.isArray(sel.storage) || !sel.storage.every((s) => typeof s === 'string')) return false
  return Object.entries(sel).every(
    ([k, val]) =>
      (CATEGORY_IDS as readonly string[]).includes(k) && (k === 'storage' || val === undefined || typeof val === 'string')
  )
}

function registerIpc(): void {
  ipcMain.handle(IPC.getCatalog, () => catalog)
  ipcMain.handle(IPC.listBuilds, () => db.listBuilds())
  ipcMain.handle(IPC.saveBuild, (_e, input: SaveBuildInput) => {
    const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 120) : ''
    if (!name) throw new Error('Toplamanın adı boş olamaz')
    if (!isValidSelection(input.selection)) throw new Error('Geçersiz toplama')
    const id = Number.isInteger(input.id) ? input.id : undefined
    return db.saveBuild({ id, name, selection: input.selection })
  })
  ipcMain.handle(IPC.deleteBuild, (_e, id: unknown) => {
    if (!Number.isInteger(id)) throw new Error('Geçersiz id')
    db.deleteBuild(id as number)
  })

  // Fiyat motoru. Arayüzden gelen her değer burada denetlenir.
  const partId = (v: unknown): string => {
    if (typeof v !== 'string' || !catalog.parts.some((p) => p.id === v)) throw new Error('Geçersiz parça')
    return v
  }
  const storeId = (v: unknown): StoreId => {
    if (!(STORE_IDS as readonly unknown[]).includes(v)) throw new Error('Geçersiz mağaza')
    return v as StoreId
  }
  ipcMain.handle(IPC.priceState, () => price.state())
  ipcMain.handle(IPC.priceUpdate, () => price.update('manual'))
  ipcMain.handle(IPC.priceFindMatches, (_e, ids: unknown) =>
    price.findMatches(ids === undefined ? undefined : Array.isArray(ids) ? ids.map(partId) : [partId(ids)])
  )
  ipcMain.handle(IPC.priceDecide, (_e, p: unknown, s: unknown, d: unknown) => {
    if (d !== 'confirm' && d !== 'reject') throw new Error('Geçersiz karar')
    return price.decide(partId(p), storeId(s), d)
  })
  ipcMain.handle(IPC.priceConfirmCodes, () => price.confirmCodeMatches())
  ipcMain.handle(IPC.priceSetUrl, (_e, p: unknown, s: unknown, url: unknown) => {
    if (typeof url !== 'string' || url.length > 2000) throw new Error('Geçersiz link')
    return price.setUrl(partId(p), storeId(s), url)
  })
  ipcMain.handle(IPC.priceCancel, () => price.cancel())
  ipcMain.handle(IPC.priceHistory, (_e, p: unknown) => price.history(partId(p)))
  ipcMain.handle(IPC.priceReadSystem, (_e, url: unknown) => {
    if (typeof url !== 'string' || url.length > 2000) throw new Error('Geçersiz link')
    return price.readSystem(url)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'MelPC',
    backgroundColor: '#0b0a10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Uygulama içinde başka bir sayfaya gidilmez; dış linkler (ör. kaynak linkleri) tarayıcıda açılır.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  db = await MelpcDb.open(join(app.getPath('userData'), 'melpc.sqlite'), dirname(require.resolve('sql.js')))
  loadCatalog()
  price = new PriceService({
    db,
    parts: () => catalog.parts,
    cacheDir: join(app.getPath('userData'), 'price-cache'),
    onChange: (state) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.priceChanged, state)
    }
  })
  registerIpc()
  createWindow()
  // Otomatik fiyat güncellemesi: açılıştan kısa süre sonra ve uygulama açık kaldıkça saatte bir bakılır.
  // Son güncellemeden 12 saat geçmediyse ya da günlük sınır doluysa bir şey yapılmaz.
  setTimeout(() => price.update('auto'), 20_000)
  setInterval(() => price.update('auto'), 60 * 60 * 1000)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
