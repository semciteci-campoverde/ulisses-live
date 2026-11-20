import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { APP_SLOGAN } from '../config'
import { asset, Backdrop, InstagramIcon, Logo, QR, Spinner } from '../components/ui'
import { formatInt, participantUrl, useApprovedPosts, useCountUp, useEvent, useNow, useStats } from '../lib/hooks'
import type { EventRow, EventStats, Post, SceneKey } from '../lib/types'

const DEFAULT_SECONDS: Record<SceneKey, number> = { messages: 14, photos: 14, videos: 30, counter: 8, invite: 12, qr: 12, instagram: 10 }
const ORDER: SceneKey[] = ['messages', 'counter', 'photos', 'qr', 'videos', 'messages', 'instagram', 'photos', 'invite']
const INSTITUTIONAL: SceneKey[] = ['counter', 'qr', 'instagram', 'invite']
const FORCE: Record<string, SceneKey> = {
  mensagens: 'messages',
  fotos: 'photos',
  videos: 'videos',
  contador: 'counter',
  qr: 'qr',
  instagram: 'instagram',
  convite: 'invite',
}
const MSG_PER_SCENE = 6
const PHOTOS_PER_SCENE = 5

interface PhotoItem {
  url: string
  author: string
  caption: string
  emoji: string
  key: string
}

