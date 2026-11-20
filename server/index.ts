import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { DEFAULT_COLORS, DEFAULT_GOALS, DEFAULT_SCENES, LIMITS } from '../shared/constants.ts'
import { moderateContent } from '../shared/moderation.ts'
import { isAllowedEmoji } from '../shared/moderation.ts'
import { cleanBody, cleanCaption, cleanName, isVisitorId, safeHex, slugify, templateCaptions } from '../shared/text.ts'
import {
  audit,
  copyFixture,
  createSession,
  defaultLogoFile,
  fileExists,
  openDatabase,
  readBytes,
  readSession,
  verifyPassword,
  writeBytes,
  type EventRow,
} from './db.ts'

const require = createRequire(import.meta.url)
const Busboy = require('busboy') as typeof import('busboy')

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT || 8787)
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'))
const MEDIA_ROOT = path.join(DATA_DIR, 'media')
const BRAND_ROOT = path.join(DATA_DIR, 'branding')
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const DIST_DIR = path.join(process.cwd(), 'dist')

const db = openDatabase(DATA_DIR)
mkdirSync(MEDIA_ROOT, { recursive: true })
mkdirSync(BRAND_ROOT, { recursive: true })

type Client = { res: ServerResponse; slug: string }
const clients = new Set<Client>()

function broadcast(slug: string, data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    if (client.slug === slug) client.res.write(payload)
  }
}

setInterval(() => {
  for (const client of clients) client.res.write(`: ping ${Date.now()}\n\n`)
}, 15000)

const hits = new Map<string, number[]>()
function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  })
  res.end(json)
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (!key) continue
    out[key] = decodeURIComponent(rest.join('='))
  }
  return out
}

function adminOf(req: IncomingMessage): { email: string } | null {
  return readSession(db.raw, cookies(req).ul_session)
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'local'
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > 1_000_000) throw new Error('payload')
    chunks.push(buf)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

interface Upload {
  filename: string
  mime: string
  buffer: Buffer
  truncated: boolean
}

function readMultipart(req: IncomingMessage): Promise<{ fields: Record<string, string>; files: Upload[] }> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 6, fileSize: LIMITS.videoBytes, fields: 30, fieldSize: 20_000 },
    })
    const fields: Record<string, string> = {}
    const files: Upload[] = []
    const pending: Promise<void>[] = []
    busboy.on('field', (name: string, value: string) => {
      fields[name] = value
    })
    busboy.on('file', (_name: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      const chunks: Buffer[] = []
      let truncated = false
      pending.push(new Promise((done, fail) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('limit', () => {
          truncated = true
        })
        stream.on('end', () => {
          files.push({ filename: info.filename, mime: info.mimeType, buffer: Buffer.concat(chunks), truncated })
          done()
        })
        stream.on('error', fail)
      }))
    })
    busboy.on('finish', () => {
      Promise.all(pending).then(() => resolve({ fields, files })).catch(reject)
    })
    busboy.on('error', reject)
    req.pipe(busboy)
  })
}

function sniff(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' }
  }
  if (buf.length > 12 && buf.subarray(4, 8).toString() === 'ftyp') return { mime: 'video/mp4', ext: 'mp4' }
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'video/webm', ext: 'webm' }
  }
  return null
}

function imageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (mime !== 'image/jpeg') return null
  let index = 2
  while (index < buf.length - 8) {
    if (buf[index] !== 0xff) {
      index += 1
      continue
    }
    const marker = buf[index + 1]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(index + 5), width: buf.readUInt16BE(index + 7) }
    }
    const length = buf.readUInt16BE(index + 2)
    if (!length) break
    index += 2 + length
  }
  return null
}

async function probeDuration(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ])
    const value = Number(String(stdout).trim())
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

async function aiClassify(text: string): Promise<{ decision: string; sentiment: string; reason: string } | null> {
  const key = process.env.AI_API_KEY
  if (!key) return null
  const url = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions'
  const model = process.env.AI_MODEL || 'gpt-4o-mini'
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Você modera texto de uma feira escolar no Brasil, com crianças e adolescentes. Responda só JSON: {"decision":"approve|reject|pending|criticism","sentiment":"positive|neutral|negative","reason":"frase curta em português"}. approve só se for respeitoso e adequado. criticism para crítica da organização, mesmo educada. reject para ofensa, ódio, conteúdo sexual, violência gráfica, spam ou dado pessoal. pending se houver dúvida. Não aprove ironia ambígua.',
          },
          { role: 'user', content: text.slice(0, 500) },
        ],
      }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = data.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as {
      decision?: string
      sentiment?: string
      reason?: string
    }
    if (!parsed.decision) return null
    return {
      decision: parsed.decision,
      sentiment: parsed.sentiment || 'neutral',
      reason: (parsed.reason || 'Análise automática de texto.').slice(0, 240),
    }
  } catch {
    return null
  }
}

function safeMediaPath(rel: string): string | null {
  const full = path.resolve(MEDIA_ROOT, rel)
  const root = path.resolve(MEDIA_ROOT)
  if (full !== root && !full.startsWith(root + path.sep)) return null
  return full
}

function logoUrl(slug: string, version: number): string {
  return `/api/branding/${encodeURIComponent(slug)}/logo?v=${version}`
}

function requireEvent(slug: string) {
  const row = db.getEventBySlug(slug)
  if (!row) return null
  return row
}

