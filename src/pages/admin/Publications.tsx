import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { asset } from '../../components/ui'
import type { EventRow, MediaItem, Post } from '../../lib/types'
import type { Notify } from './Admin'
import { useAdminPosts } from './Moderation'

interface Item {
  post: Post
  media: MediaItem
  url: string
  key: string
}

function fileName(it: Item, suffix = '') {
  const t = new Date(it.post.created_at)
  const stamp = t.toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const author = it.post.author_name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'autor'
  const ext = it.media.type === 'image' ? 'jpg' : it.media.path.split('.').pop() || 'mp4'
  return `${stamp}_${author}_${it.media.path.split('/').pop()?.slice(0, 8)}${suffix}.${suffix ? 'jpg' : ext}`
}

async function fetchBlob(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Falha ao baixar (${r.status})`)
  return r.blob()
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Monta uma versão da foto no formato do Instagram (Feed 4:5 ou Stories 9:16) com a marca da escola. */
async function formatFor(url: string, kind: 'feed' | 'stories', event: EventRow): Promise<Blob> {
  const W = 1080
  const H = kind === 'feed' ? 1350 : 1920
  const img = await createImageBitmap(await fetchBlob(url))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  // fundo desfocado
  const cover = Math.max(W / img.width, H / img.height)
  ctx.filter = 'blur(40px) brightness(.6)'
  ctx.drawImage(img, (W - img.width * cover) / 2, (H - img.height * cover) / 2, img.width * cover, img.height * cover)
  ctx.filter = 'none'
  // foto inteira
  const band = kind === 'stories' ? 220 : 130
  const fit = Math.min(W / img.width, (H - band) / img.height)
  const w = img.width * fit
  const h = img.height * fit
  ctx.drawImage(img, (W - w) / 2, (H - band - h) / 2, w, h)
  // faixa da marca
  const g = ctx.createLinearGradient(0, H - band, 0, H)
  g.addColorStop(0, '#0d2c78')
  g.addColorStop(1, '#06153d')
  ctx.fillStyle = g
  ctx.fillRect(0, H - band, W, band)
  ctx.fillStyle = '#f2c94c'
  ctx.fillRect(0, H - band, W, 6)
  try {
    const logo = await createImageBitmap(await fetchBlob(event.settings?.logo_url || asset('brand/escudo.png')))
    const ls = band - 40
    ctx.drawImage(logo, 30, H - band + 22, ls, ls)
  } catch {
    /* sem logo */
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${kind === 'stories' ? 46 : 38}px Montserrat, sans-serif`
  ctx.fillText(event.name, band + 10, H - band / 2 - 4)
  ctx.fillStyle = '#ffe08a'
  ctx.font = `600 ${kind === 'stories' ? 30 : 26}px Inter, sans-serif`
  ctx.fillText(event.instagram_handle || event.institution, band + 10, H - band / 2 + 34)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falha'))), 'image/jpeg', 0.9))
}

/** Sugestões de legenda montadas por modelo de texto (não é inteligência artificial). */
function captionIdeas(it: Item, event: EventRow): string[] {
  const who = it.post.author_name
  const what = it.post.body ? `“${it.post.body}”` : ''
  const tag = `#FeiraDoConhecimento #UlissesGuimaraes #CampoVerde #Educacao #Ciencia`
  return [
    `✨ ${event.name}: ${event.theme} ${what ? `\n\n${what} — registro de ${who}.` : `\n\nRegistro de ${who}.`}\n\n${tag}`,
    `💡 Ideias que transformam! Olha só este momento da ${event.name}${what ? `: ${what}` : '.'}\n📸 ${who}\n\n${tag}`,
    `💙💛 Orgulho dos nossos estudantes! Obrigado, ${who}, por compartilhar este olhar sobre a ${event.name}.\n\n${tag}`,
  ]
}

