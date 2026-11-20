import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EMOJIS } from '../../shared/constants.ts'
import { DemoBanner, Footer, Topbar } from '../components/Chrome.tsx'
import { Sky } from '../components/Sky.tsx'
import { ApiError } from '../lib/backend.ts'
import { api } from '../lib/api.ts'
import { compressImage, readVideoDuration } from '../lib/media.ts'
import { eventSlug, withEvent } from '../lib/paths.ts'
import { useLiveEvent } from '../lib/useLiveEvent.ts'
import { visitorId } from '../lib/visitor.ts'

type Panel = 'mensagem' | 'foto' | 'video' | 'reacao' | null

export function ParticiparPage() {
  const [params] = useSearchParams()
  const slug = eventSlug(params)
  const { event, error, connected, reload } = useLiveEvent(slug)
  const openedAt = useRef(Date.now())
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [author, setAuthor] = useState('')
  const [body, setBody] = useState('')
  const [emoji, setEmoji] = useState('')
  const [imageConsent, setImageConsent] = useState(false)
  const [instagramConsent, setInstagramConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [already, setAlready] = useState(false)
  const id = useRef('')

  useEffect(() => {
    id.current = visitorId()
    if (!event || event.status !== 'live') return
    api.registerPresence(slug, id.current)
      .then((result) => {
        setAlready(result.already)
        void reload()
      })
      .catch((caught) => setNotice(caught instanceof Error ? caught.message : 'Não foi possível registrar a presença.'))
  }, [event?.status, event?.id, slug, reload])

  async function send(type: 'message' | 'photo' | 'video' | 'reaction') {
    setBusy(true)
    setNotice('')
    try {
      const files: { blob: Blob; name: string }[] = []
      let durationSeconds: number | undefined
      if (type === 'photo') {
        if (!photos.length) throw new Error('Escolha até cinco fotografias.')
        for (const file of photos.slice(0, event?.photoMaxCount || 5)) {
          const blob = await compressImage(file)
          files.push({ blob, name: `${crypto.randomUUID()}.jpg` })
        }
      }
      if (type === 'video') {
        if (!video) throw new Error('Escolha ou grave um vídeo.')
        durationSeconds = await readVideoDuration(video)
        const max = event?.videoMaxSeconds || 15
        if (durationSeconds > max + 0.3) throw new Error(`O vídeo precisa ter no máximo ${max} segundos.`)
        if (video.size > (event?.videoMaxBytes || 26 * 1024 * 1024)) throw new Error('O vídeo está grande demais.')
        files.push({ blob: video, name: video.name || 'video.mp4' })
      }
      const result = await api.createPost(slug, {
        visitorId: id.current || visitorId(),
        type,
        authorName: author,
        body,
        emoji,
        imageConsent,
        instagramConsent,
        website,
        openedAt: openedAt.current,
        durationSeconds,
        files,
      })
      const published = result.moderation.status === 'approved' && result.moderation.audience === 'public'
      setNotice(
        type === 'reaction'
          ? 'Reação enviada. Ela pode aparecer no painel da televisão.'
          : published
            ? 'Enviado. Pode aparecer no painel.'
            : 'Enviado para a equipe. Fotos, vídeos e mensagens em revisão só entram no painel depois da aprovação humana.',
      )
      setBody('')
      setPhotos([])
      setVideo(null)
      setImageConsent(false)
      setInstagramConsent(false)
      void reload()
    } catch (caught) {
      setNotice(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Não foi possível enviar.')
    } finally {
      setBusy(false)
    }
  }

  async function erase(scope: 'content' | 'presence' | 'all') {
    const text = scope === 'presence'
      ? 'Remover a presença deste navegador?'
      : 'Apagar os envios deste navegador neste evento?'
    if (!confirm(text)) return
    await api.deleteMine(slug, id.current || visitorId(), scope)
    setNotice(scope === 'presence' ? 'Presença removida neste navegador.' : 'Seus envios foram apagados.')
    setAlready(false)
    void reload()
  }

  const closed = event && event.status !== 'live'
  const max = event?.messageMaxChars || 200

  return (
    <div className="sky-page">
      <DemoBanner show={event?.isDemo} />
      <Sky />
      <Topbar event={event} slug={slug} />
      <main className="page-wrap narrow">
        <p className="cinzel" style={{ color: 'var(--gold-2)', marginBottom: 0 }}>Feira do Conhecimento 2026</p>
        <h1 className="display gold-text" style={{ fontSize: 'clamp(48px, 16vw, 64px)', margin: '0 0 .4rem' }}>Sua presença</h1>
        {error && <p className="glass" style={{ padding: '0.8rem 1rem', borderRadius: 16 }}>{error} Verifique a conexão e tente de novo.</p>}
        {event && (
          <section className="glass" style={{ borderRadius: 24, padding: '1.1rem 1.15rem', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong style={{ fontSize: '1.2rem' }}>
                  {closed ? 'Este evento não está recebendo presenças agora.' : already ? 'Que bom ver você de novo.' : event.welcomeText}
                </strong>
                <p style={{ margin: '0.35rem 0 0', opacity: 0.86 }}>
                  {already
                    ? 'Sua presença já está registrada neste navegador. Você pode enviar novos conteúdos sem somar outra presença.'
                    : 'Não pedimos nome, CPF, telefone, e-mail nem senha para contar presença.'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="display gold-text" style={{ fontSize: 54, lineHeight: 0.9 }}>{event.presenceCount}</div>
                <small>presenças</small>
              </div>
            </div>
            <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 0 }}>
              Este número conta presenças por navegador. Não representa, necessariamente, pessoas físicas distintas nem quantas pessoas estão na escola neste instante.
              {' '}<span style={{ color: connected ? '#8dffc1' : '#ffd27a', whiteSpace: 'nowrap' }}>{connected ? 'Painel ao vivo' : 'Reconectando…'}</span>
            </p>
          </section>
        )}

        {closed && event?.status === 'ended' && (
          <p>O evento foi encerrado. A memória pública fica em <Link to={withEvent('/memorias', slug)}>Memórias</Link>.</p>
        )}

        {event?.status === 'live' && (
          <>
            <div className="action-grid">
              <button className="action" onClick={() => setPanel('mensagem')}><span>01</span><strong>Enviar mensagem</strong><span>Até {max} caracteres</span></button>
              <button className="action" onClick={() => setPanel('foto')}><span>02</span><strong>Enviar fotografia</strong><span>Até {event.photoMaxCount} imagens</span></button>
              <button className="action" onClick={() => setPanel('video')}><span>03</span><strong>Enviar vídeo</strong><span>Até {event.videoMaxSeconds} segundos</span></button>
              <button className="action" onClick={() => setPanel('reacao')}><span>04</span><strong>Enviar reação</strong><span>Emojis no painel</span></button>
            </div>
            {!event.muralEnabled && <p>O mural está pausado. Sua presença continua válida e os envios ficam na fila da equipe.</p>}
            {event.emergencyStop && <p>A exibição nas TVs foi interrompida pela organização. Os envios continuam na fila de revisão.</p>}

            {panel && panel !== 'reacao' && (
              <form
                className="glass"
                style={{ borderRadius: 24, padding: '1rem', marginTop: 14, display: 'grid', gap: 10 }}
                onSubmit={(ev) => {
                  ev.preventDefault()
                  void send(panel === 'mensagem' ? 'message' : panel === 'foto' ? 'photo' : 'video')
                }}
              >
                <label className="hp" aria-hidden="true">
                  Site
                  <input className="hp" tabIndex={-1} autoComplete="off" value={website} onChange={(ev) => setWebsite(ev.target.value)} />
                </label>
                <label>
                  <span className="label">Primeiro nome ou nome de exibição</span>
                  <input className="field" value={author} maxLength={40} onChange={(ev) => setAuthor(ev.target.value)} required />
                </label>
                <label>
                  <span className="label">{panel === 'mensagem' ? 'Mensagem' : 'Legenda (opcional)'}</span>
                  <textarea className="field" value={body} maxLength={max} rows={4} required={panel === 'mensagem'} onChange={(ev) => setBody(ev.target.value)} />
                  <small>{body.length}/{max}</small>
                </label>
                <div>
                  <span className="label">Emoji</span>
                  <div className="emoji-row">
                    {EMOJIS.map((item) => (
                      <button type="button" key={item} className={emoji === item ? 'emoji-btn on' : 'emoji-btn'} onClick={() => setEmoji(item)}>{item}</button>
                    ))}
                  </div>
                </div>
                {panel === 'foto' && (
                  <label>
                    <span className="label">Fotografar ou escolher da galeria</span>
                    <input
                      className="field"
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(ev) => setPhotos(Array.from(ev.target.files || []).slice(0, event.photoMaxCount))}
                    />
                    <small>{photos.length} selecionada(s). As imagens são comprimidas neste aparelho antes do envio.</small>
                  </label>
                )}
                {panel === 'video' && (
                  <label>
                    <span className="label">Gravar ou escolher um vídeo de até {event.videoMaxSeconds}s</span>
                    <input className="field" type="file" accept="video/mp4,video/webm,video/*" capture="environment" onChange={(ev) => setVideo(ev.target.files?.[0] || null)} />
                  </label>
                )}
                {(panel === 'foto' || panel === 'video') && (
                  <>
                    <label className="check">
                      <input type="checkbox" checked={imageConsent} onChange={(ev) => setImageConsent(ev.target.checked)} />
                      <span>Autorizo o uso desta imagem no painel e na memória do evento. Se houver estudante ou outra pessoa, confirmo que a autorização de imagem exigida pela escola está respeitada.</span>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={instagramConsent} onChange={(ev) => setInstagramConsent(ev.target.checked)} />
                      <span>Autorização separada e opcional: a escola poderá publicar este material no Instagram institucional. Sem esta opção, ele não entra na seleção para as redes.</span>
                    </label>
                  </>
                )}
                <button className="btn-gold" disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar para o mural'}</button>
              </form>
            )}

            {panel === 'reacao' && (
              <div className="glass" style={{ borderRadius: 24, padding: '1rem', marginTop: 14 }}>
                <p>Toque um emoji. Reações da lista oficial não têm texto e podem ir direto ao painel.</p>
                <div className="emoji-row">
                  {EMOJIS.map((item) => (
                    <button
                      key={item}
                      className="emoji-btn"
                      disabled={busy}
                      onClick={() => {
                        setEmoji(item)
                        void (async () => {
                          setBusy(true)
                          try {
                            await api.createPost(slug, { visitorId: id.current || visitorId(), type: 'reaction', emoji: item, openedAt: openedAt.current, website })
                            setNotice('Reação enviada. Ela pode aparecer no painel da televisão.')
                          } catch (caught) {
                            setNotice(caught instanceof Error ? caught.message : 'Não foi possível enviar.')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {notice && <p className="glass" style={{ padding: '0.8rem 1rem', borderRadius: 16 }}>{notice}</p>}

        <p>
          <a className="btn-royal" href={event?.instagramUrl || 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/'} target="_blank" rel="noreferrer">
            Seguir {event?.instagramHandle || '@e.e.c.m.ulissesguimaraes'}
          </a>
        </p>
        <p style={{ fontSize: 14 }}>
          <Link to={withEvent('/privacidade', slug)}>Aviso de privacidade e uso de imagem</Link>
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" type="button" onClick={() => void erase('content')}>Apagar meus envios</button>
          <button className="btn-ghost" type="button" onClick={() => void erase('presence')}>Remover minha presença</button>
        </div>
      </main>
      <Footer slug={slug} />
    </div>
  )
}
