import { useSearchParams } from 'react-router-dom'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { Sky } from '../components/Sky.tsx'
import { eventSlug } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

export function GaleriaPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event, posts } = useLiveEvent(slug)
  const photos = posts.filter((post) => post.type === 'photo' && post.media.length)
  const videos = posts.filter((post) => post.type === 'video' && post.media.length)
  const messages = posts.filter((post) => post.type === 'message')

  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <Topbar event={event} slug={slug} />
      <main className="page-wrap">
        <h1 className="display gold-text" style={{ fontSize: 64, marginBottom: 0 }}>Galeria</h1>
        <p>Somente conteúdos aprovados por uma pessoa da equipe e liberados para o público.</p>
        <h2>Fotografias</h2>
        {photos.length === 0 && <p>Ainda não há fotografias autorizadas.</p>}
        <div className="masonry">
          {photos.map((post) => (
            <figure key={post.id} className="glass" style={{ borderRadius: 18, overflow: 'hidden' }}>
              <img src={post.media[0].url} alt={post.body || `Foto de ${post.authorName || 'participante'}`} />
              <figcaption style={{ padding: '0.7rem 0.9rem' }}>
                <strong>{post.authorName}</strong>
                <div>{post.body}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <h2>Vídeos</h2>
        <div className="stat-grid">
          {videos.map((post) => (
            <figure key={post.id} className="glass" style={{ borderRadius: 18, overflow: 'hidden', margin: 0 }}>
              <video src={post.media[0].url} controls playsInline style={{ width: '100%', maxHeight: 320, background: '#000' }} />
              <figcaption style={{ padding: '0.7rem 0.9rem' }}>{post.authorName} — {post.body}</figcaption>
            </figure>
          ))}
        </div>
        <h2>Mensagens</h2>
        <div className="stat-grid">
          {messages.map((post) => (
            <article key={post.id} className="glass" style={{ borderRadius: 18, padding: '0.9rem 1rem' }}>
              <p style={{ fontSize: '1.15rem' }}>"{post.body}" {post.emoji}</p>
              <strong>{post.authorName}</strong>
            </article>
          ))}
        </div>
      </main>
      <Footer slug={slug} />
    </div>
  )
}
