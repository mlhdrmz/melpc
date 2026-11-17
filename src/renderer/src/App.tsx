import { useEffect, useState, type ReactElement } from 'react'
import type { CatalogPayload } from '@shared/api'
import { ChipLogo } from './components/icons'
import { BuildPage } from './pages/BuildPage'

type LoadState = { status: 'loading' } | { status: 'ready'; catalog: CatalogPayload } | { status: 'error'; message: string }

export function App(): ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    window.melpc
      .getCatalog()
      .then((catalog) => setState({ status: 'ready', catalog }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <ChipLogo />
            <span className="brand__name">MELPC</span>
          </div>
          <nav aria-label="Ana menü" className="main-nav">
            <span className="main-nav__item main-nav__item--active" aria-current="page">
              Kasa Topla
            </span>
          </nav>
          <div className="header-status">
            <span className="status-dot" aria-hidden="true" />
            Fiyatlar: henüz yok
          </div>
        </div>
      </header>
      <main className="app-main">
        {state.status === 'loading' && <p className="muted">Katalog yükleniyor…</p>}
        {state.status === 'error' && <p className="error-text">Katalog yüklenemedi: {state.message}</p>}
        {state.status === 'ready' && <BuildPage catalog={state.catalog} />}
      </main>
    </div>
  )
}
