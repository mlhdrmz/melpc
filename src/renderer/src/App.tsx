import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { CatalogPayload } from '@shared/api'
import { ChipLogo } from './components/icons'
import { BuildPage } from './pages/BuildPage'
import { MatchPage } from './pages/MatchPage'
import { PriceProvider, usePrices } from './price/PriceContext'
import { PriceStatus } from './price/PriceStatus'

type LoadState = { status: 'loading' } | { status: 'ready'; catalog: CatalogPayload } | { status: 'error'; message: string }
type Page = 'build' | 'match'

export function App(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [page, setPage] = useState<Page>('build')
  const [toast, setToast] = useState<string | null>(null)
  const notify = useCallback((message: string) => setToast(message || null), [])

  useEffect(() => {
    window.melpc
      .getCatalog()
      .then((catalog) => setState({ status: 'ready', catalog }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), Math.min(9000, 3500 + toast.length * 30))
    return () => clearTimeout(t)
  }, [toast])

  return (
    <PriceProvider notify={notify}>
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
            <>
              {/* Kasa Topla ekranı gizlenir ama kapanmaz: başka ekrana geçip dönünce toplama kaybolmasın. */}
              <div hidden={page !== 'build'}>
                <BuildPage catalog={state.catalog} />
              </div>
              {page === 'match' && <MatchPage catalog={state.catalog} />}
            </>
          )}
        </main>
        {toast && (
          <div className="toast toast--app" role="status">
            {toast}
          </div>
        )}
      </div>
    </PriceProvider>
  )
}

function MainNav({ page, onChange }: { page: Page; onChange: (p: Page) => void }): ReactElement {
  const { state } = usePrices()
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
        'match',
        'Mağaza eşleştirme',
        pending > 0 ? (
          <span className="nav-count" title={`${pending} eşleşme onay bekliyor`}>
            {pending}
          </span>
        ) : undefined
      )}
    </nav>
  )
}