export default function Publications({ event, notify }: { event: EventRow; notify: Notify }) {
  const { posts, urls, loading } = useAdminPosts(event.id, ['approved'])
  const [onlyInsta, setOnlyInsta] = useState(true)
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [captionFor, setCaptionFor] = useState<Item | null>(null)

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const p of posts) {
      if (p.kind !== 'photo' && p.kind !== 'video') continue
      if (onlyInsta && !p.consent_instagram) continue
      for (const m of p.media) {
        if (kind !== 'all' && m.type !== kind) continue
        const url = urls[m.path]
        if (url) out.push({ post: p, media: m, url, key: m.path })
      }
    }
    return out.sort((a, b) => Number(b.post.featured) - Number(a.post.featured) || b.post.created_at.localeCompare(a.post.created_at))
  }, [posts, urls, onlyInsta, kind])

  function toggle(k: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  async function downloadZip(list: Item[]) {
    if (!list.length) return notify('Selecione ao menos um arquivo.', 'warn')
    const zip = new JSZip()
    const lines = ['arquivo;autor;legenda;data;autoriza_instagram']
    for (let i = 0; i < list.length; i++) {
      setBusy(`Baixando ${i + 1} de ${list.length}...`)
      const it = list[i]
      const name = fileName(it)
      zip.file(name, await fetchBlob(it.url))
      lines.push([name, it.post.author_name, it.post.body.replace(/;/g, ','), new Date(it.post.created_at).toLocaleString('pt-BR'), it.post.consent_instagram ? 'sim' : 'não'].join(';'))
    }
    zip.file('autores-e-legendas.csv', '﻿' + lines.join('\n'))
    setBusy('Compactando...')
    const blob = await zip.generateAsync({ type: 'blob' })
    saveBlob(blob, `${event.slug}-midias-${list.length}.zip`)
    setBusy('')
  }

  async function prepare(it: Item, k: 'feed' | 'stories') {
    try {
      setBusy('Preparando imagem...')
      saveBlob(await formatFor(it.url, k, event), fileName(it, `_${k}`))
    } catch {
      notify('Não foi possível preparar esta imagem.', 'error')
    }
    setBusy('')
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-yellow-400" checked={onlyInsta} onChange={(e) => setOnlyInsta(e.target.checked)} />
          Só com autorização para o Instagram
        </label>
        <select className="rounded-lg border border-white/20 bg-navy-800 px-2 py-1.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">Fotos e vídeos</option>
          <option value="image">Só fotos</option>
          <option value="video">Só vídeos</option>
        </select>
        <span className="text-sm text-white/60">{items.length} arquivos</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set(items.map((i) => i.key)))}>
            Selecionar todos
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </button>
          <button className="btn-gold btn-sm" disabled={!!busy} onClick={() => void downloadZip(items.filter((i) => selected.has(i.key)))}>
            Baixar selecionados ({selected.size})
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-white/60">
        A publicação no Instagram é feita pela equipe, no aplicativo, com a conta oficial da escola. Aqui você escolhe, baixa e prepara os arquivos. As fotos podem
        ser convertidas para Feed (4:5) e Stories (9:16); os vídeos são baixados no formato original, prontos para Reels quando gravados na vertical.
      </p>
      {busy && <p className="mb-3 rounded-xl bg-royal-600/40 px-4 py-2 text-sm">{busy}</p>}
      {loading && <p className="text-white/60">Carregando...</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map((it) => (
          <div key={it.key} className={`card overflow-hidden ${selected.has(it.key) ? 'ring-2 ring-gold-400' : ''}`}>
            <button className="relative block w-full" onClick={() => toggle(it.key)} aria-pressed={selected.has(it.key)}>
              {it.media.type === 'image' ? (
                <img src={it.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              ) : (
                <video src={it.url} poster={it.media.poster ? urls[it.media.poster] : undefined} muted playsInline preload="metadata" className="aspect-square w-full object-cover" />
              )}
              <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 ${selected.has(it.key) ? 'border-gold-400 bg-gold-400 text-navy-900' : 'border-white bg-black/40'}`}>
                {selected.has(it.key) ? '✓' : ''}
              </span>
              {it.media.type === 'video' && <span className="absolute right-2 top-2 chip bg-black/70">▶ {it.media.duration ? `${Math.round(it.media.duration)}s` : 'vídeo'}</span>}
            </button>
            <div className="p-3 text-sm">
              <p className="font-semibold text-gold-300">{it.post.author_name}</p>
              {it.post.body && <p className="line-clamp-2 text-white/80">{it.post.body}</p>}
              <p className="text-xs text-white/50">{new Date(it.post.created_at).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className="btn-ghost btn-sm px-2 py-1 text-xs" onClick={() => void fetchBlob(it.url).then((b) => saveBlob(b, fileName(it)))}>
                  Baixar
                </button>
                {it.media.type === 'image' && (
                  <>
                    <button className="btn-ghost btn-sm px-2 py-1 text-xs" onClick={() => void prepare(it, 'feed')}>
                      Feed 4:5
                    </button>
                    <button className="btn-ghost btn-sm px-2 py-1 text-xs" onClick={() => void prepare(it, 'stories')}>
                      Stories 9:16
                    </button>
                  </>
                )}
                <button className="btn-ghost btn-sm px-2 py-1 text-xs" onClick={() => setCaptionFor(it)}>
                  Legenda
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {captionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setCaptionFor(null)}>
          <div className="card max-w-lg space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold">Sugestões de legenda</h3>
            <p className="text-xs text-white/60">Montadas a partir de modelos de texto. Revise antes de publicar.</p>
            {captionIdeas(captionFor, event).map((c, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-3">
                <p className="whitespace-pre-line text-sm">{c}</p>
                <button className="btn-ghost btn-sm mt-2" onClick={() => void navigator.clipboard.writeText(c).then(() => notify('Legenda copiada.'))}>
                  Copiar
                </button>
              </div>
            ))}
            <button className="btn-ghost w-full" onClick={() => setCaptionFor(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
