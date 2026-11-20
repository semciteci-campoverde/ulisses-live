import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NotConfigured, Spinner } from './components/ui'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import Participate from './pages/Participate'

const TV = lazy(() => import('./pages/TV'))
const Admin = lazy(() => import('./pages/admin/Admin'))
const QRPage = lazy(() => import('./pages/QRPage'))
const Gallery = lazy(() => import('./pages/Gallery'))
const Memories = lazy(() => import('./pages/Memories'))

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/participar" element={<Participate />} />
          <Route path="/tv" element={<TV />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/qr" element={<QRPage />} />
          <Route path="/galeria" element={<Gallery />} />
          <Route path="/memorias" element={<Memories />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
