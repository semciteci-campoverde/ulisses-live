import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/Home'
import { ParticiparPage } from './pages/Participar'

const AdminPage = lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminPage })))
const GaleriaPage = lazy(() => import('./pages/Galeria').then((m) => ({ default: m.GaleriaPage })))
const MemoriasPage = lazy(() => import('./pages/Memorias').then((m) => ({ default: m.MemoriasPage })))
const PrivacidadePage = lazy(() => import('./pages/Privacidade').then((m) => ({ default: m.PrivacidadePage })))
const QrPage = lazy(() => import('./pages/Qr').then((m) => ({ default: m.QrPage })))
const TvPage = lazy(() => import('./pages/Tv').then((m) => ({ default: m.TvPage })))

function Waiting() {
  return <div className="sky-page" style={{ padding: 32 }}>Carregando…</div>
}

export function App() {
  return (
    <Suspense fallback={<Waiting />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/participar" element={<ParticiparPage />} />
        <Route path="/tv" element={<TvPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/qr" element={<QrPage />} />
        <Route path="/galeria" element={<GaleriaPage />} />
        <Route path="/memorias" element={<MemoriasPage />} />
        <Route path="/privacidade" element={<PrivacidadePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  )
}
