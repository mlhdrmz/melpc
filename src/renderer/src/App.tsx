import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { CatalogPayload } from '@shared/api'
import { ChipLogo } from './components/icons'
import { BuildPage } from './pages/BuildPage'
import { MatchPage } from './pages/MatchPage'
import { PriceProvider, usePrices } from './price/PriceContext'
import { PriceStatus } from './price/PriceStatus'
import { CatalogProvider } from './catalog/CatalogContext'
import { CompareProvider, useCompare } from './compare/CompareContext'
import { ComparePage } from './pages/ComparePage'
import { MyPcPage } from './pages/MyPcPage'

type LoadState = { status: 'loading' } | { status: 'ready'; catalog: CatalogPayload } | { status: 'error'; message: string }
type Page = 'build' | 'compare' | 'match' | 'mypc'

export function App(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [page, setPage] = useState<Page>('build')
  // Bilgisayarım ilk açılışta kurulur, sonra gizlenir ama kapanmaz (3D görünüm sayfa değişince kapatılmasın).
  const [myPcOpened, setMyPcOpened] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const notify = useCallback((message: string) => setToast(message || null), [])

  useEffect(() => {
    window.melpc
      .getCatalog()
      .then((catalog) => setState({ status: 'ready', catalog }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
  }, [])

  useEffect(() => {
    if (page === 'mypc') setMyPcOpened(true)
  }, [page])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), Math.min(9000, 3500 + toast.length * 30))
    return () => clearTimeout(t)
  }, [toast])

  return (
    <PriceProvider notify={notify}>
      <CompareProvider>
      <div className="app">
        <header className="app-header">
          <div className="app-header__inner">
            <div className="brand">
              <ChipLogo />
              <span className="brand__name">MELPC</span>
            </div>
            <MainNav page={page} onChange={setPage} />
            <PriceStatus />
          </div>
        </header>
        <main className="app-main">
          {state.status === 'loading' && <p className="muted">Katalog yükleniyor…</p>}
          {state.status === 'error' && <p className="error-text">Katalog yüklenemedi: {state.message}</p>}
          {state.status === 'ready' && (
            <CatalogProvider catalog={state.catalog}>
              {/* Kasa Topla ekranı gizlenir ama kapanmaz: başka ekrana geçip dönünce toplama kaybolmasın. */}
              <div hidden={page !== 'build'}>
                <BuildPage catalog={state.catalog} />
              </div>
              {page === 'match' && <MatchPage catalog={state.catalog} />}
              {page === 'compare' && <ComparePage />}
              {/* Bilgisayarım da 3D görünüm içerdiği için gizlenir ama kapanmaz. */}
              {(myPcOpened || page === 'mypc') && (
                <div hidden={page !== 'mypc'}>
                  <MyPcPage />
                </div>
              )}
            </CatalogProvider>
          )}
        </main>
        {toast && (
          <div className="toast toast--app" role="status">
            {toast}
          </div>
        )}
      </div>
      </CompareProvider>
    </PriceProvider>
  )
}

function MainNav({ page, onChange }: { page: Page; onChange: (p: Page) => void }): ReactElement {
  const { state } = usePrices()
  const { count } = useCompare()
  const pending = state?.matches.filter((m) => m.status === 'candidate').length ?? 0
  const item = (p: Page, label: string, extra?: ReactElement): ReactElement => (
    <button
      type="button"
      className={`main-nav__item${page === p ? ' main-nav__item--active' : ''}`}
      aria-current={page === p ? 'page' : undefined}
      onClick={() => onChange(p)}
    >
      {label}
      {extra}
    </button>
  )
  return (
    <nav aria-label="Ana menü" className="main-nav">
      {item('build', 'Kasa Topla')}
      {item(
        'compare',
        'Karşılaştır',
        count > 0 ? (
          <span className="nav-count" title={`Karşılaştırma listesinde ${count} öğe`}>
            {count}
          </span>
        ) : undefined
      )}
      {item(
        'match',
        'Mağaza eşleştirme',
        pending > 0 ? (
          <span className="nav-count" title={`${pending} eşleşme onay bekliyor`}>
            {pending}
          </span>
        ) : undefined
      )}
      {item('mypc', 'Bilgisayarım')}
    </nav>
  )
}
