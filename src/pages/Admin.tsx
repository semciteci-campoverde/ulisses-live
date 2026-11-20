import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DEFAULT_COLORS } from '../../shared/constants.ts'
import { templateCaptions } from '../../shared/text.ts'
import type { AdminOverview, AdminPost, PublicEvent } from '../../shared/types.ts'
import { SchoolLogo } from '../components/Sky.tsx'
import { Sky } from '../components/Sky.tsx'
import { api, usingSupabase } from '../lib/api.ts'
import { ApiError } from '../lib/backend.ts'
import { downloadZip, exportCsv, exportExcel, exportPdf } from '../lib/exportReport.ts'
import { formatTime } from '../lib/format.ts'
import { eventSlug, withEvent } from '../lib/paths.ts'

type Tab = 'painel' | 'moderacao' | 'comunicacao' | 'evento' | 'exibicao' | 'dados' | 'demo'

export function AdminPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    api.admin.me().then((me) => setEmail(me?.email ?? null)).finally(() => setReady(true))
  }, [])
  if (!ready) return <div className="sky-page"><Sky /><p style={{ padding: 24 }}>Abrindo a área da equipe…</p></div>
  if (!email) return <Login onSuccess={setEmail} />
  return <Desk email={email} initialSlug={eventSlug(params)} onLogout={() => { void api.admin.logout().then(() => setEmail(null)) }} />
}

