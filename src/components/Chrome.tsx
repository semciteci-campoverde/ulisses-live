import { Link } from 'react-router-dom'
import type { PublicEvent } from '../../shared/types.ts'
import { withEvent } from '../lib/paths.ts'
import { SchoolLogo } from './Sky.tsx'

export function Topbar({ event, slug }: { event?: PublicEvent | null; slug: string }) {
  return (
    <header className="topbar no-print">
      <Link to={withEvent('/', slug)} className="brand-lockup" style={{ textDecoration: 'none' }}>
        <SchoolLogo src={event?.logoUrl} />
        <div>
          <div className="cinzel" style={{ fontSize: 11, color: 'var(--gold-2)' }}>EECM Ulisses Guimarães</div>
          <strong>ULISSES LIVE</strong>
        </div>
      </Link>
      <nav className="nav-links">
        <Link to={withEvent('/participar', slug)}>Participar</Link>
        <Link to={withEvent('/tv', slug)}>TV</Link>
        <Link to={withEvent('/galeria', slug)}>Galeria</Link>
        <Link to={withEvent('/qr', slug)}>QR Code</Link>
        <Link to="/admin">Equipe</Link>
      </nav>
    </header>
  )
}

export function DemoBanner({ show }: { show?: boolean }) {
  if (!show) return null
  return (
    <div className="banner-demo">
      MODO DEMONSTRAÇÃO — estes registros não fazem parte da Feira do Conhecimento real
    </div>
  )
}

export function Footer({ slug }: { slug: string }) {
  return (
    <footer className="no-print" style={{ position: 'relative', zIndex: 1, padding: '1.2rem', textAlign: 'center', opacity: 0.8, fontSize: 14 }}>
      <div>Escola Estadual Cívico-Militar Ulisses Guimarães · Campo Verde — MT</div>
      <div style={{ marginTop: 6 }}>
        <Link to={withEvent('/privacidade', slug)}>Privacidade e uso de imagem</Link>
        {' · '}
        <a href="https://www.instagram.com/e.e.c.m.ulissesguimaraes/" target="_blank" rel="noreferrer">
          Instagram
        </a>
      </div>
    </footer>
  )
}
