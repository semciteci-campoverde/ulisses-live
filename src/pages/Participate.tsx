import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LIMITS, MESSAGE_EMOJIS, REACTION_EMOJIS } from '../config'
import { PrivacyNotice } from '../components/Privacy'
import { Backdrop, EmojiPicker, InstagramIcon, Logo, Sheet, Spinner, Toast } from '../components/ui'
import { formatInt, useCountUp, useEvent, useStats } from '../lib/hooks'
import { compressImage, prepareVideo, uploadImages, uploadVideo, type PreparedImage, type PreparedVideo } from '../lib/media'
import { friendlyError, supabase } from '../lib/supabase'
import type { EventRow, MediaItem } from '../lib/types'
import { getSavedName, getVisitorId, saveName } from '../lib/visitor'

type SheetKey = 'message' | 'photo' | 'video' | 'reaction' | 'feedback' | 'privacy' | null
type ToastState = { message: string; tone: 'ok' | 'warn' | 'error' } | null

export default function Participate() {
  const { event, loading, error } = useEvent()
  const { stats } = useStats(event?.id)
  const visitor = useMemo(getVisitorId, [])
  const [presence, setPresence] = useState<{ state: 'pending' | 'ok' | 'error'; isNew?: boolean; message?: string }>({ state: 'pending' })
  const [sheet, setSheet] = useState<SheetKey>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const total = useCountUp(stats?.presences ?? 0)

  const register = useCallback(async (ev: EventRow) => {
    setPresence({ state: 'pending' })
    const { data, error: err } = await supabase.rpc('register_presence', { p_event: ev.id, p_visitor: visitor })
    if (err) setPresence({ state: 'error', message: friendlyError(err) })
    else setPresence({ state: 'ok', isNew: Boolean((data as { is_new?: boolean })?.is_new) })
  }, [visitor])

  useEffect(() => {
    if (event && event.status === 'active') void register(event)
  }, [event?.id, event?.status, register]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => setSheet(null), [])
  const done = useCallback((message: string, tone: 'ok' | 'warn' = 'ok') => {
    setSheet(null)
    setToast({ message, tone })
  }, [])

  if (loading)
    return (
      <Shell>
        <Spinner label="Carregando o evento..." />
      </Shell>
    )
  if (error || !event)
    return (
      <Shell>
        <p className="glass p-6 text-center">{error || 'Evento não encontrado.'}</p>
      </Shell>
    )

  if (event.status !== 'active')
    return (
      <Shell event={event}>
        <div className="glass p-6 text-center">
          <h2 className="font-display text-2xl font-extrabold text-gold">Evento encerrado</h2>
          <p className="mt-2 text-white/80">Obrigado por fazer parte desta história! Confira os melhores momentos.</p>
          <Link to={`/memorias?e=${event.slug}`} className="btn-gold mt-5 w-full">
            Ver a memória digital
          </Link>
        </div>
      </Shell>
    )

  return (
    <Shell event={event}>
      {event.is_demo && <p className="mb-3 rounded-xl bg-amber-500/20 px-3 py-2 text-center text-sm font-semibold text-amber-200">Modo de teste: nada daqui entra no evento real.</p>}

      <section className="glass relative overflow-hidden p-6 text-center">
        {presence.state === 'pending' && <Spinner label="Registrando sua presença..." />}
        {presence.state === 'error' && (
          <div>
            <p className="font-semibold text-red-200">{presence.message}</p>
            <button className="btn-gold mt-4" onClick={() => void register(event)}>
              Tentar de novo
            </button>
          </div>
        )}
        {presence.state === 'ok' && (
          <div className="animate-pop">
            <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-pulseRing rounded-full bg-gold-400/40" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-3xl text-navy-900 shadow-lg">✓</span>
            </div>
            <h2 className="font-display text-2xl font-black leading-tight">
              <span className="text-gold">Presença confirmada!</span>
              <br />
              <span className="text-white">Você faz parte desta história.</span>
            </h2>
            {!presence.isNew && <p className="mt-2 text-sm text-white/60">Sua presença já estava registrada neste aparelho.</p>}
            <p className="mt-4 text-white/80">
              Já somos <strong className="font-display text-2xl text-gold">{formatInt(total)}</strong> presenças registradas
            </p>
          </div>
        )}
      </section>

      {presence.state === 'ok' && (
        <>
          <h3 className="mt-6 text-center font-display text-lg font-bold text-white/90">Deixe sua marca no telão</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ActionButton icon="💬" title="Enviar mensagem" onClick={() => setSheet('message')} />
            <ActionButton icon="📸" title="Enviar fotografia" onClick={() => setSheet('photo')} />
            <ActionButton icon="🎬" title="Enviar vídeo" onClick={() => setSheet('video')} />
            <ActionButton icon="👏" title="Enviar reação" onClick={() => setSheet('reaction')} />
          </div>

          {event.instagram_url && (
            <a
              href={event.instagram_url}
              target="_blank"
              rel="noreferrer"
              className="btn mt-4 w-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-lg"
            >
              <InstagramIcon className="h-6 w-6" /> Seguir {event.instagram_handle}
            </a>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/60">
            <button className="underline-offset-4 hover:underline" onClick={() => setSheet('feedback')}>
              Sugestão para a organização (privada)
            </button>
            <button className="underline-offset-4 hover:underline" onClick={() => setSheet('privacy')}>
              Privacidade e uso de imagem
            </button>
            <Link to={`/galeria?e=${event.slug}`} className="underline-offset-4 hover:underline">
              Galeria
            </Link>
          </div>
        </>
      )}

      <Sheet open={sheet === 'message'} onClose={close} title="Enviar mensagem">
        <MessageForm event={event} visitor={visitor} onDone={done} />
      </Sheet>
      <Sheet open={sheet === 'photo'} onClose={close} title="Enviar fotografia">
        <PhotoForm event={event} visitor={visitor} onDone={done} onPrivacy={() => setSheet('privacy')} />
      </Sheet>
      <Sheet open={sheet === 'video'} onClose={close} title="Enviar vídeo">
        <VideoForm event={event} visitor={visitor} onDone={done} onPrivacy={() => setSheet('privacy')} />
      </Sheet>
      <Sheet open={sheet === 'reaction'} onClose={close} title="Enviar reação">
        <ReactionPad event={event} visitor={visitor} />
      </Sheet>
      <Sheet open={sheet === 'feedback'} onClose={close} title="Sugestão para a organização">
        <FeedbackForm event={event} visitor={visitor} onDone={done} />
      </Sheet>
      <Sheet open={sheet === 'privacy'} onClose={close} title="Privacidade e uso de imagem">
        <PrivacyNotice event={event} />
      </Sheet>

      {toast && <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </Shell>
  )
}

function Shell({ event, children }: { event?: EventRow | null; children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <Backdrop />
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-10 pt-5">
        <header className="mb-5 flex items-center gap-3">
          <Logo event={event} className="h-14 w-14 shrink-0" />
          <div className="min-w-0 text-left">
            <p className="font-display text-xs font-bold uppercase tracking-[.2em] text-gold-300">Ulisses Live</p>
            <h1 className="truncate font-display text-lg font-extrabold leading-tight">{event?.name || 'Carregando...'}</h1>
            {event?.institution && <p className="truncate text-xs text-white/60">{event.institution}</p>}
          </div>
        </header>
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  )
}

function ActionButton({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="gold-border group flex aspect-[1.1] flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center shadow-xl transition active:scale-[.97]"
    >
      <span className="text-4xl transition group-hover:scale-110">{icon}</span>
      <span className="font-display text-base font-bold leading-tight">{title}</span>
    </button>
  )
}

interface FormProps {
  event: EventRow
  visitor: string
  onDone: (message: string, tone?: 'ok' | 'warn') => void
  onPrivacy?: () => void
}

function statusMessage(status: string, kind: 'message' | 'media') {
  if (status === 'approved') return 'Enviado! Sua mensagem já está no telão. 🎉'
  return kind === 'media'
    ? 'Recebemos! A equipe vai revisar e, se aprovado, aparece no telão em instantes.'
    : 'Recebemos! Sua mensagem aparece no telão assim que a equipe revisar.'
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor="author">
        Seu primeiro nome ou apelido
      </label>
      <input id="author" className="input" maxLength={LIMITS.nameChars} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: Maria" autoComplete="given-name" />
    </div>
  )
}

function Consent({
  image,
  setImage,
  insta,
  setInsta,
  onPrivacy,
}: {
  image: boolean
  setImage: (v: boolean) => void
  insta: boolean
  setInsta: (v: boolean) => void
  onPrivacy?: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-white/5 p-4 text-sm">
      <label className="flex gap-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-yellow-400" checked={image} onChange={(e) => setImage(e.target.checked)} />
        <span>
          <strong>Obrigatório:</strong> as pessoas que aparecem concordaram em ser exibidas (no caso de menores de idade, seus responsáveis) e autorizo a
          exibição no telão e na galeria do evento.
        </span>
      </label>
      <label className="flex gap-3">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-yellow-400" checked={insta} onChange={(e) => setInsta(e.target.checked)} />
        <span>Opcional: autorizo também a escola a publicar este conteúdo no Instagram oficial.</span>
      </label>
      {onPrivacy && (
        <button type="button" onClick={onPrivacy} className="text-white/60 underline underline-offset-4">
          Ler o aviso de privacidade
        </button>
      )}
    </div>
  )
}

function MessageForm({ event, visitor, onDone }: FormProps) {
  const [name, setName] = useState(getSavedName)
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState('👏')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (name.trim().length < 2) return setErr('Informe seu nome ou apelido.')
    if (text.trim().length < 2) return setErr('Escreva sua mensagem.')
    setBusy(true)
    saveName(name.trim())
    const { data, error } = await supabase.rpc('create_post', {
      p_event: event.id,
      p_visitor: visitor,
      p_kind: 'message',
      p_author: name,
      p_body: text,
      p_emoji: emoji,
    })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    onDone(statusMessage((data as { status: string }).status, 'message'))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <NameField value={name} onChange={setName} />
      <div>
        <label className="label" htmlFor="msg">
          Sua mensagem
        </label>
        <textarea
          id="msg"
          className="input min-h-[110px] resize-none"
          maxLength={LIMITS.messageChars}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Parabéns aos estudantes! Que trabalhos incríveis..."
        />
        <p className="mt-1 text-right text-xs text-white/50">
          {text.length}/{LIMITS.messageChars}
        </p>
      </div>
      <div>
        <span className="label">Escolha um emoji</span>
        <EmojiPicker options={MESSAGE_EMOJIS} value={emoji} onChange={setEmoji} />
      </div>
      {err && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">{err}</p>}
      <button className="btn-gold w-full text-lg" disabled={busy}>
        {busy ? 'Enviando...' : 'Enviar para o mural'}
      </button>
    </form>
  )
}

function PhotoForm({ event, visitor, onDone, onPrivacy }: FormProps) {
  const [name, setName] = useState(getSavedName)
  const [caption, setCaption] = useState('')
  const [emoji, setEmoji] = useState('📸')
  const [images, setImages] = useState<PreparedImage[]>([])
  const [imageOk, setImageOk] = useState(false)
  const [insta, setInsta] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const cam = useRef<HTMLInputElement>(null)
  const gal = useRef<HTMLInputElement>(null)

  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setErr('')
    const room = LIMITS.photosPerPost - images.length
    const files = Array.from(list).slice(0, room)
    if (list.length > room) setErr(`Você pode enviar até ${LIMITS.photosPerPost} fotos por publicação.`)
    setBusy('Preparando fotos...')
    const out: PreparedImage[] = []
    for (const f of files) {
      try {
        out.push(await compressImage(f))
      } catch (e) {
        setErr(friendlyError(e))
      }
    }
    setImages((prev) => [...prev, ...out].slice(0, LIMITS.photosPerPost))
    setBusy('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!images.length) return setErr('Escolha ou tire pelo menos uma foto.')
    if (name.trim().length < 2) return setErr('Informe seu nome ou apelido.')
    if (!imageOk) return setErr('Marque a autorização de uso de imagem.')
    saveName(name.trim())
    try {
      setBusy(`Enviando foto 1 de ${images.length}...`)
      const media: MediaItem[] = await uploadImages(event.id, visitor, images, (n) =>
        setBusy(n < images.length ? `Enviando foto ${n + 1} de ${images.length}...` : 'Finalizando...'),
      )
      const { data, error } = await supabase.rpc('create_post', {
        p_event: event.id,
        p_visitor: visitor,
        p_kind: 'photo',
        p_author: name,
        p_body: caption,
        p_emoji: emoji,
        p_media: media,
        p_consent_image: imageOk,
        p_consent_instagram: insta,
      })
      if (error) throw error
      setBusy('')
      onDone(statusMessage((data as { status: string }).status, 'media'))
    } catch (e2) {
      setBusy('')
      setErr(friendlyError(e2))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files).then(() => (e.target.value = ''))} />
      <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(e.target.files).then(() => (e.target.value = ''))} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn-blue" onClick={() => cam.current?.click()} disabled={images.length >= LIMITS.photosPerPost || !!busy}>
          📷 Tirar foto
        </button>
        <button type="button" className="btn-ghost" onClick={() => gal.current?.click()} disabled={images.length >= LIMITS.photosPerPost || !!busy}>
          🖼️ Da galeria
        </button>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.previewUrl} className="relative aspect-square overflow-hidden rounded-xl">
              <img src={img.previewUrl} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-sm"
                aria-label="Remover foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/50">
        {images.length}/{LIMITS.photosPerPost} fotos · as imagens são reduzidas automaticamente para enviar mais rápido.
      </p>
      <NameField value={name} onChange={setName} />
      <div>
        <label className="label" htmlFor="cap">
          Legenda (opcional)
        </label>
        <input id="cap" className="input" maxLength={LIMITS.messageChars} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ex.: Nosso projeto de energia solar" />
      </div>
      <div>
        <span className="label">Emoji</span>
        <EmojiPicker options={['📸', ...MESSAGE_EMOJIS.slice(0, 15)]} value={emoji} onChange={setEmoji} />
      </div>
      <Consent image={imageOk} setImage={setImageOk} insta={insta} setInsta={setInsta} onPrivacy={onPrivacy} />
      {err && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">{err}</p>}
      <button className="btn-gold w-full text-lg" disabled={!!busy}>
        {busy || 'Enviar fotos'}
      </button>
    </form>
  )
}

