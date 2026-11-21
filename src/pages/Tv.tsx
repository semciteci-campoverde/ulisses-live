import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { INSTAGRAM_BLURB } from '../../shared/constants.ts'
import type { PublicEvent, PublicPost } from '../../shared/types.ts'
import { QrImage } from '../components/QrImage.tsx'
import { SchoolLogo, Sky } from '../components/Sky.tsx'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'
import { useRoulette } from '../lib/useRoulette.ts'

type SceneId = 'messages' | 'photos' | 'videos' | 'counter' | 'invite' | 'instagram' | 'celebration'

const PIECES = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.25}s`,
  color: index % 2 ? '#f0c14d' : '#7eb6ff',
}))

const EMPTY: never[] = []
const MESSAGE_MS = 7500
const PHOTO_MS = 6000
const VIDEO_MS = 12000
const REACTION_MS = 3500
const FULL_REFRESH_MS = 60000
const HARD_RELOAD_MS = 2 * 60 * 60 * 1000

interface MediaSlide {
  id: string
  createdAt: string
  post: PublicPost
  url: string
  seconds: number | null
}

interface FloatingEmoji {
  key: string
  emoji: string
  left: number
  size: number
}

function slidesOf(posts: PublicPost[], type: 'photo' | 'video', prefix: string): MediaSlide[] {
  return posts
    .filter((post) => post.type === type)
    .flatMap((post) =>
      post.media
        .filter((media) => media.url && media.mime.startsWith(prefix))
        .map((media) => ({ id: `${post.id}:${media.id}`, createdAt: post.createdAt, post, url: media.url, seconds: media.durationSeconds })),
    )
}

export function TvPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event, posts, connected, clockOffset, reload } = useLiveEvent(slug)
  const [now, setNow] = useState(Date.now())
  const [floats, setFloats] = useState<FloatingEmoji[]>([])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Tela sempre acesa (Wake Lock) e cursor escondido quando o mouse fica parado.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const ask = () => {
      if (document.visibilityState === 'visible' && nav.wakeLock) nav.wakeLock.request('screen').then((l) => { lock = l }, () => {})
    }
    ask()
    document.addEventListener('visibilitychange', ask)
    let idle = 0
    const moved = () => {
      document.body.classList.remove('tv-nocursor')
      window.clearTimeout(idle)
      idle = window.setTimeout(() => document.body.classList.add('tv-nocursor'), 3000)
    }
    moved()
    window.addEventListener('mousemove', moved)
    return () => {
      document.removeEventListener('visibilitychange', ask)
      window.removeEventListener('mousemove', moved)
      window.clearTimeout(idle)
      document.body.classList.remove('tv-nocursor')
      void lock?.release().catch(() => {})
    }
  }, [])

  // Recarga completa a cada 60 s, além do tempo real e da checagem curta do useLiveEvent.
  useEffect(() => {
    const timer = window.setInterval(() => reload(), FULL_REFRESH_MS)
    // Recarrega a página inteira a cada 2 h (se houver internet) para manter a TV leve por horas.
    const hard = window.setInterval(() => {
      if (navigator.onLine) window.location.reload()
    }, HARD_RELOAD_MS)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(hard)
    }
  }, [reload])

  const mural = Boolean(event?.muralEnabled)
  const showMessages = mural && event?.scenes.messages !== false
  const showPhotos = mural && event?.scenes.photos !== false
  const showVideos = mural && event?.scenes.videos !== false
  const messages = useMemo(() => posts.filter((post) => post.type === 'message' && post.body), [posts])
  const photos = useMemo(() => slidesOf(posts, 'photo', 'image/'), [posts])
  // Vídeos que esta TV não consegue mostrar (ex.: HEVC do iPhone sem suporte no aparelho) saem da roleta.
  const [badVideos, setBadVideos] = useState<Set<string>>(() => new Set())
  const videos = useMemo(() => slidesOf(posts, 'video', 'video/').filter((clip) => !badVideos.has(clip.id)), [posts, badVideos])
  const reactions = useMemo(() => posts.filter((post) => post.type === 'reaction' && post.emoji), [posts])

  const msgR = useRoulette(showMessages ? messages : EMPTY, () => MESSAGE_MS)
  const photoR = useRoulette(showPhotos ? photos : EMPTY, () => PHOTO_MS)
  const videoR = useRoulette(showVideos ? videos : EMPTY, (clip) =>
    clip.seconds && clip.seconds > 0 ? Math.max(4000, Math.min(VIDEO_MS, clip.seconds * 1000)) : VIDEO_MS,
  )
  const reactR = useRoulette(mural ? reactions : EMPTY, () => REACTION_MS)
  const advanceVideo = videoR.advance
  const markBadVideo = (id?: string) => {
    if (!id) return
    setBadVideos((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    advanceVideo()
  }
  // Proporção (largura/altura) da foto e do vídeo atuais: decide se os painéis ficam lado a lado ou empilhados
  const [aspect, setAspect] = useState<{ p?: number; v?: number }>({})
  const both = !!(photoR.current && videoR.current)
  const pAr = aspect.p ?? 0.75, vAr = aspect.v ?? 0.75
  const stacked = both && pAr > 1.15 && vAr > 1.15
  const clampAr = (n: number) => Math.min(1.78, Math.max(0.56, n))
  const mediaStyle = both && !stacked ? { gridTemplateColumns: `minmax(0, ${clampAr(pAr)}fr) minmax(0, ${clampAr(vAr)}fr)` } : undefined

  // Emojis flutuantes para cada reação nova que chega.
  const freshReactions = reactR.freshIds
  useEffect(() => {
    if (!freshReactions.length) return
    const byId = new Map(reactions.map((post) => [post.id, post]))
    const added: FloatingEmoji[] = freshReactions.slice(0, 12).flatMap((id, n) => {
      const post = byId.get(id)
      if (!post?.emoji) return []
      return [0, 1, 2].map((k) => ({
        key: `${id}-${k}-${Date.now()}`,
        emoji: post.emoji as string,
        left: 6 + ((n * 23 + k * 31 + Math.floor(Math.random() * 40)) % 88),
        size: 5 + ((n + k) % 3) * 2,
      }))
    })
    if (!added.length) return
    setFloats((list) => [...list, ...added].slice(-36))
    const keys = new Set(added.map((item) => item.key))
    const timer = window.setTimeout(() => setFloats((list) => list.filter((item) => !keys.has(item.key))), 5200)
    return () => window.clearTimeout(timer)
    // reactions muda junto com freshIds; usar só freshIds evita disparos repetidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshReactions])

  const reactionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of reactions) counts.set(post.emoji as string, (counts.get(post.emoji as string) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [reactions])

  const serverNow = now + clockOffset
  const celebrating = Boolean(event?.celebrationUntil && Date.parse(event.celebrationUntil) > serverNow)

  if (!event) {
    return (
      <div className="tv-root">
        <div className="scene quote"><h1 className="display gold-text" style={{ fontSize: '8vw' }}>ULISSES LIVE</h1></div>
      </div>
    )
  }

  const duration = Math.max(8, event.sceneDurationSeconds) * 1000
  const elapsed = Math.max(0, serverNow - Date.parse(event.tvEpoch))
  const progress = msgR.current && msgR.duration ? Math.min(1, (now - msgR.startedAt) / msgR.duration) : (elapsed % duration) / duration
  const origin = window.location.origin
  const participate = origin + withEvent('/participar', slug)
  const allPhotos = posts.filter((post) => post.type === 'photo' && post.media.length)
  const allVideos = posts.filter((post) => post.type === 'video' && post.media.length)

  return (
    <div className="tv-root">
      <Sky />
      <header className="tv-top">
        <div className="brand-lockup">
          <SchoolLogo src={event.logoUrl} />
          <div>
            <div className="cinzel" style={{ color: 'var(--gold-2)', fontSize: '1.5vh' }}>{event.institution}</div>
            <div className="display" style={{ fontSize: '4.2vh' }}>{event.name}</div>
          </div>
        </div>
        <div className="tv-top-right">
          <div className="tv-count-pill" data-testid="tv-count">
            <span className="cinzel">Já somos</span>
            <strong className="gold-text">{event.presenceCount}</strong>
            <span>presenças</span>
          </div>
          <div className="tv-top-qr">
            <div className="tv-top-qr-text">
              <div className="cinzel" style={{ color: 'var(--gold-2)' }}>Escaneie e participe</div>
              <div>Sua mensagem aparece aqui</div>
            </div>
            <div className="qr-frame">
              <QrImage value={participate} label="QR Code de presença da Feira do Conhecimento" />
            </div>
          </div>
        </div>
      </header>

      <main className="tv-stage">
        {event.emergencyStop ? (
          <section className="scene quote" style={{ textAlign: 'center' }}>
            <p className="script" style={{ fontSize: '6vh', margin: 0 }}>Aguarde</p>
            <h2 className="display gold-text" style={{ fontSize: '8vh' }}>Exibição interrompida pela organização</h2>
            <p>A programação visual volta em instantes.</p>
          </section>
        ) : celebrating ? (
          <SceneView
            scene="celebration"
            event={event}
            messages={messages}
            photos={allPhotos}
            videos={allVideos}
            participate={participate}
            page={Math.floor(elapsed / duration)}
            goal={event.celebrationGoal || event.presenceCount}
          />
        ) : (
          <section className={`tv-board2${photoR.current && videoR.current ? '' : ' one'}`}>
            <div className={`tv-media${stacked ? ' stacked' : ''}`} style={mediaStyle}>
              {photoR.current && (
                <figure className="tv-pane" data-kind="foto">
                  <div className="tv-pane-bg" style={{ backgroundImage: `url("${photoR.current.url}")` }} aria-hidden="true" />
                  <img key={`${photoR.current.id}-${photoR.turn}`} className="tv-pane-media tv-fade" src={photoR.current.url} data-testid="tv-photo" data-id={photoR.current.id}
                    onLoad={(e) => { const im = e.currentTarget; if (im.naturalHeight) setAspect((a) => ({ ...a, p: im.naturalWidth / im.naturalHeight })) }}
                    alt={photoR.current.post.body || `Foto de ${photoR.current.post.authorName || 'participante'}`} />
                  <span className="tv-chip tv-chip-kind">📸 Foto <span className="tv-pos">{photoR.position}/{photoR.total}</span></span>
                  <figcaption className="tv-chip tv-chip-cap">
                    <strong>{photoR.current.post.authorName || 'Participante'}</strong>{photoR.current.post.body ? ` · ${photoR.current.post.body}` : ''}
                  </figcaption>
                </figure>
              )}
              {videoR.current && (
                <figure className="tv-pane" data-kind="video">
                  <div className="tv-pane-bg video" aria-hidden="true" />
                  <video key={`${videoR.current.id}-${videoR.turn}`} className="tv-pane-media tv-fade" src={videoR.current.url} data-testid="tv-video" data-id={videoR.current.id}
                    onLoadedMetadata={(e) => { const vd = e.currentTarget; if (vd.videoHeight) setAspect((a) => ({ ...a, v: vd.videoWidth / vd.videoHeight })) }}
                    onTimeUpdate={(e) => {
                      // Toca mas sem imagem (codec sem suporte): tira da roleta desta TV.
                      const vd = e.currentTarget
                      if (vd.currentTime > 1.2 && !vd.videoWidth) markBadVideo(videoR.current?.id)
                    }}
                    autoPlay muted playsInline preload="auto"
                    onEnded={videoR.advance}
                    onError={() => markBadVideo(videoR.current?.id)} />
                  <span className="tv-chip tv-chip-kind">🎬 Vídeo <span className="tv-pos">{videoR.position}/{videoR.total}</span></span>
                  <figcaption className="tv-chip tv-chip-cap">
                    <strong>{videoR.current.post.authorName || 'Participante'}</strong> · sem áudio
                  </figcaption>
                </figure>
              )}
              {!photoR.current && !videoR.current && (
                <div className="tv-media-empty">
                  <div style={{ fontSize: '9vh' }}>📸🎬</div>
                  <h2 className="display">Fotos e vídeos da feira aparecem aqui</h2>
                  <p>Envie pelo QR Code. A equipe aprova e eles entram na tela.</p>
                </div>
              )}
            </div>
            <aside className="tv-msgs">
              {msgR.current ? (
                <div key={`${msgR.current.id}-${msgR.turn}`} className={`tv-msg-card c${(msgR.position - 1) % 6} tv-pop`} data-testid="tv-message" data-id={msgR.current.id}>
                  <div className="tv-msg-head">
                    <span>💬 Mensagens</span>
                    <span className="tv-pos">{msgR.position} de {msgR.total}</span>
                  </div>
                  <div className="tv-quote-mark" aria-hidden="true">“</div>
                  <blockquote className={(msgR.current.body || '').length > 90 ? 'long' : ''}>{msgR.current.body}</blockquote>
                  <div className="tv-msg-author">
                    {msgR.current.emoji && <span className="tv-msg-emoji">{msgR.current.emoji}</span>}
                    <span>{msgR.current.authorName || 'Visitante'}</span>
                  </div>
                </div>
              ) : (
                <div className="tv-msg-card c0 tv-invite-card">
                  <p className="script" style={{ fontSize: '4.4vh', margin: 0 }}>Escaneie e participe!</p>
                  <h2 className="display" style={{ fontSize: '4.4vh', margin: '1vh 0' }}>Deixe sua mensagem para a feira</h2>
                  <div className="qr-frame"><QrImage value={participate} label="QR Code de presença da Feira do Conhecimento" /></div>
                  <p>As mensagens positivas aparecem aqui na hora.</p>
                </div>
              )}
            </aside>
          </section>
        )}
      </main>

      {floats.length > 0 && (
        <div className="tv-floats" aria-hidden="true">
          {floats.map((item) => (
            <span key={item.key} style={{ left: `${item.left}%`, fontSize: `${item.size}vh` }}>{item.emoji}</span>
          ))}
        </div>
      )}

      <footer className="tv-bottom">
        <div className="tv-slogan">{event.slogan}</div>
        {mural && reactionCounts.length > 0 && (
          <div className="tv-reactions" data-testid="tv-reactions">
            {reactR.current && (
              <span key={`${reactR.current.id}-${reactR.turn}`} className="tv-react-now tv-fade">
                {reactR.current.emoji} {reactR.current.authorName || 'Visitante'}
              </span>
            )}
            {reactionCounts.slice(0, 6).map(([emoji, count]) => (
              <span key={emoji} className="tv-react-count">{emoji} {count}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={connected ? 'live-dot' : 'live-dot off'} />
          {connected ? 'Ao vivo' : 'Reconectando'}
          <button className="btn-ghost" style={{ padding: '.35rem .7rem' }} onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
            Tela cheia
          </button>
        </div>
      </footer>
      <div className="progress" aria-hidden="true"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
    </div>
  )
}

function SceneView(props: {
  scene: SceneId
  event: PublicEvent
  messages: PublicPost[]
  photos: PublicPost[]
  videos: PublicPost[]
  participate: string
  page: number
  goal: number
}) {
  const { scene, event, messages, photos, videos, participate, page, goal } = props
  if (scene === 'messages' && messages.length) {
    const post = messages[page % messages.length]
    return (
      <section className="scene quote" style={{ borderLeft: '4px solid rgba(240,193,77,.85)', paddingLeft: '3vw' }}>
        <div className="float-emoji" style={{ right: '8%', top: '10%' }}>{post.emoji || '✨'}</div>
        <p className="script" style={{ fontSize: '6vh', margin: 0, color: '#fff6d8' }}>Mensagens da feira</p>
        <blockquote style={{ fontSize: 'clamp(28px, 4vw, 64px)', margin: '1vh 0', fontWeight: 650 }}>"{post.body}"</blockquote>
        <div style={{ fontSize: '3vh', color: 'var(--gold-2)' }}>{post.authorName} {post.emoji}</div>
      </section>
    )
  }
  if (scene === 'photos') {
    const slice = photos.slice((page % Math.max(1, Math.ceil(photos.length / 6))) * 6, (page % Math.max(1, Math.ceil(photos.length / 6))) * 6 + 6)
    const shown = slice.length ? slice : photos.slice(0, 6)
    return (
      <section className="scene mosaic">
        {shown.map((post) => (
          <figure key={post.id}>
            <img src={post.media[0].url} alt={post.body || `Fotografia de ${post.authorName || 'participante'}`} />
            <figcaption className="cap">{post.authorName}{post.body ? ` — ${post.body}` : ''}</figcaption>
          </figure>
        ))}
      </section>
    )
  }
  if (scene === 'videos' && videos.length) {
    const post = videos[page % videos.length]
    return (
      <section className="scene video-stage" style={{ height: '100%', position: 'relative' }}>
        <video key={post.id} src={post.media[0].url} autoPlay muted playsInline />
        <div className="cap">{post.authorName}{post.body ? ` — ${post.body}` : ''} · áudio desligado</div>
      </section>
    )
  }
  if (scene === 'celebration') {
    return (
      <section className="scene quote" style={{ textAlign: 'center' }}>
        <div className="confetti" aria-hidden="true">
          {PIECES.map((piece) => <i key={piece.left + piece.delay} style={{ left: piece.left, animationDelay: piece.delay, background: piece.color }} />)}
        </div>
        <p className="script" style={{ fontSize: '7vh' }}>Celebrar</p>
        <div className="counter-num gold-text">{goal}</div>
        <h2 className="display" style={{ fontSize: '6vh' }}>PARTICIPANTES NESTA META</h2>
      </section>
    )
  }
  if (scene === 'instagram') {
    return (
      <section className="scene" style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: '3vw', alignItems: 'center', height: '100%' }}>
        <div>
          <p className="script" style={{ fontSize: '6vh', margin: 0 }}>Conecte-se</p>
          <h2 className="display gold-text" style={{ fontSize: '7vh', margin: 0 }}>com a nossa escola!</h2>
          <p style={{ fontSize: '2.4vh', maxWidth: '46vw' }}>{INSTAGRAM_BLURB}</p>
          <strong style={{ fontSize: '3vh' }}>{event.instagramHandle}</strong>
        </div>
        <div>
          <div className="qr-frame ig">
            <QrImage value={event.instagramUrl} label="QR Code do Instagram da escola" dark="#4f5bd5" />
          </div>
          <div style={{ marginTop: 8 }}>QR do Instagram — diferente do QR de presença</div>
        </div>
      </section>
    )
  }
  if (scene === 'counter') {
    return (
      <section className="scene quote" style={{ textAlign: 'center' }}>
        <div className="cinzel">Já somos</div>
        <div className="counter-num gold-text">{event.presenceCount}</div>
        <h2 className="display" style={{ fontSize: '6vh' }}>PRESENÇAS REGISTRADAS</h2>
        <p>Por navegador. Não é a lotação deste instante nem a contagem de pessoas físicas.</p>
      </section>
    )
  }
  return (
    <section className="scene" style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: '3vw', alignItems: 'center', height: '100%' }}>
      <div>
        <p className="script" style={{ fontSize: '6vh', margin: 0 }}>Escaneie. Participe. Compartilhe.</p>
        <h2 className="display gold-text" style={{ fontSize: '6vh' }}>Registre sua presença e faça parte da nossa história!</h2>
        <p>{event.theme}</p>
      </div>
      <div className="qr-frame">
        <QrImage value={participate} label="QR Code de presença da Feira do Conhecimento" />
      </div>
    </section>
  )
}