export default function TV() {
  const { event, loading, error } = useEvent()
  const { stats, live } = useStats(event?.id)
  const { posts, urls } = useApprovedPosts(event?.id, stats?.posts_rev)
  const now = useNow(500)
  const [params] = useSearchParams()
  const [showUi, setShowUi] = useState(true)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  // Esconde o cursor e os botões quando o mouse fica parado.
  useEffect(() => {
    let t = window.setTimeout(() => setShowUi(false), 4000)
    const onMove = () => {
      setShowUi(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setShowUi(false), 4000)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchstart', onMove)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchstart', onMove)
    }
  }, [])

  // Mantém a tela ligada enquanto o painel estiver aberto.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const request = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen')
      } catch {
        /* sem suporte */
      }
    }
    void request()
    const onVis = () => void request()
    document.addEventListener('visibilitychange', onVis)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      void lock?.release().catch(() => undefined)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen])

  const messages = useMemo(() => posts.filter((p) => p.kind === 'message'), [posts])
  const photos = useMemo<PhotoItem[]>(() => {
    const out: PhotoItem[] = []
    for (const p of posts) {
      if (p.kind !== 'photo') continue
      for (const m of p.media) {
        const url = urls[m.path]
        if (url) out.push({ url, author: p.author_name, caption: p.body, emoji: p.emoji, key: m.path })
      }
    }
    return out
  }, [posts, urls])
  const videos = useMemo(() => posts.filter((p) => p.kind === 'video' && p.media[0] && urls[p.media[0].path]), [posts, urls])

  // ---------------- Programação das cenas (igual em todas as TVs, pelo relógio) ----------------
  const settings = event?.settings || {}
  const paused = Boolean(settings.paused)
  const durations = { ...DEFAULT_SECONDS, ...(settings.scenes || {}) }
  const available = ORDER.filter((k) => {
    if ((durations[k] ?? 0) <= 0) return false
    if (paused && !INSTITUTIONAL.includes(k)) return false
    if (k === 'messages') return messages.length > 0
    if (k === 'photos') return photos.length > 0
    if (k === 'videos') return videos.length > 0
    if (k === 'instagram') return Boolean(event?.instagram_url)
    return true
  })
  const scenes = available.length ? available : (['counter', 'qr'] as SceneKey[])
  const total = scenes.reduce((s, k) => s + durations[k], 0)
  const sec = Math.floor(now / 1000)
  const cycle = Math.floor(sec / total)
  let pos = sec % total
  let sceneIndex = 0
  for (; sceneIndex < scenes.length; sceneIndex++) {
    if (pos < durations[scenes[sceneIndex]]) break
    pos -= durations[scenes[sceneIndex]]
  }
  // ?cena=fotos (ou mensagens, videos, contador, qr, instagram, convite) fixa uma cena: útil para testar e pré-visualizar.
  const forced = FORCE[params.get('cena') || '']
  const scene = forced || scenes[Math.min(sceneIndex, scenes.length - 1)]
  // Quantas vezes esta cena já apareceu: usado para avançar o lote de conteúdos.
  const occurrence = cycle * scenes.filter((k) => k === scene).length + scenes.slice(0, sceneIndex).filter((k) => k === scene).length
  const sceneKey = `${scene}-${cycle}-${sceneIndex}`

  // ---------------- Comemoração de metas e reações ----------------
  const [celebration, setCelebration] = useState<{ goal: number; until: number } | null>(null)
  const [bursts, setBursts] = useState<{ id: number; emoji: string; left: number; delay: number }[]>([])
  const prev = useRef<EventStats | null>(null)
  const burstSeq = useRef(0)
  const goals = settings.goals || [50, 100, 200, 300, 500, 1000]

  useEffect(() => {
    if (!stats) return
    const p = prev.current
    prev.current = stats
    if (!p || p.event_id !== stats.event_id) return
    const reached = goals.filter((g) => p.presences < g && stats.presences >= g)
    if (reached.length) setCelebration({ goal: Math.max(...reached), until: Date.now() + 9000 })
    const diff = stats.reactions - p.reactions
    if (diff > 0 && stats.last_reaction_emoji && !settings.emergency) {
      const n = Math.min(diff, 6)
      const add = Array.from({ length: n }, (_, i) => ({
        id: ++burstSeq.current,
        emoji: stats.last_reaction_emoji,
        left: 5 + Math.random() * 90,
        delay: i * 0.18,
      }))
      setBursts((b) => [...b.slice(-40), ...add])
      const ids = new Set(add.map((a) => a.id))
      window.setTimeout(() => setBursts((b) => b.filter((x) => !ids.has(x.id))), 5000)
    }
  }, [stats]) // eslint-disable-line react-hooks/exhaustive-deps

  const celebrating = celebration && celebration.until > now && !settings.emergency

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (error || !event)
    return (
      <div className="flex h-screen items-center justify-center text-2xl">
        <p>{error || 'Evento não encontrado.'}</p>
      </div>
    )

  const qrValue = participantUrl(event.slug)

  return (
    <div className={`tv-root relative bg-navy-950 ${showUi ? 'show-cursor' : ''}`}>
      <Backdrop intense />

      {settings.emergency ? (
        <EmergencyScreen event={event} />
      ) : (
        <div className="relative z-10 flex h-full flex-col">
          <Header event={event} stats={stats} live={live && online} />
          <div className="relative flex-1 overflow-hidden px-[3em]">
            {celebrating ? (
              <Celebration goal={celebration!.goal} key={`c-${celebration!.goal}`} />
            ) : (
              <div key={sceneKey} className="absolute inset-0 px-[3em] pb-[1em]">
                {scene === 'messages' && <MessagesScene posts={batch(messages, occurrence, MSG_PER_SCENE)} />}
                {scene === 'photos' && <PhotosScene photos={batch(photos, occurrence, PHOTOS_PER_SCENE)} />}
                {scene === 'videos' && <VideosScene videos={videos} urls={urls} start={occurrence} />}
                {scene === 'counter' && <CounterScene stats={stats} />}
                {scene === 'qr' && <QRScene value={qrValue} />}
                {scene === 'instagram' && <InstagramScene event={event} />}
                {scene === 'invite' && <InviteScene event={event} />}
              </div>
            )}
          </div>
          <Footer event={event} qrValue={qrValue} scene={scene} paused={paused} />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        {bursts.map((b) => (
          <span key={b.id} className="absolute bottom-0 animate-rise text-[5em]" style={{ left: `${b.left}%`, animationDelay: `${b.delay}s` }}>
            {b.emoji}
          </span>
        ))}
      </div>

      {showUi && (
        <div className="no-print absolute right-[1em] top-[1em] z-40 flex gap-2 text-base">
          <button onClick={toggleFullscreen} className="btn-ghost btn-sm bg-navy-900/80">
            Tela cheia (F)
          </button>
        </div>
      )}
    </div>
  )
}

/** Janela que avança a cada exibição e dá a volta na lista, sempre preenchendo todos os espaços. */
function batch<T>(list: T[], occurrence: number, size: number): T[] {
  if (list.length <= size) return list
  const start = (occurrence * size) % list.length
  return Array.from({ length: size }, (_, i) => list[(start + i) % list.length])
}

function Header({ event, stats, live }: { event: EventRow; stats: EventStats | null; live: boolean }) {
  const n = useCountUp(stats?.presences ?? 0, 1500)
  return (
    <header className="relative z-10 flex items-center gap-[1.4em] px-[3em] pb-[1em] pt-[1.6em]">
      <Logo event={event} className="h-[5.6em] w-[5.6em]" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[1em] font-bold uppercase tracking-[.3em] text-gold-300">Ulisses Live · {event.institution.replace('Escola Estadual Cívico-Militar', 'EECM')}</p>
        <h1 className="truncate font-display text-[2.6em] font-black leading-tight">
          <span className="text-silver">{event.name}</span>
        </h1>
        {event.theme && <p className="truncate text-[1.3em] italic text-white/80">{event.theme}</p>}
      </div>
      <div className="gold-border flex items-center gap-[1em] rounded-[1.2em] px-[1.6em] py-[.8em]">
        <span className="relative flex h-[1em] w-[1em]">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex h-[1em] w-[1em] rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </span>
        <div className="text-right">
          <p className="font-display text-[3em] font-black leading-none text-gold">{formatInt(n)}</p>
          <p className="text-[.95em] font-semibold uppercase tracking-widest text-white/70">participantes</p>
        </div>
      </div>
    </header>
  )
}

function Footer({ event, qrValue, scene, paused }: { event: EventRow; qrValue: string; scene: SceneKey; paused: boolean }) {
  const now = useNow(15000)
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' }).format(now)
  return (
    <footer className="relative z-10 flex items-center gap-[1.5em] px-[3em] pb-[1.4em] pt-[.6em]">
      {scene !== 'qr' && (
        <div className="flex items-center gap-[1em]">
          <div className="rounded-[.6em] bg-white p-[.3em]">
            <QR value={qrValue} size={256} className="h-[5em] w-[5em]" />
          </div>
          <p className="font-display text-[1.25em] font-bold leading-tight">
            Escaneie e <span className="text-gold">participe!</span>
          </p>
        </div>
      )}
      <p className="flex-1 text-center font-script text-[1.9em] text-gold-200">{APP_SLOGAN}</p>
      {paused && <span className="chip bg-amber-500/30 text-[1em] text-amber-100">mural pausado</span>}
      {event.instagram_handle && (
        <p className="flex items-center gap-[.4em] text-[1.2em] text-white/80">
          <InstagramIcon className="h-[1.3em] w-[1.3em]" /> {event.instagram_handle}
        </p>
      )}
      <p className="font-display text-[1.4em] font-bold text-white/70">{time}</p>
    </footer>
  )
}

function SceneTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-[1em] animate-fadeUp text-center font-display text-[2.4em] font-black uppercase tracking-wide text-gold">{children}</h2>
}