function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg'
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.woff2')) return 'font/woff2'
  if (file.endsWith('.ttf')) return 'font/ttf'
  if (file.endsWith('.mp4')) return 'video/mp4'
  if (file.endsWith('.webmanifest')) return 'application/manifest+json'
  if (file.endsWith('.txt')) return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

function serveFile(res: ServerResponse, file: string, cache: string) {
  if (!existsSync(file) || !statSync(file).isFile()) return false
  res.writeHead(200, {
    'Content-Type': contentType(file),
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(file).pipe(res)
  return true
}

function staticFile(urlPath: string): string | null {
  const base = existsSync(path.join(DIST_DIR, 'index.html')) ? DIST_DIR : PUBLIC_DIR
  const rel = decodeURIComponent(urlPath.split('?')[0])
  if (rel.includes('\0')) return null
  const full = path.resolve(base, '.' + rel)
  const root = path.resolve(base)
  if (full !== root && !full.startsWith(root + path.sep)) return null
  if (existsSync(full) && statSync(full).isFile()) return full
  if (base === DIST_DIR && !rel.startsWith('/brand') && !rel.startsWith('/fonts') && !rel.startsWith('/icons')) {
    return path.join(DIST_DIR, 'index.html')
  }
  const fromPublic = path.resolve(PUBLIC_DIR, '.' + rel)
  const publicRoot = path.resolve(PUBLIC_DIR)
  if (fromPublic !== publicRoot && !fromPublic.startsWith(publicRoot + path.sep)) return null
  if (existsSync(fromPublic) && statSync(fromPublic).isFile()) return fromPublic
  return null
}

function applyRetention() {
  const events = db.raw.prepare('SELECT id, retention_days FROM events').all() as { id: string; retention_days: number }[]
  for (const event of events) {
    const days = Number(event.retention_days) || 365
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const oldPosts = db.raw.prepare('SELECT id FROM posts WHERE event_id = ? AND created_at < ?').all(event.id, cutoff) as { id: string }[]
    for (const post of oldPosts) db.deletePost(post.id, MEDIA_ROOT)
    db.raw.prepare('DELETE FROM presences WHERE event_id = ? AND created_at < ?').run(event.id, cutoff)
    if (oldPosts.length) {
      db.recount(event.id)
      db.bump(event.id)
    }
  }
}

function countRecent(eventId: string, visitorId: string, typeSql: string, sinceIso: string): number {
  const row = db.raw.prepare(
    `SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND visitor_id = ? AND created_at > ? AND ${typeSql}`,
  ).get(eventId, visitorId, sinceIso) as { n: number }
  return Number(row.n)
}

async function createContent(opts: {
  slug: string
  ip: string
  fields: Record<string, string>
  files: Upload[]
}) {
  const event = requireEvent(opts.slug)
  if (!event) return { status: 404, body: { error: 'Evento não encontrado.' } }
  if (event.status !== 'live') {
    return { status: 403, body: { error: 'Este evento não está recebendo participações agora.' } }
  }
  const visitorId = opts.fields.visitorId || ''
  if (!isVisitorId(visitorId)) return { status: 400, body: { error: 'Identificador do navegador inválido. Recarregue a página.' } }
  if ((opts.fields.website || '').trim()) return { status: 400, body: { error: 'Não foi possível enviar.' } }
  const openedAt = Number(opts.fields.openedAt || 0)
  if (openedAt && Date.now() - openedAt < LIMITS.minOpenMs && Date.now() - openedAt > -60_000) {
    return { status: 400, body: { error: 'Aguarde um instante e tente de novo.' } }
  }
  const type = opts.fields.type
  if (type !== 'message' && type !== 'photo' && type !== 'video' && type !== 'reaction') {
    return { status: 400, body: { error: 'Tipo de participação inválido.' } }
  }
  if (!allow(`ip:${opts.ip}`, 400, 10 * 60 * 1000)) {
    return { status: 429, body: { error: 'Muitos envios a partir desta rede. Tente em alguns minutos.' } }
  }
  const since10 = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  if (type === 'reaction') {
    if (!allow(`react:${event.id}:${visitorId}`, LIMITS.reactionsPer10Min, 10 * 60 * 1000)) {
      return { status: 429, body: { error: 'Você enviou muitas reações. Espere um pouco.' } }
    }
  } else {
    const recent = countRecent(String(event.id), visitorId, `type != 'reaction'`, since10)
    const daily = countRecent(String(event.id), visitorId, `type != 'reaction'`, sinceDay)
    if (recent >= LIMITS.contentPer10Min || daily >= LIMITS.contentPerDay) {
      return { status: 429, body: { error: 'Limite de envios deste navegador atingido. Tente mais tarde.' } }
    }
  }

  const maxChars = Number(event.message_max_chars) || 200
  let author: string | null = null
  let body: string | null = null
  let emoji: string | null = null
  if (type !== 'reaction') {
    const named = cleanName(String(opts.fields.authorName || ''))
    if (!named.ok) return { status: 400, body: { error: named.error } }
    author = named.name
    const source = String(opts.fields.body || '')
    if (type === 'message') {
      const cleaned = cleanBody(source, maxChars)
      if (!cleaned.ok) return { status: 400, body: { error: cleaned.error } }
      body = cleaned.body
    } else if (source.trim()) {
      const cleaned = cleanCaption(source, maxChars)
      if (!cleaned.ok) return { status: 400, body: { error: cleaned.error } }
      body = cleaned.body || null
    }
    if (opts.fields.emoji) {
      if (!isAllowedEmoji(opts.fields.emoji)) return { status: 400, body: { error: 'Escolha um emoji da lista.' } }
      emoji = opts.fields.emoji
    }
  } else {
    if (!opts.fields.emoji || !isAllowedEmoji(opts.fields.emoji)) {
      return { status: 400, body: { error: 'Escolha um emoji da lista.' } }
    }
    emoji = opts.fields.emoji
  }

  if ((type === 'photo' || type === 'video') && opts.fields.imageConsent !== 'true') {
    return { status: 400, body: { error: 'Para enviar foto ou vídeo, autorize o uso da imagem neste painel do evento.' } }
  }
  if (type === 'photo' || type === 'video') {
    const maxFiles = type === 'photo' ? Number(event.photo_max_count) || 5 : 1
    if (!opts.files.length) return { status: 400, body: { error: 'Nenhum arquivo recebido.' } }
    if (opts.files.length > maxFiles) return { status: 400, body: { error: `Envie no máximo ${maxFiles} arquivo(s).` } }
    if (opts.files.some((file) => file.truncated)) {
      return { status: 413, body: { error: 'Arquivo grande demais.' } }
    }
  }

  if (body) {
    const dup = db.raw.prepare(
      `SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND visitor_id = ? AND body = ? AND created_at > ?`,
    ).get(event.id, visitorId, body, sinceDay) as { n: number }
    if (Number(dup.n) >= 2) {
      return { status: 429, body: { error: 'Esta mensagem já foi enviada algumas vezes. Escreva algo novo.' } }
    }
  }

  const aiEnabled = Boolean(event.ai_enabled) && Boolean(process.env.AI_API_KEY)
  let moderation = moderateContent({
    type,
    authorName: author,
    body,
    emoji,
    autoApproveClean: Boolean(event.auto_approve_clean_messages),
    aiEnabled,
  })

  if (aiEnabled && type === 'message' && moderation.label !== 'blocked' && moderation.label !== 'personal_data') {
    const ai = await aiClassify(`${author || ''}: ${body || ''}`)
    if (ai) {
      const map = {
        approve: { status: 'approved' as const, audience: 'public' as const, label: moderation.label },
        reject: { status: 'rejected' as const, audience: 'public' as const, label: 'blocked' as const },
        criticism: { status: 'pending' as const, audience: 'admin' as const, label: 'criticism' as const },
        pending: { status: 'pending' as const, audience: 'public' as const, label: 'sensitive' as const },
      }
      const picked = map[ai.decision as keyof typeof map] || map.pending
      moderation = {
        label: picked.label,
        status: picked.status,
        audience: picked.audience,
        note: `Análise automática de texto configurada pela escola: ${ai.reason}`,
        aiUsed: true,
        sentiment: ai.sentiment,
      }
    }
  }

  const postId = randomUUID()
  const createdAt = db.now()
  db.raw.prepare(`
    INSERT INTO posts (
      id, event_id, visitor_id, type, author_name, body, emoji, status, moderation_note,
      moderation_label, audience, sentiment, ai_used, instagram_consent, image_consent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    postId,
    event.id,
    visitorId,
    type,
    author,
    body,
    emoji,
    moderation.status,
    moderation.note,
    moderation.label,
    moderation.audience,
    moderation.sentiment,
    moderation.aiUsed ? 1 : 0,
    opts.fields.instagramConsent === 'true' ? 1 : 0,
    opts.fields.imageConsent === 'true' ? 1 : 0,
    createdAt,
  )

  try {
    let order = 0
    for (const file of type === 'photo' || type === 'video' ? opts.files : []) {
      const kind = sniff(file.buffer)
      if (!kind) throw new Error('formato')
      const isVideo = kind.mime.startsWith('video/')
      if (type === 'photo' && isVideo) throw new Error('foto')
      if (type === 'video' && !isVideo) throw new Error('video')
      if (!isVideo && file.buffer.length > LIMITS.photoBytes) throw new Error('tamanho-foto')
      const mediaId = randomUUID()
      const rel = path.join(String(event.id), postId, `${mediaId}.${kind.ext}`)
      const full = safeMediaPath(rel)
      if (!full) throw new Error('caminho')
      writeBytes(full, file.buffer)
      let duration: number | null = null
      if (isVideo) {
        duration = await probeDuration(full)
        const maxSeconds = Number(event.video_max_seconds) || 15
        if (duration == null) {
          const claimed = Number(opts.fields.durationSeconds || 0)
          if (claimed > 0 && claimed <= maxSeconds + 0.4) duration = claimed
          else throw new Error('duracao-desconhecida')
        }
        if (duration > maxSeconds + 0.4) throw new Error('duracao')
      }
      const size = imageSize(file.buffer, kind.mime)
      db.raw.prepare(`
        INSERT INTO post_media (id, post_id, storage_path, mime, bytes, width, height, duration_seconds, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mediaId, postId, rel, kind.mime, file.buffer.length, size?.width ?? null, size?.height ?? null, duration, order)
      order += 1
    }
  } catch (error) {
    db.deletePost(postId, MEDIA_ROOT)
    const reason = error instanceof Error ? error.message : ''
    const message =
      reason === 'duracao'
        ? `O vídeo precisa ter no máximo ${Number(event.video_max_seconds) || 15} segundos.`
        : reason === 'tamanho-foto'
          ? 'A imagem ficou grande demais. Tente outra foto.'
          : reason === 'formato' || reason === 'foto' || reason === 'video'
            ? 'Formato não aceito. Use JPEG, PNG ou WEBP para fotos e MP4 ou WEBM para vídeos.'
            : 'Não foi possível ler o arquivo. Grave de novo em MP4 ou WEBM, com até 15 segundos.'
    return { status: 400, body: { error: message } }
  }

  db.bump(String(event.id))
  broadcast(opts.slug, { type: 'refresh', reason: 'post' })
  return { status: 201, body: { postId, moderation } }
}

function overview(slug: string) {
  const row = requireEvent(slug)
  if (!row) return null
  const event = db.toPublic(row, logoUrl(slug, Number(row.feed_version) || 0))
  const listed = db.listAdminPosts(String(row.id))
  return {
    event,
    stats: db.stats(String(row.id)),
    posts: listed.posts,
    presences: db.presences(String(row.id)),
    aiKeyConfigured: Boolean(process.env.AI_API_KEY),
    truncated: listed.truncated,
  }
}

function updateSettings(slug: string, patch: Record<string, unknown>, email: string) {
  const row = requireEvent(slug)
  if (!row) return { status: 404, body: { error: 'Evento não encontrado.' } }
  const sets: string[] = []
  const values: Array<string | number> = []
  const textFields: Record<string, string> = {
    name: 'name',
    institution: 'institution',
    municipality: 'municipality',
    state: 'state',
    theme: 'theme',
    slogan: 'slogan',
    description: 'description',
    internalDate: 'internal_date',
    publicDate: 'public_date',
    publicHours: 'public_hours',
    instagramHandle: 'instagram_handle',
    instagramUrl: 'instagram_url',
    welcomeText: 'welcome_text',
  }
  for (const [key, column] of Object.entries(textFields)) {
    if (typeof patch[key] === 'string') {
      const value = String(patch[key]).trim()
      if (!value || value.length > 500) return { status: 400, body: { error: 'Texto inválido nas informações do evento.' } }
      sets.push(`${column} = ?`)
      values.push(value)
    }
  }
  if (patch.sceneDurationSeconds != null) {
    const seconds = Number(patch.sceneDurationSeconds)
    if (!Number.isFinite(seconds) || seconds < 8 || seconds > 60) {
      return { status: 400, body: { error: 'O tempo de cada cena deve ficar entre 8 e 60 segundos.' } }
    }
    sets.push('scene_duration_seconds = ?', 'tv_epoch = ?')
    values.push(Math.round(seconds), db.now())
  }
  if (patch.retentionDays != null) {
    const days = Number(patch.retentionDays)
    if (!Number.isFinite(days) || days < 7 || days > 3650) {
      return { status: 400, body: { error: 'A retenção deve ficar entre 7 e 3650 dias.' } }
    }
    sets.push('retention_days = ?')
    values.push(Math.round(days))
  }
  if (patch.videoMaxSeconds != null) {
    const seconds = Number(patch.videoMaxSeconds)
    if (!Number.isFinite(seconds) || seconds < 5 || seconds > 30) {
      return { status: 400, body: { error: 'O limite de vídeo deve ficar entre 5 e 30 segundos.' } }
    }
    sets.push('video_max_seconds = ?')
    values.push(Math.round(seconds))
  }
  if (Array.isArray(patch.goals)) {
    const goals = patch.goals.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0 && item < 100000)
    if (!goals.length) return { status: 400, body: { error: 'Informe ao menos uma meta numérica.' } }
    sets.push('goals_json = ?')
    values.push(JSON.stringify(goals))
  }
  if (typeof patch.autoApproveCleanMessages === 'boolean') {
    sets.push('auto_approve_clean_messages = ?')
    values.push(patch.autoApproveCleanMessages ? 1 : 0)
  }
  if (typeof patch.aiEnabled === 'boolean') {
    sets.push('ai_enabled = ?')
    values.push(patch.aiEnabled ? 1 : 0)
  }
  if (patch.colors && typeof patch.colors === 'object') {
    const colors = patch.colors as Record<string, unknown>
    const next = {
      navy: safeHex(String(colors.navy || ''), DEFAULT_COLORS.navy),
      royal: safeHex(String(colors.royal || ''), DEFAULT_COLORS.royal),
      gold: safeHex(String(colors.gold || ''), DEFAULT_COLORS.gold),
      ink: safeHex(String(colors.ink || ''), DEFAULT_COLORS.ink),
    }
    sets.push('colors_json = ?')
    values.push(JSON.stringify(next))
  }
  if (patch.scenes && typeof patch.scenes === 'object') {
    const scenes = patch.scenes as Record<string, unknown>
    const next = { ...DEFAULT_SCENES }
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (typeof scenes[key] === 'boolean') next[key] = scenes[key]
    }
    sets.push('scenes_json = ?')
    values.push(JSON.stringify(next))
  }
  if (!sets.length) return { status: 400, body: { error: 'Nada para atualizar.' } }
  sets.push('updated_at = ?')
  values.push(db.now(), row.id)
  db.raw.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...values, String(row.id))
  db.bump(String(row.id))
  audit(db.raw, String(row.id), 'settings', email)
  broadcast(slug, { type: 'refresh', reason: 'settings' })
  const fresh = requireEvent(slug)!
  return { status: 200, body: db.toPublic(fresh, logoUrl(slug, Number(fresh.feed_version) || 0)) }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { ok: true, service: 'ulisses-live', time: db.now() })
    }

    if (parts[0] === 'api' && parts[1] === 'events' && req.method === 'GET' && parts.length === 2) {
      const rows = db.raw.prepare(`SELECT * FROM events ORDER BY is_demo, name`).all() as unknown as EventRow[]
      return send(res, 200, rows.map((row) => db.toPublic(row, logoUrl(row.slug, Number(row.feed_version) || 0))))
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && req.method === 'GET' && parts.length === 3) {
      const row = requireEvent(decodeURIComponent(parts[2]))
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      return send(res, 200, db.toPublic(row, logoUrl(String(row.slug), Number(row.feed_version) || 0)))
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'presence' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[2])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      if (row.status !== 'live') return send(res, 403, { error: 'Este evento não está recebendo presenças agora.' })
      const body = await readJson(req)
      const visitorId = String(body.visitorId || '')
      if (!isVisitorId(visitorId)) return send(res, 400, { error: 'Identificador do navegador inválido.' })
      const result = db.raw.prepare(`
        INSERT INTO presences (id, event_id, visitor_id, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(event_id, visitor_id) DO NOTHING
      `).run(randomUUID(), row.id, visitorId, String(req.headers['user-agent'] || '').slice(0, 180), db.now())
      const created = Number(result.changes) > 0
      const total = db.recount(String(row.id))
      let celebration: { goal: number; total: number; until: string } | null = null
      if (created) {
        const goals = JSON.parse(String(row.goals_json)) as number[]
        const done = JSON.parse(String(row.celebrated_goals_json || '[]')) as number[]
        const hit = goals.filter((goal) => total >= goal && !done.includes(goal))
        if (hit.length) {
          const goal = Math.max(...hit)
          const until = new Date(Date.now() + 20000).toISOString()
          db.raw.prepare(`
            UPDATE events SET celebration_goal = ?, celebration_until = ?, celebrated_goals_json = ? WHERE id = ?
          `).run(goal, until, JSON.stringify([...done, ...hit]), row.id)
          celebration = { goal, total, until }
        }
        db.bump(String(row.id))
        broadcast(slug, { type: 'refresh', reason: 'presence' })
        if (celebration) broadcast(slug, { type: 'celebration', ...celebration })
      }
      return send(res, 200, { already: !created, total, celebration })
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'posts' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[2])
      const typeHeader = req.headers['content-type'] || ''
      if (typeHeader.includes('multipart/form-data')) {
        const form = await readMultipart(req)
        const result = await createContent({ slug, ip: clientIp(req), fields: form.fields, files: form.files })
        return send(res, result.status, result.body)
      }
      const json = await readJson(req)
      const fields: Record<string, string> = {}
      for (const [key, value] of Object.entries(json)) fields[key] = value == null ? '' : String(value)
      const result = await createContent({ slug, ip: clientIp(req), fields, files: [] })
      return send(res, result.status, result.body)
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'mine' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[2])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      const visitorId = String(body.visitorId || '')
      if (!isVisitorId(visitorId)) return send(res, 400, { error: 'Identificador inválido.' })
      const scope = String(body.scope || 'content')
      if (scope === 'content' || scope === 'all') {
        const posts = db.raw.prepare('SELECT id FROM posts WHERE event_id = ? AND visitor_id = ?').all(row.id, visitorId) as { id: string }[]
        for (const post of posts) db.deletePost(post.id, MEDIA_ROOT)
      }
      if (scope === 'presence' || scope === 'all') {
        db.raw.prepare('DELETE FROM presences WHERE event_id = ? AND visitor_id = ?').run(row.id, visitorId)
        db.recount(String(row.id))
      }
      db.bump(String(row.id))
      broadcast(slug, { type: 'refresh', reason: 'delete-mine' })
      return send(res, 200, { ok: true })
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'feed' && req.method === 'GET') {
      const row = requireEvent(decodeURIComponent(parts[2]))
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      return send(res, 200, { posts: db.listPublicPosts(String(row.id)), serverTime: db.now() })
    }

    if (parts[0] === 'api' && parts[1] === 'events' && parts[2] && parts[3] === 'stream' && req.method === 'GET') {
      const slug = decodeURIComponent(parts[2])
      if (!requireEvent(slug)) return send(res, 404, { error: 'Evento não encontrado.' })
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.write(`data: ${JSON.stringify({ type: 'hello', serverTime: db.now() })}\n\n`)
      const client = { res, slug }
      clients.add(client)
      req.on('close', () => clients.delete(client))
      return
    }

    if (parts[0] === 'api' && parts[1] === 'media' && parts[2] && req.method === 'GET') {
      const media = db.getMedia(decodeURIComponent(parts[2]))
      if (!media) return send(res, 404, { error: 'Arquivo não encontrado.' })
      const visible = media.status === 'approved' && media.audience === 'public'
      if (!visible && !adminOf(req)) return send(res, 401, { error: 'Este arquivo ainda não foi autorizado.' })
      const full = safeMediaPath(media.storage_path)
      if (!full || !fileExists(full)) return send(res, 404, { error: 'Arquivo não encontrado.' })
      res.writeHead(200, {
        'Content-Type': media.mime,
        'Content-Length': statSync(full).size,
        'Cache-Control': visible ? 'public, max-age=3600' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      createReadStream(full).pipe(res)
      return
    }

    if (parts[0] === 'api' && parts[1] === 'branding' && parts[2] && parts[3] === 'logo' && req.method === 'GET') {
      const slug = decodeURIComponent(parts[2])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const custom = row.logo_path ? path.join(BRAND_ROOT, path.basename(String(row.logo_path))) : ''
      const file = custom && fileExists(custom) ? custom : defaultLogoFile()
      if (!serveFile(res, file, 'public, max-age=300')) return send(res, 404, { error: 'Logo não encontrada.' })
      return
    }

    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'login' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const account = db.raw.prepare('SELECT email, password_hash FROM admin_account WHERE email = ?').get(email) as
        | { email: string; password_hash: string }
        | undefined
      if (!account || !verifyPassword(password, account.password_hash)) {
        return send(res, 401, { error: 'E-mail ou senha incorretos.' })
      }
      const session = createSession(db.raw, account.email)
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
      res.setHeader('Set-Cookie', `ul_session=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`)
      audit(db.raw, null, 'login', account.email)
      return send(res, 200, { email: account.email })
    }

    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'logout' && req.method === 'POST') {
      const token = cookies(req).ul_session
      if (token) db.raw.prepare('DELETE FROM sessions WHERE token = ?').run(token)
      res.setHeader('Set-Cookie', 'ul_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
      return send(res, 200, { ok: true })
    }

    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'me' && req.method === 'GET') {
      const admin = adminOf(req)
      return send(res, 200, { email: admin?.email || null })
    }

    const admin = parts[0] === 'api' && parts[1] === 'admin' ? adminOf(req) : null
    if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] !== 'login') {
      if (!admin) return send(res, 401, { error: 'Entre com a conta da equipe.' })
    }

    if (admin && parts[2] === 'events' && parts[3] && req.method === 'GET' && parts.length === 4) {
      const data = overview(decodeURIComponent(parts[3]))
      if (!data) return send(res, 404, { error: 'Evento não encontrado.' })
      return send(res, 200, data)
    }

    if (admin && parts[2] === 'events' && req.method === 'POST' && parts.length === 3) {
      const body = await readJson(req)
      const name = String(body.name || '').trim()
      if (name.length < 3 || name.length > 80) return send(res, 400, { error: 'Dê um nome ao evento (3 a 80 caracteres).' })
      let slug = slugify(String(body.slug || name))
      if (db.getEventBySlug(slug)) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`
      const source = db.getEventBySlug('feira-2026')
      const id = randomUUID()
      const now = db.now()
      db.raw.prepare(`
        INSERT INTO events (
          id, slug, name, institution, municipality, state, theme, slogan, description,
          internal_date, public_date, public_hours, instagram_handle, instagram_url,
          status, is_demo, scene_duration_seconds, goals_json, retention_days, tv_epoch,
          colors_json, scenes_json, welcome_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 12, ?, 365, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        slug,
        name,
        source?.institution || 'Escola Estadual Cívico-Militar Ulisses Guimarães',
        source?.municipality || 'Campo Verde',
        source?.state || 'MT',
        source?.theme || 'Ideias que transformam o presente e constroem o futuro!',
        source?.slogan || 'Sua presença. Seu olhar. Nossa história.',
        'Novo evento da escola. Ajuste as datas e publique quando estiver pronto.',
        source?.internal_date || now.slice(0, 10),
        source?.public_date || now.slice(0, 10),
        source?.public_hours || '',
        source?.instagram_handle || '@e.e.c.m.ulissesguimaraes',
        source?.instagram_url || 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/',
        JSON.stringify(DEFAULT_GOALS),
        now,
        JSON.stringify(DEFAULT_COLORS),
        JSON.stringify(DEFAULT_SCENES),
        'Presença confirmada! Você faz parte desta história.',
        now,
        now,
      )
      audit(db.raw, id, 'create-event', slug)
      const created = requireEvent(slug)!
      return send(res, 201, db.toPublic(created, logoUrl(slug, 0)))
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'moderate' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      const action = String(body.action || '')
      const postId = String(body.postId || '')
      const post = db.raw.prepare('SELECT id, type, audience, moderation_label FROM posts WHERE id = ? AND event_id = ?').get(postId, row.id) as
        | { id: string; type: string; audience: string; moderation_label: string | null }
        | undefined
      if (!post) return send(res, 404, { error: 'Publicação não encontrada.' })
      if (action !== 'approve' && action !== 'reject' && action !== 'remove') {
        return send(res, 400, { error: 'Ação inválida.' } )
      }
      const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'removed'
      const keepPrivate =
        action === 'approve' &&
        !body.forcePublic &&
        (post.audience === 'admin' || post.moderation_label === 'personal_data' || post.moderation_label === 'criticism')
      const audience = keepPrivate ? 'admin' : action === 'approve' ? 'public' : post.audience
      const note = String(body.note || '').slice(0, 240)
      db.raw.prepare(`
        UPDATE posts SET status = ?, audience = ?, reviewed_at = ?, reviewed_by = ?,
          moderation_note = CASE WHEN ? != '' THEN ? ELSE moderation_note END
        WHERE id = ?
      `).run(status, audience, db.now(), admin.email, note, note, postId)
      db.bump(String(row.id))
      audit(db.raw, String(row.id), action, postId)
      broadcast(slug, { type: 'refresh', reason: action })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'posts' && parts[5] && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      const post = db.raw.prepare('SELECT id FROM posts WHERE id = ? AND event_id = ?').get(parts[5], row.id)
      if (!post) return send(res, 404, { error: 'Publicação não encontrada.' })
      db.raw.prepare(`
        UPDATE posts SET
          category = COALESCE(?, category),
          comms_format = COALESCE(?, comms_format),
          suggested_caption = COALESCE(?, suggested_caption),
          is_highlight = COALESCE(?, is_highlight)
        WHERE id = ?
      `).run(
        body.category == null ? null : String(body.category).slice(0, 40),
        body.commsFormat == null ? null : String(body.commsFormat).slice(0, 20),
        body.suggestedCaption == null ? null : String(body.suggestedCaption).slice(0, 500),
        body.highlight == null ? null : body.highlight ? 1 : 0,
        parts[5],
      )
      db.bump(String(row.id))
      broadcast(slug, { type: 'refresh', reason: 'highlight' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'posts' && parts[5] && req.method === 'DELETE') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const post = db.raw.prepare('SELECT id FROM posts WHERE id = ? AND event_id = ?').get(parts[5], row.id)
      if (!post) return send(res, 404, { error: 'Publicação não encontrada.' })
      db.deletePost(parts[5], MEDIA_ROOT)
      db.bump(String(row.id))
      audit(db.raw, String(row.id), 'hard-delete', parts[5])
      broadcast(slug, { type: 'refresh', reason: 'delete' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'settings' && req.method === 'POST') {
      const body = await readJson(req)
      const result = updateSettings(decodeURIComponent(parts[3]), body, admin.email)
      return send(res, result.status, result.body)
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'logo' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const form = await readMultipart(req)
      const file = form.files[0]
      if (!file) return send(res, 400, { error: 'Envie a imagem da logomarca.' })
      const kind = sniff(file.buffer)
      if (!kind || kind.mime.startsWith('video/')) return send(res, 400, { error: 'A logomarca precisa ser PNG, JPEG ou WEBP.' })
      const filename = `${row.id}.${kind.ext}`
      writeBytes(path.join(BRAND_ROOT, filename), file.buffer)
      db.raw.prepare('UPDATE events SET logo_path = ?, updated_at = ? WHERE id = ?').run(filename, db.now(), row.id)
      db.bump(String(row.id))
      broadcast(slug, { type: 'refresh', reason: 'logo' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'emergency' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      const stop = Boolean(body.stop)
      db.raw.prepare('UPDATE events SET emergency_stop = ?, updated_at = ? WHERE id = ?').run(stop ? 1 : 0, db.now(), row.id)
      db.bump(String(row.id))
      audit(db.raw, String(row.id), stop ? 'emergency-on' : 'emergency-off', admin.email)
      broadcast(slug, { type: 'refresh', reason: 'emergency' })
      return send(res, 200, { ok: true, stop })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'mural' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      db.raw.prepare('UPDATE events SET mural_enabled = ?, updated_at = ? WHERE id = ?').run(body.enabled ? 1 : 0, db.now(), row.id)
      db.bump(String(row.id))
      broadcast(slug, { type: 'refresh', reason: 'mural' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'status' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const body = await readJson(req)
      const status = String(body.status || '')
      if (status !== 'draft' && status !== 'live' && status !== 'ended') {
        return send(res, 400, { error: 'Situação inválida.' })
      }
      db.raw.prepare('UPDATE events SET status = ?, updated_at = ? WHERE id = ?').run(status, db.now(), row.id)
      db.bump(String(row.id))
      audit(db.raw, String(row.id), `status-${status}`, admin.email)
      broadcast(slug, { type: 'refresh', reason: 'status' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'purge-demo' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      if (!row.is_demo) return send(res, 400, { error: 'Só é possível apagar dados do modo de demonstração.' })
      const posts = db.raw.prepare('SELECT id FROM posts WHERE event_id = ?').all(row.id) as { id: string }[]
      for (const post of posts) db.deletePost(post.id, MEDIA_ROOT)
      db.raw.prepare('DELETE FROM presences WHERE event_id = ?').run(row.id)
      db.raw.prepare(`
        UPDATE events SET presence_count = 0, celebration_goal = NULL, celebration_until = NULL,
          celebrated_goals_json = '[]', updated_at = ? WHERE id = ?
      `).run(db.now(), row.id)
      db.bump(String(row.id))
      audit(db.raw, String(row.id), 'purge-demo', admin.email)
      broadcast(slug, { type: 'refresh', reason: 'purge' })
      return send(res, 200, { ok: true, removed: posts.length })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'seed-demo' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      if (!row.is_demo) return send(res, 400, { error: 'Os exemplos só podem entrar no modo de demonstração.' })
      const already = db.raw.prepare(`SELECT id FROM posts WHERE event_id = ? AND visitor_id LIKE 'demo-seed-%' LIMIT 1`).get(row.id)
      if (already) return send(res, 200, { ok: true, already: true })
      const samples = [
        ['Ana', 'A feira está linda. Orgulho da nossa escola!', '🤩'],
        ['Pedro', 'Ciência que transforma o futuro. Parabéns, estudantes!', '🚀'],
        ['Marina', 'Que alegria ver a comunidade reunida em Campo Verde.', '👏'],
        ['Lucas', 'Ideias que constroem o futuro. Viva o Ulisses!', '💡'],
      ] as const
      samples.forEach((sample, index) => {
        const visitor = `00000000-0000-4000-8000-00000000000${index + 1}`
        db.raw.prepare(`
          INSERT INTO presences (id, event_id, visitor_id, user_agent, created_at)
          VALUES (?, ?, ?, 'demonstracao', ?)
          ON CONFLICT(event_id, visitor_id) DO NOTHING
        `).run(randomUUID(), row.id, visitor, db.now())
        db.raw.prepare(`
          INSERT INTO posts (
            id, event_id, visitor_id, type, author_name, body, emoji, status, moderation_note,
            moderation_label, audience, ai_used, created_at
          ) VALUES (?, ?, ?, 'message', ?, ?, ?, 'approved', 'Exemplo do modo demonstração.', 'clean', 'public', 0, ?)
        `).run(randomUUID(), row.id, `demo-seed-${index}`, sample[0], sample[1], sample[2], db.now())
      })
      const fixtures = [
        ['server/fixtures/demo-ciencia.jpg', 'Equipe de Ciências', 'Experiência de demonstração — não é foto de estudante.'],
        ['server/fixtures/demo-cultura.jpg', 'Equipe de Cultura', 'Imagem gerada só para testar o mosaico.'],
      ] as const
      fixtures.forEach((fixture, index) => {
        const postId = randomUUID()
        const mediaId = randomUUID()
        const rel = path.join(String(row.id), postId, `${mediaId}.jpg`)
        copyFixture(path.join(process.cwd(), fixture[0]), path.join(MEDIA_ROOT, rel))
        db.raw.prepare(`
          INSERT INTO posts (
            id, event_id, visitor_id, type, author_name, body, emoji, status, moderation_note,
            moderation_label, audience, ai_used, image_consent, created_at
          ) VALUES (?, ?, ?, 'photo', ?, ?, '🎉', 'approved', 'Imagem de teste do modo demonstração.', 'media_review', 'public', 0, 1, ?)
        `).run(postId, row.id, `demo-seed-photo-${index}`, fixture[1], fixture[2], db.now())
        const bytes = readBytes(path.join(MEDIA_ROOT, rel)).length
        db.raw.prepare(`
          INSERT INTO post_media (id, post_id, storage_path, mime, bytes, width, height, sort_order)
          VALUES (?, ?, ?, 'image/jpeg', ?, 800, 600, 0)
        `).run(mediaId, postId, rel, bytes)
      })
      db.recount(String(row.id))
      db.bump(String(row.id))
      broadcast(slug, { type: 'refresh', reason: 'seed' })
      return send(res, 200, { ok: true })
    }

    if (admin && parts[2] === 'events' && parts[3] && parts[4] === 'retention' && req.method === 'POST') {
      const slug = decodeURIComponent(parts[3])
      const row = requireEvent(slug)
      if (!row) return send(res, 404, { error: 'Evento não encontrado.' })
      const before = (db.raw.prepare('SELECT COUNT(*) AS n FROM posts WHERE event_id = ?').get(row.id) as { n: number }).n
      const cutoff = new Date(Date.now() - Number(row.retention_days) * 86400000).toISOString()
      const oldPosts = db.raw.prepare('SELECT id FROM posts WHERE event_id = ? AND created_at < ?').all(row.id, cutoff) as { id: string }[]
      for (const post of oldPosts) db.deletePost(post.id, MEDIA_ROOT)
      db.raw.prepare('DELETE FROM presences WHERE event_id = ? AND created_at < ?').run(row.id, cutoff)
      db.recount(String(row.id))
      db.bump(String(row.id))
      const after = (db.raw.prepare('SELECT COUNT(*) AS n FROM posts WHERE event_id = ?').get(row.id) as { n: number }).n
      return send(res, 200, { removed: Number(before) - Number(after) })
    }

    if (admin && parts[2] === 'captions' && req.method === 'POST') {
      const body = await readJson(req)
      const eventName = String(body.eventName || 'Feira do Conhecimento 2026')
      const author = body.authorName ? String(body.authorName) : null
      const text = body.body ? String(body.body) : null
      const handle = String(body.handle || '@e.e.c.m.ulissesguimaraes')
      const templates = templateCaptions(eventName, author, text, handle)
      if (!process.env.AI_API_KEY || body.useAi !== true) {
        return send(res, 200, {
          ai: false,
          captions: templates,
          message: 'Nenhum serviço de inteligência artificial está configurado. As sugestões são modelos prontos.',
        })
      }
      const ai = await aiClassify(`Sugira uma legenda curta de Instagram, em português, sem inventar fatos, para: ${text || eventName}. Autor: ${author || 'estudante'}.`)
      return send(res, 200, {
        ai: Boolean(ai),
        captions: ai ? [ai.reason, ...templates] : templates,
        message: ai ? 'A primeira sugestão veio do serviço de IA configurado.' : 'A IA não respondeu. Usamos modelos prontos.',
      })
    }

    if (req.method === 'GET' && !url.pathname.startsWith('/api')) {
      const file = staticFile(url.pathname === '/' ? '/index.html' : url.pathname)
      if (file && serveFile(res, file, file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600')) return
    }

    send(res, 404, { error: 'Não encontrado.' })
  } catch (error) {
    console.error(error)
    if (!res.headersSent) send(res, 500, { error: 'Erro interno. Tente novamente.' })
  }
})

applyRetention()
setInterval(applyRetention, 6 * 60 * 60 * 1000)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ULISSES LIVE ouvindo em http://127.0.0.1:${PORT}`)
})
