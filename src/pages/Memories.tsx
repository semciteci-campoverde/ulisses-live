import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_SLOGAN } from '../config'
import { MediaGrid, MessageWall, toGalleryItems } from '../components/MediaGallery'
import { Backdrop, InstagramIcon, Logo, Spinner } from '../components/ui'
import { formatInt, pageUrl, useApprovedPosts, useCountUp, useEvent, useStats } from '../lib/hooks'

export default function Memories() {
  const { event, loading, error } = useEvent()
  const { stats } = useStats(event?.id)
  const { posts, urls, loaded } = useApprovedPosts(event?.id, stats?.posts_rev)
  const [copied, setCopied] = useState(false)
  const n = useCountUp(stats?.presences ?? 0, 2000)
  const items = useMemo(() => toGalleryItems(posts, urls), [posts, urls])
  const photos = items.filter((i) => i.type === 'image')
  const videos = items.filter((i) => i.type === 'video')

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (!event) return <p className="p-8 text-center">{error}</p>

  const published = event.status === 'closed' || event.settings?.memories_public
  const shareUrl = pageUrl('/memorias', event.slug)

  async function share() {
    const data = { title: `Memórias · ${event!.name}`, text: `${event!.name} — ${APP_SLOGAN}`, url: shareUrl }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <section className="text-center">
          <Logo event={event} className="mx-auto h-24 w-24" />
          <p className="mt-4 font-display text-sm font-bold uppercase tracking-[.3em] text-gold-300">Memória digital</p>
          <h1 className="mt-1 font-display text-4xl font-black sm:text-5xl">
            <span className="text-gold">{event.name}</span>
          </h1>
          <p className="mt-2 text-lg italic text-white/85">{event.theme}</p>
          <p className="text-white/60">{event.institution} · {event.city}</p>
        </section>

        {!published ? (
          <div className="glass mx-auto mt-10 max-w-lg p-8 text-center">
            <p className="text-lg">A memória digital será publicada após o encerramento do evento.</p>
            <Link to={`/galeria?e=${event.slug}`} className="btn-gold mt-5">
              Ver a galeria agora
            </Link>
          </div>
        ) : (
          <>
            <section className="glass mt-10 p-6 text-center sm:p-10">
              <p className="font-display text-xl font-bold tracking-widest text-silver">FOMOS</p>
              <p className="font-display text-7xl font-black text-gold sm:text-8xl">{formatInt(n)}</p>
              <p className="font-display text-xl font-bold tracking-widest text-silver">PRESENÇAS REGISTRADAS</p>
              {stats && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['💬', stats.messages, 'mensagens'],
                    ['📸', stats.photos, 'fotos'],
                    ['🎬', stats.videos, 'vídeos'],
                    ['👏', stats.reactions, 'reações'],
                  ].map(([icon, value, label]) => (
                    <div key={String(label)} className="card p-4">
                      <p className="text-3xl">{icon}</p>
                      <p className="font-display text-3xl font-black">{formatInt(Number(value))}</p>
                      <p className="text-sm text-white/70">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-white/50">Presenças contadas por navegador, não por pessoa.</p>
            </section>

            {event.settings?.thank_you && (
              <section className="mt-10 text-center">
                <p className="mx-auto max-w-3xl font-display text-2xl font-bold leading-snug">{event.settings.thank_you}</p>
                <p className="mt-3 font-script text-3xl text-gold-200">{APP_SLOGAN}</p>
              </section>
            )}

            {!loaded ? (
              <div className="py-16 text-center">
                <Spinner />
              </div>
            ) : (
              <>
                <h2 className="mb-4 mt-12 font-display text-2xl font-extrabold text-gold">Galeria de fotos</h2>
                <MediaGrid items={photos} />
                {videos.length > 0 && (
                  <>
                    <h2 className="mb-4 mt-12 font-display text-2xl font-extrabold text-gold">Vídeos</h2>
                    <MediaGrid items={videos} />
                  </>
                )}
                <h2 className="mb-4 mt-12 font-display text-2xl font-extrabold text-gold">Mensagens</h2>
                <MessageWall posts={posts} />
              </>
            )}

            <section className="mt-12 flex flex-col items-center gap-3 pb-10 sm:flex-row sm:justify-center">
              <button className="btn-gold" onClick={() => void share()}>
                {copied ? 'Link copiado!' : 'Compartilhar esta página'}
              </button>
              {event.instagram_url && (
                <a href={event.instagram_url} target="_blank" rel="noreferrer" className="btn bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
                  <InstagramIcon className="h-5 w-5" /> {event.instagram_handle}
                </a>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