function MessagesScene({ posts }: { posts: Post[] }) {
  const n = posts.length
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const size = n <= 2 ? 'text-[2.6em]' : n <= 4 ? 'text-[2em]' : 'text-[1.6em]'
  return (
    <div className="flex h-full flex-col">
      <SceneTitle>Mensagens da nossa comunidade</SceneTitle>
      <div className="grid min-h-0 flex-1 gap-[1.4em] pb-[.5em]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0,1fr))` }}>
        {posts.map((p, i) => (
          <article
            key={p.id}
            className="gold-border relative flex min-h-0 animate-fadeUp items-center gap-[1.2em] overflow-hidden rounded-[1.6em] px-[1.8em] py-[1.2em] shadow-2xl"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {p.featured && <span className="absolute right-[1.2em] top-[.6em] chip bg-gold-400 text-[.9em] text-navy-900">★ destaque</span>}
            <span className="shrink-0 animate-float text-[4em] leading-none" style={{ animationDelay: `${i * 0.3}s` }}>
              {p.emoji || '💬'}
            </span>
            <div className="min-w-0">
              <p className={`font-display font-semibold leading-snug ${p.body.length > 120 ? 'text-[1.35em]' : size}`}>“{p.body}”</p>
              <p className="mt-[.5em] text-[1.3em] font-bold text-gold-300">— {p.author_name}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PhotosScene({ photos }: { photos: PhotoItem[] }) {
  const [first, ...rest] = photos
  return (
    <div className="flex h-full flex-col">
      <SceneTitle>Olhares da Feira</SceneTitle>
      <div className={`grid min-h-0 flex-1 gap-[1em] ${rest.length ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1'}`}>
        {first && <PhotoTile p={first} className={rest.length ? 'col-span-2 row-span-2' : ''} big delay={0} />}
        {rest.map((p, i) => (
          <PhotoTile key={p.key} p={p} delay={(i + 1) * 0.15} />
        ))}
      </div>
    </div>
  )
}

function PhotoTile({ p, className = '', big = false, delay }: { p: PhotoItem; className?: string; big?: boolean; delay: number }) {
  return (
    <figure className={`relative min-h-0 animate-pop overflow-hidden rounded-[1.4em] border-2 border-gold-400/50 bg-navy-900 shadow-2xl ${className}`} style={{ animationDelay: `${delay}s` }}>
      <img src={p.url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />
      <img src={p.url} alt={p.caption || `Foto de ${p.author}`} className="relative h-full w-full animate-kenburns object-contain" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-[1em] pt-[2.5em]">
        {p.caption && <p className={`font-semibold leading-snug ${big ? 'text-[1.6em]' : 'text-[1.1em]'} line-clamp-2`}>{p.caption}</p>}
        <p className={`font-bold text-gold-300 ${big ? 'text-[1.3em]' : 'text-[1em]'}`}>
          {p.emoji} {p.author}
        </p>
      </figcaption>
    </figure>
  )
}

function VideosScene({ videos, urls, start }: { videos: Post[]; urls: Record<string, string>; start: number }) {
  const [offset, setOffset] = useState(0)
  const v = videos[(start + offset) % videos.length]
  if (!v) return null
  const m = v.media[0]
  const next = () => setOffset((o) => o + 1)
  return (
    <div className="flex h-full items-center gap-[3em]">
      <div className="relative h-full flex-[1.4] overflow-hidden rounded-[1.6em] border-2 border-gold-400/60 bg-black shadow-2xl">
        <video
          key={v.id + offset}
          src={urls[m.path]}
          poster={m.poster ? urls[m.poster] : undefined}
          className="h-full w-full object-contain"
          autoPlay
          muted
          playsInline
          onEnded={next}
          onError={next}
        />
      </div>
      <div className="flex-1 animate-fadeUp">
        <p className="font-display text-[1.4em] font-bold uppercase tracking-[.3em] text-royal-300">Vídeos da comunidade</p>
        <p className="mt-[.4em] text-[5em] leading-none">{v.emoji || '🎬'}</p>
        {v.body && <p className="mt-[.5em] font-display text-[2.4em] font-bold leading-tight">{v.body}</p>}
        <p className="mt-[.6em] text-[1.8em] font-bold text-gold-300">— {v.author_name}</p>
      </div>
    </div>
  )
}

function CounterScene({ stats }: { stats: EventStats | null }) {
  const n = useCountUp(stats?.presences ?? 0, 2200)
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="animate-fadeUp font-display text-[4em] font-black tracking-[.2em] text-silver">JÁ SOMOS</p>
      <p className="animate-pop font-display text-[15em] font-black leading-none text-gold drop-shadow-[0_0_40px_rgba(242,201,76,.45)]">{formatInt(n)}</p>
      <p className="animate-fadeUp font-display text-[4em] font-black tracking-[.15em] text-silver [animation-delay:.3s]">PARTICIPANTES!</p>
      {stats && (
        <div className="mt-[2em] flex gap-[2.5em] text-[1.6em] text-white/85">
          <span>💬 {formatInt(stats.messages)} mensagens</span>
          <span>📸 {formatInt(stats.photos)} fotos</span>
          <span>🎬 {formatInt(stats.videos)} vídeos</span>
          <span>👏 {formatInt(stats.reactions)} reações</span>
        </div>
      )}
      <p className="mt-[1.2em] text-[1em] text-white/45">Presenças registradas por navegador nesta feira</p>
    </div>
  )
}

function QRScene({ value }: { value: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-[5em]">
      <div className="relative animate-pop">
        <div className="absolute -inset-[1.2em] animate-pulse rounded-[2.4em] bg-gold-400/30 blur-2xl" />
        <div className="gold-border relative rounded-[2em] bg-white p-[1.4em]" style={{ background: 'white' }}>
          <QR value={value} size={900} className="h-[30em] w-[30em]" alt="QR Code para participar" />
        </div>
      </div>
      <div className="max-w-[40em] animate-fadeUp">
        <p className="font-display text-[5.2em] font-black leading-[1.05]">
          <span className="text-silver">Escaneie.</span>
          <br />
          <span className="text-gold">Participe.</span>
          <br />
          <span className="text-silver">Compartilhe.</span>
        </p>
        <p className="mt-[1em] text-[2em] font-semibold text-white/90">Registre sua presença e faça parte da nossa história!</p>
        <ol className="mt-[1.4em] space-y-[.5em] text-[1.5em] text-white/80">
          <li>1. Aponte a câmera do celular para o código</li>
          <li>2. Abra o link: sua presença é registrada na hora</li>
          <li>3. Envie mensagens, fotos, vídeos e reações para o telão</li>
        </ol>
      </div>
    </div>
  )
}

function InstagramScene({ event }: { event: EventRow }) {
  return (
    <div className="flex h-full items-center justify-center gap-[5em]">
      <div className="animate-pop rounded-[2.4em] bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[.6em] shadow-[0_0_80px_rgba(214,41,118,.5)]">
        <div className="rounded-[2em] bg-white p-[1.4em] text-center">
          <QR value={event.instagram_url} size={800} dark="#5b2a86" className="h-[24em] w-[24em]" alt="QR Code do Instagram da escola" />
          <p className="mt-[.6em] flex items-center justify-center gap-[.4em] text-[1.6em] font-bold text-[#5b2a86]">
            <InstagramIcon className="h-[1.3em] w-[1.3em]" /> {event.instagram_handle}
          </p>
        </div>
      </div>
      <div className="max-w-[44em] animate-fadeUp">
        <p className="font-display text-[4.4em] font-black leading-tight">
          <span className="text-silver">Conecte-se com a</span> <span className="text-gold">nossa escola!</span>
        </p>
        <p className="mt-[.8em] text-[2em] leading-snug text-white/90">Acompanhe nossos projetos, atividades, conquistas e eventos.</p>
        <p className="mt-[.6em] text-[1.7em] leading-snug text-white/75">Confira também os melhores momentos da {event.name} em nosso Instagram.</p>
      </div>
    </div>
  )
}

function InviteScene({ event }: { event: EventRow }) {
  const year = event.name.match(/\d{4}$/)?.[0] || ''
  return (
    <div className="flex h-full items-center justify-center gap-[4em] py-[1em]">
      <video
        src={asset('brand/convite.mp4')}
        poster={asset('brand/convite-720.jpg')}
        className="h-full max-h-full animate-pop rounded-[1.6em] border-2 border-gold-400/60 shadow-2xl"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="max-w-[48em] animate-fadeUp">
        <p className="font-script text-[3.2em] leading-tight text-gold-200">Bem-vindos à</p>
        <p className="font-display text-[4.4em] font-black leading-[1.05]">
          <span className="text-silver">{year ? event.name.replace(/\s\d{4}$/, '') : event.name}</span> {year && <span className="text-gold">{year}</span>}
        </p>
        {event.theme && <p className="mt-[.6em] text-[2em] italic text-white/90">{event.theme}</p>}
        <div className="mt-[1.2em] flex flex-wrap gap-[.6em] text-[1.2em]">
          {['Literatura e Cultura', 'Ciência e Tecnologia', 'Meio Ambiente e Sustentabilidade', 'Sociedade e Cidadania', 'Inovação'].map((t) => (
            <span key={t} className="rounded-full border border-gold-400/50 bg-white/5 px-[1em] py-[.3em]">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Celebration({ goal }: { goal: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 3 + Math.random() * 3,
        color: ['#f2c94c', '#ffffff', '#4f8bff', '#ffe08a', '#86b0ff'][i % 5],
        size: 0.6 + Math.random() * 0.9,
      })),
    [],
  )
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti rounded-sm"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, width: `${p.size}em`, height: `${p.size * 1.6}em` }}
        />
      ))}
      <p className="animate-pop text-[8em]">🎉</p>
      <p className="animate-fadeUp font-display text-[4em] font-black text-silver">CHEGAMOS A</p>
      <p className="animate-pop font-display text-[14em] font-black leading-none text-gold drop-shadow-[0_0_50px_rgba(242,201,76,.6)]">{formatInt(goal)}</p>
      <p className="animate-fadeUp font-display text-[4em] font-black text-silver">PARTICIPANTES!</p>
      <p className="mt-[.6em] text-[2em] text-white/85">Obrigado por fazer parte desta história! 💙💛</p>
    </div>
  )
}

function EmergencyScreen({ event }: { event: EventRow }) {
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
      <Logo event={event} className="h-[14em] w-[14em]" />
      <h1 className="mt-[1em] font-display text-[4em] font-black text-silver">{event.name}</h1>
      <p className="mt-[.4em] text-[2em] text-white/80">{event.institution}</p>
      <p className="mt-[2em] font-script text-[3em] text-gold-200">{APP_SLOGAN}</p>
    </div>
  )
}
