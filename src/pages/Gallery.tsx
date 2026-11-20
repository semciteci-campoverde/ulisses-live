import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MediaGrid, MessageWall, toGalleryItems } from '../components/MediaGallery'
import { Backdrop, Logo, Spinner } from '../components/ui'
import { useApprovedPosts, useEvent, useStats } from '../lib/hooks'

export default function Gallery() {
  const { event, loading, error } = useEvent()
  const { stats } = useStats(event?.id)
  const { posts, urls, loaded } = useApprovedPosts(event?.id, stats?.posts_rev)
  const [tab, setTab] = useState<'photos' | 'videos' | 'messages'>('photos')
  const items = useMemo(() => toGalleryItems(posts, urls), [posts, urls])

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (!event) return <p className="p-8 text-center">{error}</p>

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Logo event={event} className="h-14 w-14" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-gold-300">Galeria</p>
            <h1 className="font-display text-2xl font-extrabold">{event.name}</h1>
          </div>
          <Link to={`/participar?e=${event.slug}`} className="btn-gold btn-sm">
            Participar
          </Link>
        </header>
        <div className="mb-5 flex gap-2">
          {(
            [
              ['photos', 'Fotos'],
              ['videos', 'Vídeos'],
              ['messages', 'Mensagens'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`btn-sm btn ${tab === k ? 'bg-gold-400 text-navy-900' : 'bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>
        {!loaded ? (
          <div className="py-16 text-center">
            <Spinner />
          </div>
        ) : tab === 'messages' ? (
          <MessageWall posts={posts} limit={300} />
        ) : (
          <MediaGrid items={items.filter((i) => (tab === 'photos' ? i.type === 'image' : i.type === 'video'))} />
        )}
        <p className="mt-10 text-center text-xs text-white/40">Somente conteúdos aprovados pela equipe e autorizados pelos autores.</p>
      </main>
    </div>
  )
}