function VideoForm({ event, visitor, onDone, onPrivacy }: FormProps) {
  const [name, setName] = useState(getSavedName)
  const [caption, setCaption] = useState('')
  const [emoji, setEmoji] = useState('🎬')
  const [video, setVideo] = useState<PreparedVideo | null>(null)
  const [imageOk, setImageOk] = useState(false)
  const [insta, setInsta] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const rec = useRef<HTMLInputElement>(null)
  const gal = useRef<HTMLInputElement>(null)

  async function pick(list: FileList | null) {
    const f = list?.[0]
    if (!f) return
    setErr('')
    setBusy('Verificando o vídeo...')
    try {
      if (video) URL.revokeObjectURL(video.previewUrl)
      setVideo(await prepareVideo(f))
    } catch (e) {
      setVideo(null)
      setErr(friendlyError(e))
    }
    setBusy('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!video) return setErr(`Grave ou escolha um vídeo de até ${LIMITS.videoSeconds} segundos.`)
    if (name.trim().length < 2) return setErr('Informe seu nome ou apelido.')
    if (!imageOk) return setErr('Marque a autorização de uso de imagem.')
    saveName(name.trim())
    try {
      setBusy('Enviando o vídeo... (pode levar alguns segundos)')
      const media = await uploadVideo(event.id, visitor, video)
      const { data, error } = await supabase.rpc('create_post', {
        p_event: event.id,
        p_visitor: visitor,
        p_kind: 'video',
        p_author: name,
        p_body: caption,
        p_emoji: emoji,
        p_media: media,
        p_consent_image: imageOk,
        p_consent_instagram: insta,
      })
      if (error) throw error
      setBusy('')
      onDone(statusMessage((data as { status: string }).status, 'media'))
    } catch (e2) {
      setBusy('')
      setErr(friendlyError(e2))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input ref={rec} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))} />
      <input ref={gal} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={(e) => void pick(e.target.files).then(() => (e.target.value = ''))} />
      <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/75">
        Até <strong>{LIMITS.videoSeconds} segundos</strong> e {LIMITS.videoBytes / 1048576} MB. O telão exibe os vídeos sem som.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn-blue" onClick={() => rec.current?.click()} disabled={!!busy}>
          🎥 Gravar
        </button>
        <button type="button" className="btn-ghost" onClick={() => gal.current?.click()} disabled={!!busy}>
          🎞️ Da galeria
        </button>
      </div>
      {video && (
        <div className="overflow-hidden rounded-2xl bg-black">
          <video src={video.previewUrl} className="max-h-72 w-full" controls playsInline muted />
          <p className="px-3 py-2 text-xs text-white/60">{video.duration ? `${video.duration.toFixed(1)} s` : ''}</p>
        </div>
      )}
      <NameField value={name} onChange={setName} />
      <div>
        <label className="label" htmlFor="vcap">
          Legenda (opcional)
        </label>
        <input id="vcap" className="input" maxLength={LIMITS.messageChars} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>
      <div>
        <span className="label">Emoji</span>
        <EmojiPicker options={['🎬', ...MESSAGE_EMOJIS.slice(0, 15)]} value={emoji} onChange={setEmoji} />
      </div>
      <Consent image={imageOk} setImage={setImageOk} insta={insta} setInsta={setInsta} onPrivacy={onPrivacy} />
      {err && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">{err}</p>}
      <button className="btn-gold w-full text-lg" disabled={!!busy}>
        {busy || 'Enviar vídeo'}
      </button>
    </form>
  )
}

