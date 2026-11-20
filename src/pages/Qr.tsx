import { useSearchParams } from 'react-router-dom'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { QrImage } from '../components/QrImage.tsx'
import { SchoolLogo } from '../components/Sky.tsx'
import { Sky } from '../components/Sky.tsx'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

export function QrPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event } = useLiveEvent(slug)
  const origin = window.location.origin
  const presence = origin + withEvent('/participar', slug)

  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <div className="no-print">
        <Topbar event={event} slug={slug} />
      </div>
      <main className="page-wrap">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h1 className="display gold-text" style={{ fontSize: 64, margin: 0 }}>QR Codes</h1>
            <p>Imprima o QR de presença e o QR do Instagram. Eles são visualmente diferentes de propósito.</p>
          </div>
          <button className="btn-gold" onClick={() => window.print()}>Imprimir</button>
        </div>
        <section className="print-sheet glass" style={{ borderRadius: 28, padding: '1.4rem', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, alignItems: 'center' }}>
          <div>
            <SchoolLogo src={event?.logoUrl} />
            <p className="cinzel" style={{ color: '#9bbcff' }}>Presença no evento</p>
            <h2 className="display" style={{ fontSize: 54, margin: 0 }}>Escaneie. Participe. Compartilhe.</h2>
            <p>Registre sua presença e faça parte da nossa história. {event?.name}</p>
            <p style={{ wordBreak: 'break-all' }}>{presence}</p>
          </div>
          <div className="qr-frame">
            <QrImage value={presence} label="QR Code de presença" />
          </div>
        </section>
        <section className="print-sheet" style={{ borderRadius: 28, padding: '1.4rem', marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, alignItems: 'center', background: 'linear-gradient(135deg, #2a1248, #12306d)' }}>
          <div>
            <p className="cinzel" style={{ color: '#ffd0ea' }}>Instagram oficial — QR diferente</p>
            <h2 className="display" style={{ fontSize: 48, margin: 0 }}>Conecte-se com a nossa escola!</h2>
            <p>{event?.instagramHandle}</p>
            <p>Acompanhe projetos, conquistas e os melhores momentos da feira. Este código não registra presença.</p>
          </div>
          <div className="qr-frame ig">
            <QrImage value={event?.instagramUrl || 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/'} label="QR Code do Instagram" dark="#4f5bd5" />
          </div>
        </section>
      </main>
      <Footer slug={slug} />
    </div>
  )
}