function Login({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState('admin@eecm.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="sky-page">
      <Sky />
      <main className="page-wrap narrow" style={{ paddingTop: 48 }}>
        <SchoolLogo />
        <h1 className="display gold-text" style={{ fontSize: 'clamp(2.2rem, 11vw, 62px)', marginBottom: 0 }}>Área da equipe</h1>
        <p>Acesso da organização da EECM Ulisses Guimarães. Visitantes não entram aqui.</p>
        <form
          className="glass"
          style={{ borderRadius: 24, padding: '1rem', display: 'grid', gap: 10 }}
          onSubmit={(ev) => {
            ev.preventDefault()
            setBusy(true)
            setError('')
            api.admin.login(email, password)
              .then((me) => onSuccess(me.email))
              .catch((caught) => setError(caught instanceof Error ? caught.message : 'Falha no acesso.'))
              .finally(() => setBusy(false))
          }}
        >
          <label><span className="label">E-mail</span><input className="field" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required /></label>
          <label><span className="label">Senha</span><input className="field" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} required /></label>
          {error && <p>{error}</p>}
          <button className="btn-gold" disabled={busy} type="submit">{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <p><Link to="/">Voltar ao início</Link></p>
      </main>
    </div>
  )
}

function Desk({ email, initialSlug, onLogout }: { email: string; initialSlug: string; onLogout: () => void }) {
  const [slug, setSlug] = useState(initialSlug)
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [data, setData] = useState<AdminOverview | null>(null)
  const [tab, setTab] = useState<Tab>('painel')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function reload() {
    const [list, overview] = await Promise.all([api.listEvents(), api.admin.overview(slug)])
    setEvents(list)
    setData(overview)
  }

  useEffect(() => {
    let alive = true
    const run = () => {
      reload().catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : 'Falha ao carregar.')
      })
    }
    run()
    const timer = window.setInterval(run, 8000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [slug])

  async function act(work: () => Promise<unknown>, ok: string) {
    setError('')
    try {
      await work()
      setNote(ok)
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Não foi possível concluir.')
    }
  }

  const tabs: Array<[Tab, string]> = [
    ['painel', 'Indicadores'],
    ['moderacao', 'Moderação'],
    ['comunicacao', 'Comunicação'],
    ['evento', 'Evento'],
    ['exibicao', 'Exibição'],
    ['dados', 'Exportar'],
    ['demo', 'Demonstração'],
  ]

  return (
    <div className="sky-page">
      <Sky />
      <div className="admin-shell" style={{ position: 'relative', zIndex: 1 }}>
        <aside className="side">
          <div style={{ padding: '0.4rem 0.6rem 0.8rem' }}>
            <strong>ULISSES LIVE</strong>
            <div style={{ fontSize: 13, opacity: 0.75 }}>{email}</div>
          </div>
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
          <button onClick={onLogout}>Sair</button>
        </aside>
        <main style={{ padding: '1rem 1.1rem 3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 className="display gold-text" style={{ fontSize: 'clamp(2.2rem, 11vw, 48px)', margin: 0 }}>{data?.event.name || 'Carregando'}</h1>
              <div style={{ fontSize: 14, opacity: 0.8 }}>{usingSupabase ? 'Banco Supabase' : 'Servidor local desta máquina'} · {data?.event.isDemo ? 'demonstração' : 'dados do evento'}</div>
            </div>
            <label>
              <span className="label">Evento</span>
              <select className="field" value={slug} onChange={(ev) => setSlug(ev.target.value)}>
                {events.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
            </label>
          </div>
          {data?.event.emergencyStop && <p className="btn-danger" style={{ display: 'inline-flex' }}>Emergência ligada: as TVs não mostram conteúdo do público.</p>}
          {error && <p>{error}</p>}
          {note && <p>{note}</p>}
          {data && tab === 'painel' && <Painel data={data} />}
          {data && tab === 'moderacao' && <Moderacao data={data} onAct={act} />}
          {data && tab === 'comunicacao' && <Comunicacao data={data} onAct={act} />}
          {data && tab === 'evento' && <Evento key={data.event.id} data={data} onAct={act} onCreated={(created) => setSlug(created)} />}
          {data && tab === 'exibicao' && <Exibicao key={data.event.id} data={data} onAct={act} />}
          {data && tab === 'dados' && <Dados key={data.event.id} data={data} onAct={act} />}
          {data && tab === 'demo' && <Demo data={data} slug={slug} onAct={act} />}
        </main>
      </div>
    </div>
  )
}

function Painel({ data }: { data: AdminOverview }) {
  const cards = [
    ['Presenças por navegador', data.stats.presences],
    ['Mensagens', data.stats.messages],
    ['Mensagens aprovadas', data.stats.messagesApproved],
    ['Fotografias', data.stats.photos],
    ['Vídeos', data.stats.videos],
    ['Reações', data.stats.reactions],
    ['Pendentes', data.stats.pending],
    ['Rejeitados', data.stats.rejected],
    ['Removidos', data.stats.removed],
    ['Engajamento', `${data.stats.engagementRate}%`],
  ]
  const peak = Math.max(1, ...data.stats.byHour.map((item) => item.count))
  return (
    <section>
      <p>Presenças contam navegadores, não pessoas físicas nem a ocupação instantânea. O engajamento é a porcentagem de navegadores com presença que também enviaram mensagem, foto ou vídeo.</p>
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="glass" style={{ borderRadius: 16, padding: '0.8rem' }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>{label}</div>
            <strong style={{ fontSize: 28 }}>{value}</strong>
          </article>
        ))}
      </div>
      <h2>Horários de maior participação</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        {data.stats.byHour.filter((item) => item.count > 0).map((item) => (
          <div key={item.hour} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 32px', gap: 8, alignItems: 'center' }}>
            <span>{String(item.hour).padStart(2, '0')}h</span>
            <div className="hour-bar"><i style={{ width: `${(item.count / peak) * 100}%` }} /></div>
            <span>{item.count}</span>
          </div>
        ))}
        {data.stats.byHour.every((item) => item.count === 0) && <p>Ainda não há presenças para montar o gráfico.</p>}
      </div>
      <h2>Por dia e turno</h2>
      <p>Turnos no horário de Campo Verde: manhã até 12h, tarde até 18h, noite depois disso. A visitação pública prevista é das 9h às 11h e das 15h às 17h.</p>
      <ul>
        {data.stats.byDayShift.map((item) => <li key={`${item.day}-${item.shift}`}>{item.day} · {item.shift}: {item.count}</li>)}
      </ul>
    </section>
  )
}

function Moderacao({ data, onAct }: { data: AdminOverview; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [filter, setFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending')
  const posts = data.posts.filter((post) => filter === 'all' || post.status === filter)
  return (
    <section>
      <p>
        Mensagens e nomes passam por um classificador de regras em português, no servidor: elogio claro vai ao painel; palavrão, ofensa e propaganda são recusados; crítica fica só aqui; texto neutro espera uma pessoa. Não é inteligência artificial.
        {data.aiKeyConfigured ? ' Há uma camada opcional de IA ligada para texto.' : ' Nenhuma chave de IA está configurada.'}
        {' '}Fotos e vídeos continuam na revisão humana. O motivo aparece em cada item e a equipe pode aprovar ou recusar por cima da classificação.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((item) => (
          <button key={item} className={filter === item ? 'btn-gold' : 'btn-ghost'} onClick={() => setFilter(item)}>
            {item === 'pending' ? 'Pendentes' : item === 'approved' ? 'Aprovados' : item === 'rejected' ? 'Rejeitados' : 'Todos'}
          </button>
        ))}
      </div>
      <div className="queue" style={{ marginTop: 12 }}>
        {posts.length === 0 && <p>Nada nesta fila.</p>}
        {posts.map((post) => <PostCard key={post.id} post={post} slug={data.event.slug} onAct={onAct} />)}
      </div>
    </section>
  )
}

function labelName(label: string | null): string {
  const names: Record<string, string> = {
    positive: 'Positiva — publicada pelas regras',
    neutral: 'Neutra — na fila humana',
    blocked: 'Ofensiva — recusada pelas regras',
    criticism: 'Crítica — só na equipe',
    personal_data: 'Dado pessoal — só na equipe',
    spam: 'Propaganda — recusada pelas regras',
    sensitive: 'Termo sensível — na fila humana',
    media_review: 'Foto ou vídeo — revisão humana',
    emoji: 'Reação da lista oficial',
    clean: 'Sem termo proibido',
  }
  return names[label || ''] || 'Classificação por regras'
}

function PostCard({ post, slug, onAct }: { post: AdminPost; slug: string; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const privateFeed = post.audience === 'admin' || post.moderationLabel === 'criticism' || post.moderationLabel === 'personal_data'
  return (
    <article className={post.media.length ? 'glass with-media' : 'glass'} style={{ borderRadius: 16, padding: '0.8rem' }}>
      {post.media[0] && (post.media[0].mime.startsWith('video')
        ? <video className="thumb" src={post.media[0].url} controls muted />
        : <img className="thumb" src={post.media[0].url} alt="" />)}
      <div>
        <strong>{post.authorName || 'Sem nome'} · {post.type} · {post.status}</strong>
        <div>{post.emoji} {post.body}</div>
        <small>{formatTime(post.createdAt)}</small>
        <div><strong>{labelName(post.moderationLabel)}.</strong> {post.moderationNote}</div>
        {post.aiUsed && <div>Houve também a camada opcional de IA. A mídia, se houver, continua com revisão humana.</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn-royal" onClick={() => void onAct(() => api.admin.moderate(slug, post.id, 'approve'), 'Atualizado.')}>Aprovar</button>
          {privateFeed && (
            <button className="btn-ghost" onClick={() => void onAct(() => api.admin.moderate(slug, post.id, 'approve', '', true), 'Publicado no painel.')}>
              Publicar no painel mesmo assim
            </button>
          )}
          <button className="btn-ghost" onClick={() => void onAct(() => api.admin.moderate(slug, post.id, 'reject'), 'Rejeitado.')}>Rejeitar</button>
          <button className="btn-ghost" onClick={() => void onAct(() => api.admin.moderate(slug, post.id, 'remove'), 'Retirado do mural.')}>Retirar agora</button>
          <button className="btn-ghost" onClick={() => void onAct(() => api.admin.updatePost(slug, post.id, { highlight: !post.highlight }), 'Destaque atualizado.')}>
            {post.highlight ? 'Tirar destaque' : 'Destacar'}
          </button>
          <button className="btn-danger" onClick={() => confirm('Excluir este conteúdo de forma definitiva?') && void onAct(() => api.admin.deletePost(slug, post.id), 'Excluído.')}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}

function Comunicacao({ data, onAct }: { data: AdminOverview; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const items = data.posts.filter((post) => (post.type === 'photo' || post.type === 'video') && post.status === 'approved')
  return (
    <section>
      <p>
        Área da comunicação. A publicação direta no Instagram não acontece daqui: ela depende da conta oficial da escola.
        Baixe só o que tiver autorização. Legendas iniciais são modelos prontos.
      </p>
      <button
        className="btn-gold"
        onClick={() => void downloadZip(items.filter((post) => post.instagramConsent).flatMap((post, index) => post.media.map((media, mediaIndex) => ({
          name: `${index + 1}-${post.authorName || 'autor'}-${mediaIndex}.${media.mime.includes('video') ? 'mp4' : 'jpg'}`,
          url: media.url,
        })))).catch((caught) => alert(caught instanceof Error ? caught.message : 'Falha no download.'))}
      >
        Baixar lote autorizado para Instagram
      </button>
      <div className="queue" style={{ marginTop: 12 }}>
        {items.map((post) => <CommsCard key={post.id} post={post} event={data.event} onAct={onAct} />)}
        {items.length === 0 && <p>Ainda não há fotos ou vídeos aprovados.</p>}
      </div>
    </section>
  )
}

function CommsCard({ post, event, onAct }: { post: AdminPost; event: PublicEvent; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [category, setCategory] = useState(post.category || 'Feira')
  const [format, setFormat] = useState(post.commsFormat || 'feed')
  const [captions, setCaptions] = useState<string[]>(post.suggestedCaption ? [post.suggestedCaption] : templateCaptions(event.name, post.authorName, post.body, event.instagramHandle))
  const [aiNote, setAiNote] = useState('Modelos de legenda, sem inteligência artificial.')
  return (
    <article className="glass with-media" style={{ borderRadius: 16, padding: '0.8rem' }}>
      {post.media[0] && <img className="thumb" src={post.media[0].url} alt="" />}
      <div>
        <strong>{post.authorName}</strong> · {formatTime(post.createdAt)} · {post.instagramConsent ? 'autorizado para Instagram' : 'sem autorização de Instagram'}
        <div>{post.body}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input className="field" style={{ maxWidth: 180 }} value={category} onChange={(ev) => setCategory(ev.target.value)} />
          <select className="field" style={{ maxWidth: 160 }} value={format} onChange={(ev) => setFormat(ev.target.value)}>
            <option value="feed">Feed</option>
            <option value="stories">Stories</option>
            <option value="reels">Reels</option>
          </select>
          <button className="btn-royal" onClick={() => void onAct(() => api.admin.updatePost(event.slug, post.id, { category, commsFormat: format, suggestedCaption: captions[0] }), 'Organização salva.')}>Salvar</button>
          <a className="btn-ghost" href={post.media[0]?.url} download>Baixar</a>
          <button className="btn-ghost" onClick={() => void api.admin.captions({ eventName: event.name, authorName: post.authorName, body: post.body, handle: event.instagramHandle, useAi: true }).then((result) => { setCaptions(result.captions); setAiNote(result.message) })}>
            Tentar legenda com IA
          </button>
        </div>
        <small>{aiNote}</small>
        {captions.map((caption) => <p key={caption}>{caption}</p>)}
      </div>
    </article>
  )
}

function Evento({ data, onAct, onCreated }: { data: AdminOverview; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void>; onCreated: (slug: string) => void }) {
  const event = data.event
  const [form, setForm] = useState({
    name: event.name,
    theme: event.theme,
    slogan: event.slogan,
    description: event.description,
    internalDate: event.internalDate,
    publicDate: event.publicDate,
    publicHours: event.publicHours,
    instagramHandle: event.instagramHandle,
    instagramUrl: event.instagramUrl,
    welcomeText: event.welcomeText,
    institution: event.institution,
    municipality: event.municipality,
    state: event.state,
  })
  const [colors, setColors] = useState(event.colors)
  const [name, setName] = useState('')
  const set = (key: keyof typeof form) => (ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: ev.target.value })
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-royal" onClick={() => void onAct(() => api.admin.setStatus(event.slug, 'live'), 'Evento aberto.')}>Abrir evento</button>
        <button className="btn-ghost" onClick={() => void onAct(() => api.admin.setStatus(event.slug, 'draft'), 'Evento em rascunho.')}>Rascunho</button>
        <button className="btn-danger" onClick={() => confirm('Encerrar o evento e abrir a memória pública?') && void onAct(() => api.admin.setStatus(event.slug, 'ended'), 'Evento encerrado.')}>Encerrar evento</button>
      </div>
      <div className="stat-grid">
        {([
          ['name', 'Nome do evento'],
          ['institution', 'Instituição'],
          ['municipality', 'Município'],
          ['state', 'UF'],
          ['theme', 'Tema'],
          ['slogan', 'Slogan'],
          ['internalDate', 'Data interna'],
          ['publicDate', 'Data da visitação'],
          ['publicHours', 'Horários'],
          ['instagramHandle', 'Instagram'],
          ['instagramUrl', 'Link do Instagram'],
          ['welcomeText', 'Boas-vindas'],
          ['description', 'Descrição'],
        ] as Array<[keyof typeof form, string]>).map(([key, label]) => (
          <label key={key}>
            <span className="label">{label}</span>
            {key === 'description' || key === 'welcomeText'
              ? <textarea className="field" rows={3} value={form[key]} onChange={set(key)} />
              : <input className="field" value={form[key]} onChange={set(key)} />}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['navy', 'royal', 'gold', 'ink'] as const).map((key) => (
          <label key={key}>
            <span className="label">{key}</span>
            <input type="color" value={colors[key]} onChange={(ev) => setColors({ ...colors, [key]: ev.target.value })} />
          </label>
        ))}
        <button className="btn-ghost" onClick={() => setColors(DEFAULT_COLORS)}>Cores do convite</button>
      </div>
      <label>
        <span className="label">Trocar logomarca (arquivo original da escola, sem redesenho)</span>
        <input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(ev) => {
          const file = ev.target.files?.[0]
          if (file) void onAct(() => api.admin.uploadLogo(event.slug, file, file.name), 'Logomarca atualizada.')
        }} />
      </label>
      <button className="btn-gold" onClick={() => void onAct(() => api.admin.updateEvent(event.slug, { ...form, colors }), 'Evento salvo.')}>Salvar informações</button>
      <div className="glass" style={{ borderRadius: 16, padding: '0.8rem' }}>
        <h2>Novo evento</h2>
        <p>Feiras, formaturas, mostras, esportes, reuniões e outros eventos ficam com QR, histórico e dados separados.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field" placeholder="Nome do evento" value={name} onChange={(ev) => setName(ev.target.value)} />
          <button className="btn-royal" onClick={() => void onAct(async () => { const created = await api.admin.createEvent(name); onCreated(created.slug) }, 'Evento criado em rascunho.')}>Criar</button>
        </div>
      </div>
    </section>
  )
}

function Exibicao({ data, onAct }: { data: AdminOverview; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const event = data.event
  const [seconds, setSeconds] = useState(event.sceneDurationSeconds)
  const [goals, setGoals] = useState(event.goals.join(', '))
  const [scenes, setScenes] = useState(event.scenes)
  const [autoApprove, setAutoApprove] = useState(event.autoApproveCleanMessages)
  const [ai, setAi] = useState(event.aiEnabled)
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <button
        className="btn-danger"
        onClick={() => confirm(event.emergencyStop ? 'Liberar a exibição nas televisões?' : 'Interromper agora o conteúdo do público em todas as TVs?') && void onAct(() => api.admin.setEmergency(event.slug, !event.emergencyStop), event.emergencyStop ? 'Exibição liberada.' : 'Emergência acionada.')}
      >
        {event.emergencyStop ? 'Liberar televisões' : 'Botão de emergência — parar as TVs'}
      </button>
      <button className="btn-ghost" onClick={() => void onAct(() => api.admin.setMural(event.slug, !event.muralEnabled), event.muralEnabled ? 'Mural pausado.' : 'Mural retomado.')}>
        {event.muralEnabled ? 'Pausar mural' : 'Retomar mural'}
      </button>
      <label>
        <span className="label">Segundos de cada cena ({seconds})</span>
        <input className="field" type="number" min={8} max={60} value={seconds} onChange={(ev) => setSeconds(Number(ev.target.value))} />
      </label>
      <label>
        <span className="label">Metas de presença, separadas por vírgula</span>
        <input className="field" value={goals} onChange={(ev) => setGoals(ev.target.value)} />
      </label>
      <div>
        {(Object.keys(scenes) as Array<keyof typeof scenes>).map((key) => (
          <label key={key} className="check" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={scenes[key]} onChange={(ev) => setScenes({ ...scenes, [key]: ev.target.checked })} />
            <span>Cena: {key}</span>
          </label>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={autoApprove} onChange={(ev) => setAutoApprove(ev.target.checked)} />
        <span>Publicar na hora as mensagens classificadas como positivas pelo classificador de regras. Isso não é inteligência artificial. Neutras e críticas continuam na fila. Ofensas são recusadas. Fotos e vídeos sempre esperam uma pessoa.</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={ai} onChange={(ev) => setAi(ev.target.checked)} />
        <span>Pedir análise automática de texto quando houver chave configurada no servidor. Sem a chave, nada é marcado como IA.</span>
      </label>
      <button
        className="btn-gold"
        onClick={() => void onAct(() => api.admin.updateEvent(event.slug, {
          sceneDurationSeconds: seconds,
          goals: goals.split(',').map((item) => Number(item.trim())).filter((item) => item > 0),
          scenes,
          autoApproveCleanMessages: autoApprove,
          aiEnabled: ai,
        }), 'Exibição salva. As TVs acompanham juntas pelo relógio do servidor.')}
      >
        Salvar exibição
      </button>
      <p>
        Painel: <Link to={withEvent('/tv', event.slug)} target="_blank">abrir TV</Link>
        {' · '}
        <Link to={withEvent('/qr', event.slug)} target="_blank">imprimir QR</Link>
      </p>
    </section>
  )
}

function Dados({ data, onAct }: { data: AdminOverview; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [days, setDays] = useState(data.event.retentionDays)
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <p>Os arquivos trazem indicadores, publicações e horários de presença. Guarde-os com o mesmo cuidado de um documento escolar. O identificador aleatório do navegador não entra no CSV.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-gold" onClick={() => exportCsv(data)}>CSV</button>
        <button className="btn-gold" onClick={() => exportExcel(data)}>Excel</button>
        <button className="btn-royal" onClick={() => void exportPdf(data)}>PDF</button>
      </div>
      <label>
        <span className="label">Prazo de retenção em dias</span>
        <input className="field" type="number" min={7} max={3650} value={days} onChange={(ev) => setDays(Number(ev.target.value))} />
      </label>
      <button className="btn-ghost" onClick={() => void onAct(() => api.admin.updateEvent(data.event.slug, { retentionDays: days }), 'Prazo salvo.')}>Salvar prazo</button>
      <button className="btn-danger" onClick={() => confirm('Apagar conteúdos e presenças mais antigos que o prazo deste evento?') && void onAct(() => api.admin.applyRetention(data.event.slug), 'Retenção aplicada.')}>
        Aplicar retenção agora
      </button>
    </section>
  )
}

function Demo({ data, slug, onAct }: { data: AdminOverview; slug: string; onAct: (work: () => Promise<unknown>, ok: string) => Promise<void> }) {
  return (
    <section>
      <p>
        O modo demonstração é outro evento, com outro QR e outro contador. Apagar a demonstração não mexe na Feira do Conhecimento real.
        Os exemplos são textos e imagens geradas, sem fotos de estudantes, e só entram se você pedir.
      </p>
      <p>
        <Link to="/participar?modo=demo">Abrir participação de teste</Link>
        {' · '}
        <Link to="/tv?modo=demo">Abrir TV de teste</Link>
      </p>
      {data.event.isDemo ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-royal" onClick={() => void onAct(() => api.admin.seedDemo(slug), 'Exemplos inseridos.')}>Inserir exemplos</button>
          <button className="btn-danger" onClick={() => confirm('Apagar todos os dados desta demonstração?') && void onAct(() => api.admin.purgeDemo(slug), 'Demonstração limpa.')}>Apagar dados de teste</button>
        </div>
      ) : (
        <p>Você está no evento real. Troque para a demonstração no seletor antes de inserir ou apagar exemplos. Nada fictício é gravado aqui.</p>
      )}
    </section>
  )
}
