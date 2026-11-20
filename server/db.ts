import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DEFAULT_COLORS, DEFAULT_GOALS, DEFAULT_SCENES, DEMO_SLUG, REAL_EVENT } from '../shared/constants.ts'
import { mapEventRow } from '../shared/map.ts'
import type { AdminPost, MediaItem, PublicEvent, PublicPost, Stats } from '../shared/types.ts'
import { cuiabaParts, dayOf, shiftOf } from '../shared/text.ts'

export interface EventRow {
  id: string
  slug: string
  name: string
  institution: string
  municipality: string
  state: string
  theme: string
  slogan: string
  description: string
  internal_date: string
  public_date: string
  public_hours: string
  instagram_handle: string
  instagram_url: string
  status: string
  is_demo: number
  logo_path: string | null
  scene_duration_seconds: number
  goals_json: string
  retention_days: number
  emergency_stop: number
  mural_enabled: number
  video_max_seconds: number
  video_max_bytes: number
  photo_max_count: number
  message_max_chars: number
  auto_approve_clean_messages: number
  tv_epoch: string
  celebration_goal: number | null
  celebration_until: string | null
  celebrated_goals_json: string
  colors_json: string
  scenes_json: string
  welcome_text: string
  presence_count: number
  feed_version: number
  ai_enabled: number
  created_at: string
  updated_at: string
}

export interface Db {
  raw: DatabaseSync
  now(): string
  getEventBySlug(slug: string): EventRow | undefined
  toPublic(row: EventRow, logoUrl: string): PublicEvent
  recount(eventId: string): number
  bump(eventId: string): void
  listPublicPosts(eventId: string): PublicPost[]
  listAdminPosts(eventId: string): { posts: AdminPost[]; truncated: boolean }
  stats(eventId: string): Stats
  presences(eventId: string): { createdAt: string; day: string; shift: string }[]
  mediaByPost(postId: string): MediaItem[]
  getMedia(id: string): { id: string; post_id: string; storage_path: string; mime: string; bytes: number; status: string; audience: string } | undefined
  deletePost(postId: string, mediaRoot: string): void
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32)
  const prev = Buffer.from(hash, 'hex')
  if (next.length !== prev.length) return false
  return timingSafeEqual(next, prev)
}

function eventSeed(id: string, demo: boolean, now: string) {
  const base = REAL_EVENT
  return {
    id,
    slug: demo ? DEMO_SLUG : base.slug,
    name: demo ? `${base.name} — demonstração` : base.name,
    institution: base.institution,
    municipality: base.municipality,
    state: base.state,
    theme: base.theme,
    slogan: base.slogan,
    description: demo
      ? 'Evento de demonstração, separado dos dados reais da Feira do Conhecimento 2026. Pode ser apagado sem afetar o evento oficial.'
      : base.description,
    internal_date: base.internalDate,
    public_date: base.publicDate,
    public_hours: base.publicHours,
    instagram_handle: base.instagramHandle,
    instagram_url: base.instagramUrl,
    status: 'live',
    is_demo: demo ? 1 : 0,
    welcome_text: base.welcomeText,
    now,
  }
}

