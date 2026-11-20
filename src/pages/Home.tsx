import { Link, useSearchParams } from 'react-router-dom'
import { REAL_EVENT } from '../../shared/constants.ts'
import { INSTAGRAM_BLURB } from '../../shared/constants.ts'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { Sky } from '../components/Sky.tsx'
import { formatLong } from '../lib/format.ts'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

const THEMES = ['Literatura e Cultura', 'Ciência e Tecnologia', 'Meio Ambiente e Sustentabilidade', 'Sociedade e Cidadania', 'Inovação']

export function HomePage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event } = useLiveEvent(slug)
  const name = event?.name || REAL_EVENT.name
  const theme = event?.theme || REAL_EVENT.theme
  const slogan = event?.slogan || REAL_EVENT.slogan
  const internalDate = event?.internalDate || REAL_EVENT.internalDate
  const publicDate = event?.publicDate || REAL_EVENT.publicDate
  const hours = event?.publicHours || REAL_EVENT.publicHours

  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <Topbar event={event} slug={slug} />
      <main className="hero">
        <div>
          <p className="script" style={{ fontSize: 'clamp(42px, 6vw, 72px)', margin: 0 }}>Convite</p>
          <h1 className="display gold-text" style={{ fontSize: 'clamp(64px, 10vw, 116px)', margin: '0.1rem 0' }}>
            ULISSES LIVE
          </h1>
          <p className="cinzel" style={{ color: 'var(--gold-2)', marginTop: 0 }}>Feira do Conhecimento 2026</p>
          <p style={{ fontSize: '1.25rem', maxWidth: 560 }}>{theme}</p>
          <p style={{ fontSize: '1.15rem', color: 'var(--gold-2)' }}>{slogan}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '1.2rem 0' }}>
            <Link className="btn-gold" to={withEvent('/participar', slug)}>Registrar presença</Link>
            <Link className="btn-ghost" to={withEvent('/tv', slug)}>Abrir painel da TV</Link>
            <a className="btn-royal" href={event?.instagramUrl || REAL_EVENT.instagramUrl} target="_blank" rel="noreferrer">
              Seguir no Instagram
            </a>
          </div>
          <div className="stat-grid">
            <article className="glass" style={{ borderRadius: 18, padding: '0.9rem 1rem' }}>
              <div className="cinzel" style={{ fontSize: 11, color: 'var(--gold)' }}>Programação interna</div>
              <strong>{formatLong(internalDate)}</strong>
              <div style={{ opacity: 0.8 }}>Apresentações culturais e convidados</div>
            </article>
            <article className="glass" style={{ borderRadius: 18, padding: '0.9rem 1rem' }}>
              <div className="cinzel" style={{ fontSize: 11, color: 'var(--gold)' }}>Visitação aberta</div>
              <strong>{formatLong(publicDate)}</strong>
              <div style={{ opacity: 0.8 }}>{hours}</div>
            </article>
            <article className="glass" style={{ borderRadius: 18, padding: '0.9rem 1rem' }}>
              <div className="cinzel" style={{ fontSize: 11, color: 'var(--gold)' }}>Presenças por navegador</div>
              <strong style={{ fontSize: 28 }}>{event ? event.presenceCount : '—'}</strong>
              <div style={{ opacity: 0.8 }}>Não é a ocupação do momento</div>
            </article>
          </div>
        </div>
        <figure className="poster">
          <video src="/brand/convite.mp4" poster="/brand/convite.jpg" autoPlay muted loop playsInline />
        </figure>
      </main>
      <section className="page-wrap">
        <h2 className="display" style={{ fontSize: 42, marginBottom: 8 }}>Como participar</h2>
        <div className="stat-grid">
          {[
            ['1. Escaneie', 'Um único QR Code em salas, corredores e espaços da escola.'],
            ['2. Confirme', 'A presença entra na hora, sem nome, CPF, telefone ou cadastro.'],
            ['3. Compartilhe', 'Mensagem, foto, vídeo curto ou reação. A equipe revisa antes da TV.'],
          ].map(([title, text]) => (
            <article key={title} className="glass" style={{ borderRadius: 20, padding: '1rem 1.1rem' }}>
              <strong>{title}</strong>
              <p style={{ marginBottom: 0, opacity: 0.86 }}>{text}</p>
            </article>
          ))}
        </div>
        <h2 className="display" style={{ fontSize: 42 }}>Eixos da feira</h2>
        <div className="theme-row">
          {THEMES.map((item) => (
            <span key={item} className="pill">{item}</span>
          ))}
        </div>
        <p style={{ maxWidth: 720, lineHeight: 1.5 }}>
          {name}. {INSTAGRAM_BLURB} Fotos e vídeos selecionados só podem ir às redes da escola com autorização separada.
        </p>
      </section>
      <Footer slug={slug} />
    </div>
  )
}
