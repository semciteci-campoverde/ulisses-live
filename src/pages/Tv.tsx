import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { INSTAGRAM_BLURB } from '../../shared/constants.ts'
import type { PublicEvent, PublicPost } from '../../shared/types.ts'
import { QrImage } from '../components/QrImage.tsx'
import { SchoolLogo, Sky } from '../components/Sky.tsx'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'

type SceneId = 'messages' | 'photos' | 'videos' | 'counter' | 'invite' | 'instagram' | 'celebration'

const PIECES = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.25}s`,
  color: index % 2 ? '#f0c14d' : '#7eb6ff',
}))

export function TvPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event, posts, connected, clockOffset } = useLiveEvent(slug)
  const [now, setNow] = useState(Date.now())

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

  const serverNow = now + clockOffset
  const celebrating = Boolean(event?.celebrationUntil && Date.parse(event.celebrationUntil) > serverNow)

  const scenes = useMemo(() => buildScenes(event, posts), [event, posts])
  if (!event) {
    return (
      <div className="tv-root">
        <div className="scene quote"><h1 className="display gold-text" style={{ fontSize: '8vw' }}>ULISSES LIVE</h1></div>
      </div>
    )
  }

  const duration = Math.max(8, event.sceneDurationSeconds) * 1000
  const elapsed = Math.max(0, serverNow - Date.parse(event.tvEpoch))
  const index = Math.floor(elapsed / duration) % scenes.length
  const progress = (elapsed % duration) / duration
  const messages = posts.filter((post) => post.type === 'message')
  const photos = posts.filter((post) => post.type === 'photo' && post.media.length)
  const videos = posts.filter((post) => post.type === 'video' && post.media.length)
  const origin = window.location.origin
  const participate = origin + withEvent('/participar', slug)

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
        <div className="tv-top-count" style={{ textAlign: 'right' }}>
          <div className="cinzel" style={{ fontSize: '1.4vh' }}>Já somos</div>
          <div className="display gold-text" style={{ fontSize: '7vh', lineHeight: 0.85 }}>{event.presenceCount}</div>
          <div style={{ fontSize: '1.5vh', opacity: 0.8 }}>presenças por navegador</div>
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
            photos={photos}
            videos={videos}
            participate={participate}
            page={Math.floor(elapsed / duration)}
            goal={event.celebrationGoal || event.presenceCount}
          />
        ) : (
          <LiveBoard
            key={index}
            event={event}
            messages={messages}
            photos={photos}
            videos={videos}
            participate={participate}
            page={Math.floor(elapsed / duration)}
            mural={event.muralEnabled}
          />
        )}
      </main>

      <footer className="tv-bottom">
        <div>{event.slogan}</div>
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

function LiveBoard(props: {
  event: PublicEvent
  messages: PublicPost[]
  photos: PublicPost[]
  videos: PublicPost[]
  participate: string
  page: number
  mural: boolean
}) {
  const { event, messages, photos, videos, participate, page, mural } = props
  const message = messages.length ? messages[page % messages.length] : null
  const photo = photos.length ? photos[page % photos.length] : null
  const video = videos.length ? videos[page % videos.length] : null
  const showInvite = page % 5 === 4 || !message
  return (
    <section className="tv-board scene">
      <div className="tv-feature">
        {showInvite || !mural ? (
          <div className="tv-invite">
            <div>
              <p className="script" style={{ fontSize: '5vh', margin: 0 }}>Escaneie. Participe. Compartilhe.</p>
              <h2 className="display gold-text" style={{ fontSize: '5.2vh', margin: '0.4vh 0' }}>Registre sua presença e deixe uma mensagem.</h2>
              <p>As positivas entram no painel na hora. Fotos e vídeos passam pela equipe.</p>
            </div>
            <div className="qr-frame">
              <QrImage value={participate} label="QR Code de presença da Feira do Conhecimento" />
            </div>
          </div>
        ) : message ? (
          <div className="quote" style={{ borderLeft: '4px solid rgba(240,193,77,.9)', paddingLeft: '2vw' }}>
            <p className="script" style={{ fontSize: '4.6vh', margin: 0, color: '#fff6d8' }}>Mensagens da feira</p>
            <blockquote style={{ fontSize: 'clamp(26px, 3.3vw, 54px)', margin: '1vh 0', fontWeight: 650 }}>"{message.body}"</blockquote>
            <div style={{ fontSize: '2.6vh', color: 'var(--gold-2)' }}>{message.authorName} {message.emoji}</div>
          </div>
        ) : null}
      </div>
      <aside className="tv-side">
        <div className="tv-counter-card">
          <div className="cinzel" style={{ color: 'var(--gold-2)' }}>Já somos</div>
          <div className="num gold-text">{event.presenceCount}</div>
          <div>presenças por navegador</div>
        </div>
        <div className="tv-thumbs">
          <figure>
            {mural && photo ? (
              <>
                <img src={photo.media[0].url} alt={photo.body || `Foto de ${photo.authorName || 'participante'}`} />
                <figcaption className="cap">{photo.authorName}{photo.body ? ` — ${photo.body}` : ''}</figcaption>
              </>
            ) : (
              <div className="tv-empty">Fotos aprovadas aparecem aqui</div>
            )}
          </figure>
          <figure>
            {mural && video ? (
              <>
                <video key={video.id} src={video.media[0].url} autoPlay muted playsInline loop />
                <figcaption className="cap">{video.authorName} · sem áudio</figcaption>
              </>
            ) : (
              <div className="tv-empty">Vídeos aprovados aparecem aqui</div>
            )}
          </figure>
        </div>
      </aside>
    </section>
  )
}

function buildScenes(event: PublicEvent | null, posts: PublicPost[]): SceneId[] {
  if (!event) return ['invite']
  const list: SceneId[] = []
  if (event.muralEnabled && event.scenes.messages && posts.some((post) => post.type === 'message')) list.push('messages')
  if (event.muralEnabled && event.scenes.photos && posts.some((post) => post.type === 'photo' && post.media.length)) list.push('photos')
  if (event.muralEnabled && event.scenes.videos && posts.some((post) => post.type === 'video' && post.media.length)) list.push('videos')
  if (event.scenes.counter) list.push('counter')
  if (event.scenes.invite) list.push('invite')
  if (event.scenes.instagram) list.push('instagram')
  return list.length ? list : ['invite']
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
