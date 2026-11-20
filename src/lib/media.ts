import { LIMITS } from '../config'
import { supabase } from './supabase'
import type { MediaItem } from './types'
import { uuid } from './visitor'

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.'))
    }
    img.src = url
  })
}

/** Reduz a foto para no máximo 1600 px no lado maior e converte para JPEG. */
export async function compressImage(file: File): Promise<PreparedImage> {
  let source: CanvasImageSource
  let w: number
  let h: number
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    source = bmp
    w = bmp.width
    h = bmp.height
  } catch {
    const img = await loadImage(file)
    source = img
    w = img.naturalWidth
    h = img.naturalHeight
  }
  const scale = Math.min(1, LIMITS.imageMaxSide / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.')
  ctx.drawImage(source, 0, 0, tw, th)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir a imagem.'))), 'image/jpeg', 0.82),
  )
  return { blob, width: tw, height: th, previewUrl: URL.createObjectURL(blob) }
}

export interface PreparedVideo {
  file: File
  duration: number
  width: number
  height: number
  previewUrl: string
  poster?: Blob
}

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']

export function videoContentType(file: File): string {
  if (VIDEO_TYPES.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
}

/** Confere duração e tamanho do vídeo e tira uma imagem de capa. */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (file.size > LIMITS.videoBytes) {
    throw new Error(`O vídeo tem ${(file.size / 1048576).toFixed(0)} MB. O limite é ${LIMITS.videoBytes / 1048576} MB: grave um vídeo mais curto.`)
  }
  const type = videoContentType(file)
  if (!VIDEO_TYPES.includes(type)) throw new Error('Formato de vídeo não aceito. Use MP4 ou MOV.')
  const previewUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = previewUrl
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('Não foi possível ler este vídeo neste aparelho.')), 15000)
    video.onloadedmetadata = () => {
      window.clearTimeout(t)
      resolve()
    }
    video.onerror = () => {
      window.clearTimeout(t)
      reject(new Error('Este vídeo não pode ser reproduzido no navegador. Tente gravar novamente.'))
    }
  })
  let duration = video.duration
  if (!Number.isFinite(duration)) {
    // Alguns aparelhos informam duração "infinita" até avançar o vídeo.
    video.currentTime = 1e6
    await new Promise((r) => setTimeout(r, 400))
    duration = video.duration
  }
  if (Number.isFinite(duration) && duration > LIMITS.videoSeconds + 0.6) {
    URL.revokeObjectURL(previewUrl)
    throw new Error(`O vídeo tem ${Math.round(duration)} segundos. O limite é ${LIMITS.videoSeconds} segundos.`)
  }
  let poster: Blob | undefined
  try {
    video.currentTime = Math.min(0.5, (duration || 1) / 2)
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 2500)
      video.onseeked = () => {
        window.clearTimeout(t)
        resolve()
      }
    })
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (ctx && canvas.width > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      poster = await new Promise<Blob | undefined>((r) => canvas.toBlob((b) => r(b || undefined), 'image/jpeg', 0.8))
    }
  } catch {
    poster = undefined
  }
  return {
    file,
    duration: Number.isFinite(duration) ? Math.round(duration * 10) / 10 : 0,
    width: video.videoWidth,
    height: video.videoHeight,
    previewUrl,
    poster,
  }
}

function extFor(type: string) {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'video/quicktime') return 'mov'
  if (type === 'video/webm') return 'webm'
  if (type === 'video/mp4') return 'mp4'
  return type.split('/')[1] || 'bin'
}

export async function uploadBlob(eventId: string, visitorId: string, blob: Blob, contentType: string): Promise<string> {
  const path = `${eventId}/${visitorId}/${uuid()}.${extFor(contentType)}`
  const { error } = await supabase.storage.from('uploads').upload(path, blob, { contentType, upsert: false, cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function uploadImages(eventId: string, visitorId: string, images: PreparedImage[], onProgress?: (done: number) => void) {
  const items: MediaItem[] = []
  for (const img of images) {
    const path = await uploadBlob(eventId, visitorId, img.blob, 'image/jpeg')
    items.push({ path, type: 'image', w: img.width, h: img.height })
    onProgress?.(items.length)
  }
  return items
}

export async function uploadVideo(eventId: string, visitorId: string, v: PreparedVideo): Promise<MediaItem[]> {
  const path = await uploadBlob(eventId, visitorId, v.file, videoContentType(v.file))
  const item: MediaItem = { path, type: 'video', w: v.width, h: v.height, duration: v.duration }
  if (v.poster) {
    try {
      item.poster = await uploadBlob(eventId, visitorId, v.poster, 'image/jpeg')
    } catch {
      /* capa é opcional */
    }
  }
  return [item]
}

// ---------------------------------------------------------------------------
// Links assinados para mídias aprovadas (o armazenamento é privado).
// ---------------------------------------------------------------------------

const urlCache = new Map<string, { url: string; expires: number }>()

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of paths) {
    const c = urlCache.get(p)
    if (c && c.expires > now + 5 * 60_000) out[p] = c.url
    else missing.push(p)
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100)
    const { data } = await supabase.storage.from('uploads').createSignedUrls(chunk, 4 * 3600)
    for (const row of data || []) {
      if (row.signedUrl && row.path) {
        urlCache.set(row.path, { url: row.signedUrl, expires: now + 4 * 3600_000 })
        out[row.path] = row.signedUrl
      }
    }
  }
  return out
}

export function mediaPaths(items: { media: MediaItem[] }[]): string[] {
  const set = new Set<string>()
  for (const p of items) for (const m of p.media || []) {
    set.add(m.path)
    if (m.poster) set.add(m.poster)
  }
  return [...set]
}