function ReactionPad({ event, visitor }: { event: EventRow; visitor: string }) {
  const [floating, setFloating] = useState<{ id: number; emoji: string; left: number }[]>([])
  const [msg, setMsg] = useState('')
  const [count, setCount] = useState(0)
  const seq = useRef(0)

  async function send(emoji: string) {
    const id = ++seq.current
    setFloating((f) => [...f.slice(-14), { id, emoji, left: 15 + Math.random() * 70 }])
    window.setTimeout(() => setFloating((f) => f.filter((x) => x.id !== id)), 4000)
    if (navigator.vibrate) navigator.vibrate(15)
    const { error } = await supabase.rpc('add_reaction', { p_event: event.id, p_visitor: visitor, p_emoji: emoji })
    if (error) setMsg(friendlyError(error))
    else {
      setMsg('')
      setCount((c) => c + 1)
    }
  }

  return (
    <div className="relative">
      <p className="mb-4 text-sm text-white/70">Toque para mandar uma reação ao telão. Pode tocar várias vezes!</p>
      <div className="grid grid-cols-3 gap-3">
        {REACTION_EMOJIS.map((e) => (
          <button key={e} onClick={() => void send(e)} className="aspect-square rounded-2xl bg-white/10 text-5xl transition hover:bg-white/15 active:scale-90" aria-label={`Reagir com ${e}`}>
            {e}
          </button>
        ))}
      </div>
      {count > 0 && <p className="mt-4 text-center text-sm text-gold-200">{count} reaç{count === 1 ? 'ão enviada' : 'ões enviadas'} ao telão!</p>}
      {msg && <p className="mt-3 rounded-xl bg-amber-500/20 px-3 py-2 text-sm">{msg}</p>}
      <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
        {floating.map((f) => (
          <span key={f.id} className="absolute bottom-10 animate-rise text-5xl" style={{ left: `${f.left}%` }}>
            {f.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}

function FeedbackForm({ event, visitor, onDone }: FormProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim().length < 2) return setErr('Escreva sua sugestão.')
    setBusy(true)
    const { error } = await supabase.rpc('create_post', {
      p_event: event.id,
      p_visitor: visitor,
      p_kind: 'feedback',
      p_author: '',
      p_body: text,
      p_emoji: '',
    })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    onDone('Obrigado! Sua sugestão foi enviada só para a organização.')
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-white/70">Críticas e sugestões vão apenas para a equipe organizadora e não aparecem no telão. Não é preciso se identificar.</p>
      <textarea className="input min-h-[120px] resize-none" maxLength={LIMITS.messageChars} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que podemos melhorar?" />
      {err && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">{err}</p>}
      <button className="btn-gold w-full" disabled={busy}>
        {busy ? 'Enviando...' : 'Enviar sugestão'}
      </button>
    </form>
  )
}
