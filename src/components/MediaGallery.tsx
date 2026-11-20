import { useState } from 'react'
import type { Post } from '../lib/types'

export interface GalleryItem {
  key: string
  type: 'image' | 'video'
  url: string
  poster?: string
  author: string
  caption: string
  emoji: string
  featured: boolean
}

export function toGalleryItems(posts: Post[], urls: Record<string, string>): GalleryItem[] {
  const out: GalleryItem[] = []
  for (const p of posts) {
    if (p.kind !== 'photo' && p.kind !== 'video') continue
    for (const m of p.media) {
      const url = urls[m.path]
      if (!url) continue
      out.push({
        key: m.path,
        type: m.type,
        url,
        poster: m.poster ? urls[m.poster] : undefined,
        author: p.author_name,
        caption: p.body,
        emoji: p.emoji,
        featured: p.featured,
      })
    }
  }
  return out
}

export function MediaGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<GalleryItem | null>(null)
  if (!items.length) return <p className="py-10 text-center text-white/60">Nenhum registro aprovado ainda.</p>
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => (
          <button key={it.key} onClick={() => setOpen(it)} className="group relative aspect-square overflow-hidden rounded-2xl bg-navy-800 text-left">
            {it.type === 'image' ? (
              <img src={it.url} alt={it.caption || `Foto de ${it.author}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <>
                {it.poster ? <img src={it.poster} alt="" loading="lazy" className="h-full w-full object-cover" /> : <video src={it.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs">▶ vídeo</span>
              </>
            )}
            {it.featured && <span className="absolute right-2 top-2 chip bg-gold-400 text-navy-900">★</span>}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-xs font-semibold">
              {it.emoji} {it.author}
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <div className="max-h-[80vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            {open.type === 'image' ? (
              <img src={open.url} alt={open.caption} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            ) : (
              <video src={open.url} poster={open.poster} controls autoPlay playsInline className="max-h-[80vh] max-w-full rounded-xl" />
            )}
          </div>
          <p className="mt-3 text-center">
            {open.caption && <span className="block text-lg font-semibold">{open.caption}</span>}
            <span className="text-gold-300">
              {open.emoji} {open.author}
            </span>
          </p>
          <button className="btn-ghost btn-sm mt-3" onClick={() => setOpen(null)}>
            Fechar
          </button>
        </div>
      )}
    </>
  )
}

export function MessageWall({ posts, limit = 60 }: { posts: Post[]; limit?: number }) {
  const msgs = posts.filter((p) => p.kind === 'message').slice(0, limit)
  if (!msgs.length) return <p className="py-10 text-center text-white/60">Nenhuma mensagem aprovada ainda.</p>
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {msgs.map((m) => (
        <article key={m.id} className="card mb-3 break-inside-avoid p-4">
          <p className="text-2xl">{m.emoji || '💬'}</p>
          <p className="mt-1 text-lg leading-snug">“{m.body}”</p>
          <p className="mt-2 text-sm font-semibold text-gold-300">— {m.author_name}</p>
        </article>
      ))}
    </div>
  )
}
