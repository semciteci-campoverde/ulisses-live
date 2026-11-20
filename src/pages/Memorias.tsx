import { useSearchParams } from 'react-router-dom'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { SchoolLogo } from '../components/Sky.tsx'
import { Sky } from '../components/Sky.tsx'
import { eventSlug } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

export function MemoriasPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event, posts } = useLiveEvent(slug)
  const ended = event?.status === 'ended'
  const photos = posts.filter((post) => post.type === 'photo')
  const messages = posts.filter((post) => post.type === 'message')

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: event?.name || 'ULISSES LIVE', url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url)
    alert('Link copiado.')
  }

  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <Topbar event={event} slug={slug} />
      <main className="page-wrap">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <SchoolLogo src={event?.logoUrl} />
          <div>
            <p className="script" style={{ fontSize: 48, margin: 0 }}>Memória</p>
            <h1 className="display gold-text" style={{ fontSize: 62, margin: 0 }}>{event?.name || 'Feira do Conhecimento'}</h1>
          </div>
        </div>
        {!ended && (
          <section className="glass" style={{ borderRadius: 24, padding: '1.2rem', marginTop: 16 }}>
            <h2>A memória pública abre quando a escola encerrar o evento.</h2>
            <p>
              Enquanto a feira acontece, os registros aprovados podem ser vistos na galeria e no painel.
              Depois do encerramento, esta página reúne o agradecimento, os números e os melhores momentos autorizados.
            </p>
          </section>
        )}
        {ended && (
          <>
            <p style={{ fontSize: '1.2rem' }}>
              Obrigado, comunidade escolar. A Feira do Conhecimento fica registrada aqui com o que foi autorizado para memória pública.
            </p>
            <div className="stat-grid">
              <article className="glass" style={{ borderRadius: 18, padding: '1rem' }}><strong>{event?.presenceCount}</strong><div>presenças por navegador</div></article>
              <article className="glass" style={{ borderRadius: 18, padding: '1rem' }}><strong>{messages.length}</strong><div>mensagens no mural</div></article>
              <article className="glass" style={{ borderRadius: 18, padding: '1rem' }}><strong>{photos.length}</strong><div>fotografias autorizadas</div></article>
            </div>
            <div className="masonry" style={{ marginTop: 16 }}>
              {photos.map((post) => (
                <figure key={post.id} className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <img src={post.media[0]?.url} alt="" />
                  <figcaption style={{ padding: 8 }}>{post.authorName}</figcaption>
                </figure>
              ))}
            </div>
            {messages.slice(0, 12).map((post) => (
              <blockquote key={post.id}>"{post.body}" — {post.authorName}</blockquote>
            ))}
            <button className="btn-gold" onClick={() => void share()}>Compartilhar esta página</button>
          </>
        )}
        <p>
          <a href={event?.instagramUrl || 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/'} target="_blank" rel="noreferrer">
            Continuar a história no Instagram {event?.instagramHandle}
          </a>
        </p>
      </main>
      <Footer slug={slug} />
    </div>
  )
}
