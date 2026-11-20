import { useCallback, useEffect, useState } from 'react'
import { mediaPaths, signedUrls } from '../../lib/media'
import { friendlyError, supabase } from '../../lib/supabase'
import type { EventRow, Post, PostStatus } from '../../lib/types'
import type { Notify } from './Admin'

export const FLAG_LABELS: Record<string, string> = {
  palavrao: 'palavrão',
  ofensa: 'ofensa',
  discriminacao: 'discriminação',
  conteudo_sexual: 'conteúdo sexual',
  violencia: 'violência',
  improprio: 'impróprio para a escola',
  propaganda: 'propaganda ou spam',
  spam: 'spam',
  link: 'link',
  dados_pessoais: 'dados pessoais',
  mencao: 'menciona perfil',
  possivel_critica: 'possível crítica',
}

const FILTERS: [string, string, PostStatus[]][] = [
  ['pending', 'Pendentes', ['pending']],
  ['approved', 'No telão', ['approved']],
  ['feedback', 'Sugestões privadas', ['feedback']],
  ['rejected', 'Rejeitados e retirados', ['rejected', 'removed']],
]

export function useAdminPosts(eventId: string, statuses: PostStatus[]) {
  const [posts, setPosts] = useState<Post[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const key = statuses.join(',')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('event_id', eventId)
      .in('status', key.split(','))
      .order('created_at', { ascending: key === 'pending' })
      .limit(500)
    const list = (data || []) as Post[]
    const paths = mediaPaths(list)
    if (paths.length) {
      const signed = await signedUrls(paths)
      setUrls((u) => ({ ...u, ...signed }))
    }
    setPosts(list)
    setLoading(false)
  }, [eventId, key])

  useEffect(() => {
    setLoading(true)
    void load()
    const ch = supabase
      .channel(`admin-posts-${eventId}-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `event_id=eq.${eventId}` }, () => void load())
      .subscribe()
    const t = window.setInterval(() => void load(), 20000)
    return () => {
      window.clearInterval(t)
      void supabase.removeChannel(ch)
    }
  }, [eventId, key, load])

  return { posts, urls, loading, reload: load, setPosts }
}

export default function Moderation({ event, notify }: { event: EventRow; notify: Notify }) {
  const [filter, setFilter] = useState('pending')
  const statuses = FILTERS.find((f) => f[0] === filter)![2]
  const { posts, urls, loading, reload, setPosts } = useAdminPosts(event.id, statuses)

  async function setStatus(p: Post, status: PostStatus) {
    setPosts((list) => list.filter((x) => x.id !== p.id))
    const { error } = await supabase.from('posts').update({ status, reviewed_at: new Date().toISOString() }).eq('id', p.id)
    if (error) {
      notify(friendlyError(error), 'error')
      void reload()
    }
  }

  async function toggleFeatured(p: Post) {
    const { error } = await supabase.from('posts').update({ featured: !p.featured }).eq('id', p.id)
    if (error) notify(friendlyError(error), 'error')
    else void reload()
  }

  async function destroy(p: Post) {
    if (!window.confirm('Apagar definitivamente esta publicação e seus arquivos?')) return
    const files = mediaPaths([p])
    if (files.length) await supabase.storage.from('uploads').remove(files)
    const { error } = await supabase.from('posts').delete().eq('id', p.id)
    if (error) notify(friendlyError(error), 'error')
    else {
      notify('Publicação apagada.')
      void reload()
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? 'bg-gold-400 text-navy-900' : 'bg-white/10'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-sm text-white/60">{loading ? 'Carregando...' : `${posts.length} itens · atualiza sozinho`}</span>
      </div>
      {filter === 'pending' && (
        <p className="mb-4 rounded-xl bg-white/5 px-4 py-2 text-sm text-white/70">
          A moderação automática aqui é um filtro de palavras, não uma inteligência artificial. Fotos e vídeos sempre esperam uma pessoa. Mensagens com crítica
          podem ser enviadas para “Sugestões privadas”.
        </p>
      )}
      {!loading && !posts.length && <p className="py-16 text-center text-white/50">Nada por aqui.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((p) => (
          <article key={p.id} className={`card flex flex-col overflow-hidden ${p.flags.length ? 'ring-2 ring-amber-500/60' : ''}`}>
            {p.media.length > 0 && (
              <div className={`grid gap-0.5 bg-black ${p.media.length > 1 ? 'grid-cols-2' : ''}`}>
                {p.media.map((m) =>
                  m.type === 'image' ? (
                    <a key={m.path} href={urls[m.path]} target="_blank" rel="noreferrer">
                      <img src={urls[m.path]} alt="" className="aspect-square w-full object-cover" />
                    </a>
                  ) : (
                    <video key={m.path} src={urls[m.path]} poster={m.poster ? urls[m.poster] : undefined} controls muted playsInline className="max-h-80 w-full" />
                  ),
                )}
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="chip bg-white/10">{{ message: 'Mensagem', photo: 'Foto', video: 'Vídeo', feedback: 'Sugestão' }[p.kind]}</span>
                {p.flags.map((f) => (
                  <span key={f} className="chip bg-amber-500/30 text-amber-100">
                    ⚠ {FLAG_LABELS[f] || f}
                  </span>
                ))}
                {p.kind !== 'message' && p.kind !== 'feedback' && (
                  <span className={`chip ${p.consent_instagram ? 'bg-fuchsia-500/30' : 'bg-white/10 text-white/60'}`}>{p.consent_instagram ? 'autoriza Instagram' : 'não autoriza Instagram'}</span>
                )}
                {p.featured && <span className="chip bg-gold-400 text-navy-900">★ destaque</span>}
                <span className="ml-auto text-white/50">{new Date(p.created_at).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
              </div>
              {p.body && <p className="mt-2 break-words text-lg leading-snug">{p.emoji} {p.body}</p>}
              {!p.body && p.emoji && <p className="mt-2 text-2xl">{p.emoji}</p>}
              <p className="mt-1 text-sm font-semibold text-gold-300">— {p.author_name}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {(p.status === 'pending' || p.status === 'rejected' || p.status === 'removed' || p.status === 'feedback') && p.kind !== 'feedback' && (
                  <button className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void setStatus(p, 'approved')}>
                    ✓ Aprovar
                  </button>
                )}
                {p.status === 'pending' && (
                  <button className="btn btn-sm bg-red-600/80 text-white hover:bg-red-600" onClick={() => void setStatus(p, 'rejected')}>
                    ✕ Rejeitar
                  </button>
                )}
                {p.status === 'pending' && p.kind === 'message' && (
                  <button className="btn-ghost btn-sm" onClick={() => void setStatus(p, 'feedback')}>
                    Mover para sugestões
                  </button>
                )}
                {p.status === 'approved' && (
                  <>
                    <button className="btn btn-sm bg-red-600 text-white" onClick={() => void setStatus(p, 'removed')}>
                      Retirar do telão
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => void toggleFeatured(p)}>
                      {p.featured ? 'Tirar destaque' : '★ Destacar'}
                    </button>
                  </>
                )}
                <button className="btn-ghost btn-sm ml-auto text-red-200" onClick={() => void destroy(p)}>
                  Apagar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