export function openDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(path.join(dataDir, 'media'), { recursive: true })
  mkdirSync(path.join(dataDir, 'branding'), { recursive: true })
  const raw = new DatabaseSync(path.join(dataDir, 'ulisses.db'))
  raw.exec('PRAGMA journal_mode = WAL')
  raw.exec('PRAGMA foreign_keys = ON')
  raw.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      institution TEXT NOT NULL,
      municipality TEXT NOT NULL,
      state TEXT NOT NULL,
      theme TEXT NOT NULL,
      slogan TEXT NOT NULL,
      description TEXT NOT NULL,
      internal_date TEXT NOT NULL,
      public_date TEXT NOT NULL,
      public_hours TEXT NOT NULL,
      instagram_handle TEXT NOT NULL,
      instagram_url TEXT NOT NULL,
      status TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      logo_path TEXT,
      scene_duration_seconds INTEGER NOT NULL DEFAULT 12,
      goals_json TEXT NOT NULL,
      retention_days INTEGER NOT NULL DEFAULT 365,
      emergency_stop INTEGER NOT NULL DEFAULT 0,
      mural_enabled INTEGER NOT NULL DEFAULT 1,
      video_max_seconds INTEGER NOT NULL DEFAULT 15,
      video_max_bytes INTEGER NOT NULL DEFAULT 26214400,
      photo_max_count INTEGER NOT NULL DEFAULT 5,
      message_max_chars INTEGER NOT NULL DEFAULT 200,
      auto_approve_clean_messages INTEGER NOT NULL DEFAULT 0,
      tv_epoch TEXT NOT NULL,
      celebration_goal INTEGER,
      celebration_until TEXT,
      celebrated_goals_json TEXT NOT NULL DEFAULT '[]',
      colors_json TEXT NOT NULL,
      scenes_json TEXT NOT NULL,
      welcome_text TEXT NOT NULL,
      presence_count INTEGER NOT NULL DEFAULT 0,
      feed_version INTEGER NOT NULL DEFAULT 0,
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS presences (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, visitor_id)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      type TEXT NOT NULL,
      author_name TEXT,
      body TEXT,
      emoji TEXT,
      status TEXT NOT NULL,
      moderation_note TEXT,
      moderation_label TEXT,
      audience TEXT NOT NULL,
      sentiment TEXT,
      ai_used INTEGER NOT NULL DEFAULT 0,
      is_highlight INTEGER NOT NULL DEFAULT 0,
      instagram_consent INTEGER NOT NULL DEFAULT 0,
      image_consent INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      comms_format TEXT,
      suggested_caption TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    );
    CREATE TABLE IF NOT EXISTS post_media (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      duration_seconds REAL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS admin_account (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_event ON posts(event_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_presences_event ON presences(event_id, created_at);
  `)

  const now = () => new Date().toISOString()
  const insertEvent = raw.prepare(`
    INSERT INTO events (
      id, slug, name, institution, municipality, state, theme, slogan, description,
      internal_date, public_date, public_hours, instagram_handle, instagram_url,
      status, is_demo, scene_duration_seconds, goals_json, retention_days,
      tv_epoch, colors_json, scenes_json, welcome_text, created_at, updated_at
    ) VALUES (
      @id, @slug, @name, @institution, @municipality, @state, @theme, @slogan, @description,
      @internal_date, @public_date, @public_hours, @instagram_handle, @instagram_url,
      @status, @is_demo, 12, @goals, 365,
      @now, @colors, @scenes, @welcome_text, @now, @now
    )
  `)
  for (const demo of [false, true]) {
    const seed = eventSeed(randomUUID(), demo, now())
    const exists = raw.prepare('SELECT id FROM events WHERE slug = ?').get(seed.slug)
    if (!exists) {
      insertEvent.run({
        ...seed,
        goals: JSON.stringify(DEFAULT_GOALS),
        colors: JSON.stringify(DEFAULT_COLORS),
        scenes: JSON.stringify(DEFAULT_SCENES),
      })
    }
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@eecm.local').trim().toLowerCase()
  const existingAdmin = raw.prepare('SELECT email, password_hash FROM admin_account WHERE email = ?').get(email) as
    | { email: string; password_hash: string }
    | undefined
  const password = process.env.ADMIN_PASSWORD
  if (!existingAdmin) {
    const chosen = password || randomBytes(9).toString('base64url')
    raw.prepare('INSERT INTO admin_account (email, password_hash) VALUES (?, ?)').run(email, hashPassword(chosen))
    const note = `Administração local do ULISSES LIVE\nE-mail: ${email}\nSenha: ${chosen}\nGuarde este arquivo. Ele fica só na pasta data/ desta máquina.\n`
    writeFileSync(path.join(dataDir, 'CREDENCIAIS.txt'), note, { mode: 0o600 })
    if (!password) console.log(`\nSenha de administração gerada. Veja ${path.join(dataDir, 'CREDENCIAIS.txt')}\n`)
  } else if (password && process.env.ADMIN_SYNC === '1') {
    raw.prepare('UPDATE admin_account SET password_hash = ? WHERE email = ?').run(hashPassword(password), email)
  }

  function rowToMedia(row: Record<string, unknown>, url: string): MediaItem {
    return {
      id: String(row.id),
      url,
      mime: String(row.mime),
      bytes: Number(row.bytes),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      sortOrder: Number(row.sort_order) || 0,
    }
  }

  const db: Db = {
    raw,
    now,
    getEventBySlug(slug) {
      return raw.prepare('SELECT * FROM events WHERE slug = ?').get(slug) as EventRow | undefined
    },
    toPublic(row, logoUrl) {
      const aiKey = Boolean(process.env.AI_API_KEY)
      return mapEventRow(row as unknown as Record<string, unknown>, {
        serverTime: now(),
        aiConfigured: aiKey && Boolean(row.ai_enabled),
        logoUrl,
      })
    },
    recount(eventId) {
      const count = raw.prepare('SELECT COUNT(*) AS n FROM presences WHERE event_id = ?').get(eventId) as { n: number }
      raw.prepare('UPDATE events SET presence_count = ?, updated_at = ? WHERE id = ?').run(count.n, now(), eventId)
      return Number(count.n)
    },
    bump(eventId) {
      raw.prepare('UPDATE events SET feed_version = feed_version + 1, updated_at = ? WHERE id = ?').run(now(), eventId)
    },
    listPublicPosts(eventId) {
      const posts = raw.prepare(`
        SELECT * FROM posts
        WHERE event_id = ? AND status = 'approved' AND audience = 'public'
        ORDER BY is_highlight DESC, created_at DESC
        LIMIT 300
      `).all(eventId) as Record<string, unknown>[]
      return posts.map((post) => ({
        id: String(post.id),
        type: post.type as PublicPost['type'],
        authorName: post.author_name ? String(post.author_name) : null,
        body: post.body ? String(post.body) : null,
        emoji: post.emoji ? String(post.emoji) : null,
        createdAt: String(post.created_at),
        highlight: Number(post.is_highlight) === 1,
        media: mediaFor(raw, String(post.id)).map((item) => rowToMedia(item, `/api/media/${item.id}`)),
      }))
    },
    listAdminPosts(eventId) {
      const total = raw.prepare('SELECT COUNT(*) AS n FROM posts WHERE event_id = ?').get(eventId) as { n: number }
      const posts = raw.prepare(`
        SELECT * FROM posts WHERE event_id = ? ORDER BY created_at DESC LIMIT 2000
      `).all(eventId) as Record<string, unknown>[]
      return {
        truncated: Number(total.n) > posts.length,
        posts: posts.map((post) => mapAdmin(post, mediaFor(raw, String(post.id)).map((item) => rowToMedia(item, `/api/media/${item.id}`)))),
      }
    },
    stats(eventId) {
      const one = (sql: string) => Number((raw.prepare(sql).get(eventId) as { n: number }).n)
      const presences = one('SELECT COUNT(*) AS n FROM presences WHERE event_id = ?')
      const authors = one(
        `SELECT COUNT(DISTINCT visitor_id) AS n FROM posts WHERE event_id = ? AND type != 'reaction'`,
      )
      const presenceRows = raw.prepare('SELECT created_at FROM presences WHERE event_id = ?').all(eventId) as { created_at: string }[]
      const hourCounts = new Map<number, number>()
      for (const row of presenceRows) {
        const hour = cuiabaParts(row.created_at).hour
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      }
      const byHour = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourCounts.get(hour) || 0,
      }))
      const shiftMap = new Map<string, number>()
      for (const row of presenceRows) {
        const key = `${dayOf(row.created_at)}|${shiftOf(row.created_at)}`
        shiftMap.set(key, (shiftMap.get(key) || 0) + 1)
      }
      const byDayShift = [...shiftMap.entries()]
        .map(([key, count]) => {
          const [day, shift] = key.split('|')
          return { day, shift, count }
        })
        .sort((a, b) => a.day.localeCompare(b.day) || a.shift.localeCompare(b.shift))
      return {
        presences,
        messages: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND type = 'message'`),
        messagesApproved: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND type = 'message' AND status = 'approved'`),
        photos: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND type = 'photo'`),
        videos: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND type = 'video'`),
        reactions: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND type = 'reaction'`),
        pending: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND status = 'pending'`),
        rejected: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND status = 'rejected'`),
        removed: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND status = 'removed'`),
        highlights: one(`SELECT COUNT(*) AS n FROM posts WHERE event_id = ? AND is_highlight = 1`),
        engagementRate: presences === 0 ? 0 : Math.round((authors / presences) * 1000) / 10,
        byHour,
        byDayShift,
      } satisfies Stats
    },
    presences(eventId) {
      const rows = raw.prepare('SELECT created_at FROM presences WHERE event_id = ? ORDER BY created_at').all(eventId) as {
        created_at: string
      }[]
      return rows.map((row) => ({
        createdAt: row.created_at,
        day: dayOf(row.created_at),
        shift: shiftOf(row.created_at),
      }))
    },
    mediaByPost(postId) {
      return mediaFor(raw, postId).map((item) => rowToMedia(item, `/api/media/${item.id}`))
    },
    getMedia(id) {
      return raw.prepare(`
        SELECT m.id, m.post_id, m.storage_path, m.mime, m.bytes, p.status, p.audience
        FROM post_media m JOIN posts p ON p.id = m.post_id
        WHERE m.id = ?
      `).get(id) as
        | { id: string; post_id: string; storage_path: string; mime: string; bytes: number; status: string; audience: string }
        | undefined
    },
    deletePost(postId, mediaRoot) {
      const files = raw.prepare('SELECT storage_path FROM post_media WHERE post_id = ?').all(postId) as { storage_path: string }[]
      for (const file of files) {
        const full = path.join(mediaRoot, file.storage_path)
        if (existsSync(full)) rmSync(full, { force: true })
      }
      raw.prepare('DELETE FROM posts WHERE id = ?').run(postId)
    },
  }
  return db
}

function mediaFor(raw: DatabaseSync, postId: string): Record<string, unknown>[] {
  return raw.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order').all(postId) as Record<string, unknown>[]
}

function mapAdmin(post: Record<string, unknown>, media: MediaItem[]): AdminPost {
  return {
    id: String(post.id),
    type: post.type as AdminPost['type'],
    authorName: post.author_name ? String(post.author_name) : null,
    body: post.body ? String(post.body) : null,
    emoji: post.emoji ? String(post.emoji) : null,
    createdAt: String(post.created_at),
    highlight: Number(post.is_highlight) === 1,
    media,
    status: post.status as AdminPost['status'],
    visitorId: String(post.visitor_id),
    moderationNote: post.moderation_note ? String(post.moderation_note) : null,
    moderationLabel: post.moderation_label ? String(post.moderation_label) : null,
    audience: post.audience as AdminPost['audience'],
    aiUsed: Number(post.ai_used) === 1,
    sentiment: post.sentiment ? String(post.sentiment) : null,
    instagramConsent: Number(post.instagram_consent) === 1,
    imageConsent: Number(post.image_consent) === 1,
    category: post.category ? String(post.category) : null,
    commsFormat: post.comms_format ? String(post.comms_format) : null,
    suggestedCaption: post.suggested_caption ? String(post.suggested_caption) : null,
  }
}

export function createSession(raw: DatabaseSync, email: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  raw.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, email, createdAt, expiresAt)
  return { token, expiresAt }
}

export function readSession(raw: DatabaseSync, token: string | undefined): { email: string } | null {
  if (!token) return null
  const row = raw.prepare('SELECT email, expires_at FROM sessions WHERE token = ?').get(token) as
    | { email: string; expires_at: string }
    | undefined
  if (!row) return null
  if (row.expires_at < new Date().toISOString()) {
    raw.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  return { email: row.email }
}

export function audit(raw: DatabaseSync, eventId: string | null, action: string, detail?: string) {
  raw.prepare('INSERT INTO audit (id, event_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(),
    eventId,
    action,
    detail || null,
    new Date().toISOString(),
  )
}

export function copyFixture(from: string, to: string) {
  mkdirSync(path.dirname(to), { recursive: true })
  copyFileSync(from, to)
}

export function defaultLogoFile(): string {
  return path.join(process.cwd(), 'public', 'brand', 'logo.png')
}

export function writeBytes(file: string, bytes: Buffer) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, bytes)
}

export function fileExists(file: string): boolean {
  return existsSync(file)
}

export function readBytes(file: string): Buffer {
  return readFileSync(file)
}
