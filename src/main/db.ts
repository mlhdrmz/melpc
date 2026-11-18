import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import initSqlJs, { type Database } from 'sql.js'
import type { PartRecord, SourceRef, SpecEntry } from '../engines/catalog/types'
import type { BuildSelection, SavedBuild } from '../shared/api'
import type { OfferRecord, ParsedProduct, StoreId, StoreMatch } from '../engines/price/types'

// SQLite (sql.js, WebAssembly): Windows'ta derleme aracı gerektirmez.
// Veritabanı bellekte açılır ve her yazmadan sonra dosyaya kaydedilir.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  mpn TEXT,
  added_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS part_sources (
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  retrieved TEXT NOT NULL,
  PRIMARY KEY (part_id, key)
);
CREATE TABLE IF NOT EXISTS part_specs (
  part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT,
  source_key TEXT,
  note TEXT,
  PRIMARY KEY (part_id, key)
);
CREATE TABLE IF NOT EXISTS builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  selection_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS parts_category ON parts(category);

-- Fiyat motoru (3. aşama). Katalog her açılışta yeniden yüklendiği için bu tablolar parts'a bağlı değil.
CREATE TABLE IF NOT EXISTS store_matches (
  part_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT,
  product_json TEXT,
  code_check TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (part_id, store_id)
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  url TEXT NOT NULL,
  price REAL,
  in_stock INTEGER,
  fetched_at TEXT NOT NULL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS offers_part_store ON offers(part_id, store_id, fetched_at);
CREATE TABLE IF NOT EXISTS price_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary TEXT
);
`

export class MelpcDb {
  private constructor(
    private readonly db: Database,
    private readonly file: string
  ) {}

  /** @param wasmDir sql.js'nin `sql-wasm.wasm` dosyasının bulunduğu klasör. */
  static async open(file: string, wasmDir: string): Promise<MelpcDb> {
    const SQL = await initSqlJs({ locateFile: (f: string) => join(wasmDir, f) })
    const db = existsSync(file) ? new SQL.Database(readFileSync(file)) : new SQL.Database()
    db.run('PRAGMA foreign_keys = ON;')
    db.run(SCHEMA)
    return new MelpcDb(db, file)
  }

  /** Dosyaya önce geçici bir kopya yazar, sonra yerine taşır (yarım kalan yazma veritabanını bozmasın). */
  persist(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, Buffer.from(this.db.export()))
    renameSync(tmp, this.file)
  }

  /** Katalog tablolarını JSON dosyalarından gelen kayıtlarla baştan doldurur. Kayıtlı toplamalara dokunmaz. */
  replaceCatalog(records: PartRecord[]): void {
    this.db.run('BEGIN')
    try {
      this.db.run('DELETE FROM part_specs; DELETE FROM part_sources; DELETE FROM parts;')
      const insPart = this.db.prepare(
        'INSERT INTO parts (id, category, brand, model, mpn, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      const insSource = this.db.prepare(
        'INSERT INTO part_sources (part_id, key, url, title, retrieved) VALUES (?, ?, ?, ?, ?)'
      )
      const insSpec = this.db.prepare(
        'INSERT INTO part_specs (part_id, key, value_json, source_key, note) VALUES (?, ?, ?, ?, ?)'
      )
      for (const r of records) {
        insPart.run([r.id, r.category, r.brand, r.model, r.mpn ?? null, r.addedAt, r.updatedAt])
        for (const [key, s] of Object.entries(r.sources)) {
          insSource.run([r.id, key, s.url, s.title ?? null, s.retrieved])
        }
        for (const [key, s] of Object.entries(r.specs)) {
          insSpec.run([
            r.id,
            key,
            s.value === null ? null : JSON.stringify(s.value),
            s.source ?? null,
            s.note ?? null
          ])
        }
      }
      insPart.free()
      insSource.free()
      insSpec.free()
      this.db.run('COMMIT')
    } catch (e) {
      this.db.run('ROLLBACK')
      throw e
    }
    this.persist()
  }

  /** Katalogdaki bütün parçaları kayıt biçiminde okur. */
  readCatalog(): PartRecord[] {
    const byId = new Map<string, PartRecord>()
    for (const row of this.all('SELECT * FROM parts ORDER BY category, brand, model')) {
      byId.set(row.id as string, {
        id: row.id as string,
        category: row.category as PartRecord['category'],
        brand: row.brand as string,
        model: row.model as string,
        ...(row.mpn ? { mpn: row.mpn as string } : {}),
        sources: {},
        specs: {},
        addedAt: row.added_at as string,
        updatedAt: row.updated_at as string
      })
    }
    for (const row of this.all('SELECT * FROM part_sources')) {
      const p = byId.get(row.part_id as string)
      if (!p) continue
      const src: SourceRef = { url: row.url as string, retrieved: row.retrieved as string }
      if (row.title) src.title = row.title as string
      p.sources[row.key as string] = src
    }
    for (const row of this.all('SELECT * FROM part_specs')) {
      const p = byId.get(row.part_id as string)
      if (!p) continue
      const spec: SpecEntry = { value: row.value_json === null ? null : JSON.parse(row.value_json as string) }
      if (row.source_key) spec.source = row.source_key as string
      if (row.note) spec.note = row.note as string
      p.specs[row.key as string] = spec
    }
    return [...byId.values()]
  }

  listBuilds(): SavedBuild[] {
    return this.all('SELECT * FROM builds ORDER BY updated_at DESC').map(toSavedBuild)
  }

  saveBuild(input: { id?: number; name: string; selection: BuildSelection }): SavedBuild {
    const now = new Date().toISOString()
    const json = JSON.stringify(input.selection)
    let id = input.id
    if (id !== undefined && this.all('SELECT id FROM builds WHERE id = ?', [id]).length) {
      this.db.run('UPDATE builds SET name = ?, selection_json = ?, updated_at = ? WHERE id = ?', [
        input.name,
        json,
        now,
        id
      ])
    } else {
      this.db.run('INSERT INTO builds (name, selection_json, created_at, updated_at) VALUES (?, ?, ?, ?)', [
        input.name,
        json,
        now,
        now
      ])
      id = this.all('SELECT last_insert_rowid() AS id')[0].id as number
    }
    this.persist()
    return toSavedBuild(this.all('SELECT * FROM builds WHERE id = ?', [id])[0])
  }

  deleteBuild(id: number): void {
    this.db.run('DELETE FROM builds WHERE id = ?', [id])
    this.persist()
  }

  // ---------- Fiyat motoru ----------

  listMatches(): StoreMatch[] {
    return this.all('SELECT * FROM store_matches').map((r) => ({
      partId: r.part_id as string,
      storeId: r.store_id as StoreId,
      status: r.status as StoreMatch['status'],
      ...(r.url ? { url: r.url as string } : {}),
      ...(r.product_json ? { product: JSON.parse(r.product_json as string) as ParsedProduct } : {}),
      ...(r.code_check ? { codeCheck: r.code_check as StoreMatch['codeCheck'] } : {}),
      updatedAt: r.updated_at as string
    }))
  }

  upsertMatch(m: StoreMatch, persist = true): void {
    this.db.run(
      `INSERT INTO store_matches (part_id, store_id, status, url, product_json, code_check, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(part_id, store_id) DO UPDATE SET status = excluded.status, url = excluded.url,
         product_json = excluded.product_json, code_check = excluded.code_check, updated_at = excluded.updated_at`,
      [m.partId, m.storeId, m.status, m.url ?? null, m.product ? JSON.stringify(m.product) : null, m.codeCheck ?? null, m.updatedAt]
    )
    if (persist) this.persist()
  }

  deleteMatch(partId: string, storeId: StoreId): void {
    this.db.run('DELETE FROM store_matches WHERE part_id = ? AND store_id = ?', [partId, storeId])
    this.persist()
  }

  /** Fiyat okumasını ekler. Çok sayıda yazmada `persist` çağrıyı yapan tarafa bırakılır. */
  addOffer(o: OfferRecord, persist = false): void {
    this.db.run(
      'INSERT INTO offers (part_id, store_id, url, price, in_stock, fetched_at, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [o.partId, o.storeId, o.url, o.price, o.inStock === null ? null : o.inStock ? 1 : 0, o.fetchedAt, o.error ?? null]
    )
    if (persist) this.persist()
  }

  /** Her parça ve mağaza için son okuma. */
  latestOffers(): OfferRecord[] {
    return this.all(
      `SELECT o.* FROM offers o
       JOIN (SELECT part_id, store_id, MAX(id) AS id FROM offers GROUP BY part_id, store_id) last ON last.id = o.id`
    ).map(toOffer)
  }

  /** Her parça ve mağaza için fiyatı okunabilmiş son okuma (okuma hatalarında eski fiyatı göstermek için). */
  latestPricedOffers(): OfferRecord[] {
    return this.all(
      `SELECT o.* FROM offers o
       JOIN (SELECT part_id, store_id, MAX(id) AS id FROM offers WHERE price IS NOT NULL GROUP BY part_id, store_id) last
       ON last.id = o.id`
    ).map(toOffer)
  }

  offerHistory(partId: string): OfferRecord[] {
    return this.all('SELECT * FROM offers WHERE part_id = ? AND price IS NOT NULL ORDER BY fetched_at', [partId]).map(toOffer)
  }

  startRun(kind: 'update' | 'match', startedAt: string): number {
    this.db.run('INSERT INTO price_runs (kind, started_at) VALUES (?, ?)', [kind, startedAt])
    const id = this.all('SELECT last_insert_rowid() AS id')[0].id as number
    this.persist()
    return id
  }

  finishRun(id: number, finishedAt: string, summary: string): void {
    this.db.run('UPDATE price_runs SET finished_at = ?, summary = ? WHERE id = ?', [finishedAt, summary, id])
    this.persist()
  }

  listRuns(kind: 'update' | 'match', limit = 20): { startedAt: string; finishedAt?: string; summary?: string }[] {
    return this.all('SELECT * FROM price_runs WHERE kind = ? ORDER BY id DESC LIMIT ?', [kind, limit]).map((r) => ({
      startedAt: r.started_at as string,
      ...(r.finished_at ? { finishedAt: r.finished_at as string } : {}),
      ...(r.summary ? { summary: r.summary as string } : {})
    }))
  }

  private all(sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    const rows: Record<string, unknown>[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }
}

function toOffer(r: Record<string, unknown>): OfferRecord {
  return {
    partId: r.part_id as string,
    storeId: r.store_id as StoreId,
    url: r.url as string,
    price: r.price === null ? null : (r.price as number),
    inStock: r.in_stock === null ? null : r.in_stock === 1,
    fetchedAt: r.fetched_at as string,
    ...(r.error ? { error: r.error as string } : {})
  }
}

function toSavedBuild(row: Record<string, unknown>): SavedBuild {
  return {
    id: row.id as number,
    name: row.name as string,
    selection: JSON.parse(row.selection_json as string) as BuildSelection,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}
