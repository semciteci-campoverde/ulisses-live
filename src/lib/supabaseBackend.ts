import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mapEventRow } from '../../shared/map.ts'
import { templateCaptions } from '../../shared/text.ts'
import { cuiabaParts, dayOf, shiftOf } from '../../shared/text.ts'
import type { AdminOverview, AdminPost, CreatePostResult, MediaItem, PublicEvent, PublicPost, Stats } from '../../shared/types.ts'
import { ApiError, type Backend } from './backend.ts'

type Row = Record<string, unknown>

function fail(error: { message: string } | null, fallback = 'Não foi possível concluir agora.'): void {
  if (!error) return
  const message = error.message.replace(/^.*ERROR:\s*/i, '').slice(0, 280)
  throw new ApiError(400, message || fallback)
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const supabase: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  // iPhone grava .mov (video/quicktime); o conteúdo é o mesmo tipo de arquivo do MP4 e o Chrome toca como MP4.
  function normalizeMime(type: string, kind: string): string {
    const t = (type || '').toLowerCase()
    if (kind === 'video') return t === 'video/webm' ? 'video/webm' : 'video/mp4'
    if (t === 'image/png' || t === 'image/webp') return t
    return 'image/jpeg'
  }

  // Envio com barra de progresso (o upload do supabase-js não informa progresso) e uma nova tentativa se a rede cair.
  async function uploadPrivate(path: string, blob: Blob, contentType: string, onProgress: (f: number) => void): Promise<void> {
    const token = (await supabase.auth.getSession()).data.session?.access_token || key
    const once = () => new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${url}/storage/v1/object/ulisses-private/${path}`)
      xhr.setRequestHeader('authorization', `Bearer ${token}`)
      xhr.setRequestHeader('apikey', key)
      xhr.setRequestHeader('content-type', contentType)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader('cache-control', 'max-age=3600')
      xhr.timeout = 10 * 60 * 1000
      xhr.upload.onprogress = (ev) => { if (ev.lengthComputable && ev.total) onProgress(ev.loaded / ev.total) }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        let msg = ''
        try { msg = String(JSON.parse(xhr.responseText).message || '') } catch { msg = '' }
        if (xhr.status === 413 || /size|large|exceed/i.test(msg)) return reject(new ApiError(413, 'O arquivo está grande demais (máximo 25 MB). Grave um vídeo mais curto ou em qualidade menor.'))
        if (/mime|type/i.test(msg)) return reject(new ApiError(415, 'Formato não aceito. Use foto JPEG/PNG ou vídeo MP4.'))
        if (/exists|duplicate/i.test(msg)) return resolve()
        reject(new ApiError(xhr.status || 400, 'Não foi possível guardar o arquivo. Tente de novo.'))
      }
      xhr.onerror = () => reject(new ApiError(0, 'A conexão caiu durante o envio. Verifique a internet e tente de novo.'))
      xhr.ontimeout = () => reject(new ApiError(0, 'O envio demorou demais. Tente de novo com uma conexão melhor ou um vídeo menor.'))
      xhr.send(blob)
    })
    try {
      await once()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) { onProgress(0); await once() } else throw caught
    }
  }

  async function eventRow(slug: string): Promise<Row> {
    const { data, error } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle()
    fail(error)
    if (!data) throw new ApiError(404, 'Evento não encontrado.')
    return data as Row
  }

  function logoOf(row: Row): string {
    const logo = row.logo_path ? String(row.logo_path) : ''
    if (!logo) return '/brand/logo.png'
    if (logo.startsWith('http')) return logo
    return supabase.storage.from('ulisses-public').getPublicUrl(logo).data.publicUrl
  }

  function toEvent(row: Row): PublicEvent {
    return mapEventRow(row, {
      serverTime: new Date().toISOString(),
      aiConfigured: flag(row.ai_enabled),
      logoUrl: logoOf(row),
    })
  }

  async function mediaItems(rows: Row[], signed: boolean): Promise<MediaItem[]> {
    const items: MediaItem[] = []
    for (const row of rows) {
      let url = ''
      if (row.public_path) {
        url = supabase.storage.from('ulisses-public').getPublicUrl(String(row.public_path)).data.publicUrl
      } else if (signed && row.storage_path) {
        const signedUrl = await supabase.storage.from('ulisses-private').createSignedUrl(String(row.storage_path), 60 * 60)
        url = signedUrl.data?.signedUrl || ''
      }
      items.push({
        id: String(row.id),
        url,
        mime: String(row.mime),
        bytes: Number(row.bytes) || 0,
        width: row.width == null ? null : Number(row.width),
        height: row.height == null ? null : Number(row.height),
        durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
        sortOrder: Number(row.sort_order) || 0,
      })
    }
    return items
  }

  function mapPost(row: Row, media: MediaItem[], admin: boolean): PublicPost | AdminPost {
    const base: PublicPost = {
      id: String(row.id),
      type: row.type as PublicPost['type'],
      authorName: row.author_name ? String(row.author_name) : null,
      body: row.body ? String(row.body) : null,
      emoji: row.emoji ? String(row.emoji) : null,
      createdAt: String(row.created_at),
      highlight: flag(row.is_highlight),
      media,
    }
    if (!admin) return base
    return {
      ...base,
      status: row.status as AdminPost['status'],
      visitorId: String(row.visitor_id),
      moderationNote: row.moderation_note ? String(row.moderation_note) : null,
      moderationLabel: row.moderation_label ? String(row.moderation_label) : null,
      audience: row.audience as AdminPost['audience'],
      aiUsed: flag(row.ai_used),
      sentiment: row.sentiment ? String(row.sentiment) : null,
      instagramConsent: flag(row.instagram_consent),
      imageConsent: flag(row.image_consent),
      category: row.category ? String(row.category) : null,
      commsFormat: row.comms_format ? String(row.comms_format) : null,
      suggestedCaption: row.suggested_caption ? String(row.suggested_caption) : null,
    }
  }

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser()
    fail(error, 'Entre com a conta da equipe.')
    if (!data.user) throw new ApiError(401, 'Entre com a conta da equipe.')
    return data.user
  }

  return {
    mode: 'supabase',
    async getEvent(slug) {
      return toEvent(await eventRow(slug))
    },
    async listEvents() {
      const { data, error } = await supabase.from('events').select('*').order('is_demo').order('name')
      fail(error)
      return ((data || []) as Row[]).map(toEvent)
    },
    async registerPresence(slug, visitorId) {
      const { data, error } = await supabase.rpc('register_presence', { p_slug: slug, p_visitor_id: visitorId })
      fail(error)
      const payload = data as { already: boolean; total: number }
      return { already: Boolean(payload.already), total: Number(payload.total) }
    },
    async createPost(slug, draft) {
      const { data, error } = await supabase.rpc('create_post', {
        p_slug: slug,
        p_visitor_id: draft.visitorId,
        p_type: draft.type,
        p_author: draft.authorName || '',
        p_body: draft.body || '',
        p_emoji: draft.emoji || '',
        p_image_consent: Boolean(draft.imageConsent),
        p_instagram_consent: Boolean(draft.instagramConsent),
        p_honeypot: draft.website || '',
      })
      fail(error)
      const payload = data as CreatePostResult
      if ((draft.type === 'photo' || draft.type === 'video') && draft.files?.length) {
        const total = draft.files.length
        try {
          let sort = 0
          for (const file of draft.files) {
            const mime = normalizeMime(file.blob.type, draft.type)
            const ext = mime === 'video/webm' ? 'webm' : mime === 'video/mp4' ? 'mp4' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
            const objectPath = `pending/${payload.postId}/${crypto.randomUUID()}.${ext}`
            const index = sort
            await uploadPrivate(objectPath, file.blob, mime, (f) => draft.onProgress?.((index + f) / total))
            const registered = await supabase.rpc('register_media', {
              p_post_id: payload.postId,
              p_visitor_id: draft.visitorId,
              p_path: objectPath,
              p_mime: mime,
              p_bytes: file.blob.size,
              p_duration: draft.durationSeconds || null,
              p_sort: sort,
            })
            fail(registered.error)
            sort += 1
          }
          draft.onProgress?.(1)
        } catch (caught) {
          // O envio falhou: apaga a publicação vazia para ela não ficar na fila sem arquivo.
          await supabase.rpc('discard_failed_post', { p_post_id: payload.postId, p_visitor_id: draft.visitorId }).then(() => null, () => null)
          throw caught
        }
      }
      if (draft.type === 'message' && payload.moderation.status === 'pending' && payload.moderation.label === 'clean') {
        const event = await eventRow(slug)
        if (flag(event.ai_enabled)) {
          await supabase.functions.invoke('moderate-text', { body: { postId: payload.postId } }).catch(() => null)
        }
      }
      return payload
    },
    async deleteMine(slug, visitorId, scope) {
      const { error } = await supabase.rpc('delete_mine', { p_slug: slug, p_visitor_id: visitorId, p_scope: scope })
      fail(error)
    },
    async feed(slug) {
      const event = await eventRow(slug)
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('event_id', event.id)
        .eq('status', 'approved')
        .eq('audience', 'public')
        .order('is_highlight', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300)
      fail(error)
      const posts: PublicPost[] = []
      for (const row of (data || []) as Row[]) {
        const media = await mediaItems((row.post_media as Row[]) || [], false)
        posts.push(mapPost(row, media, false) as PublicPost)
      }
      return posts
    },
    subscribe(slug, cb) {
      const channel = supabase
        .channel(`ulisses-${slug}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `slug=eq.${slug}` }, () =>
          cb({ type: 'refresh', reason: 'realtime' }),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') cb({ type: 'status', connected: true })
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            cb({ type: 'status', connected: false })
          }
        })
      return () => {
        void supabase.removeChannel(channel)
      }
    },
    admin: {
      async login(email, password) {
        const auth = await supabase.auth.signInWithPassword({ email, password })
        if (auth.error || !auth.data.user) throw new ApiError(401, 'E-mail ou senha incorretos.')
        const allowed = await supabase.from('admin_users').select('user_id').eq('user_id', auth.data.user.id).maybeSingle()
        if (allowed.error || !allowed.data) {
          await supabase.auth.signOut()
          throw new ApiError(403, 'Esta conta não tem permissão de administração.')
        }
        return { email }
      },
      async logout() {
        await supabase.auth.signOut()
      },
      async me() {
        const { data } = await supabase.auth.getSession()
        if (!data.session?.user) return null
        const allowed = await supabase.from('admin_users').select('user_id').eq('user_id', data.session.user.id).maybeSingle()
        if (!allowed.data) return null
        return { email: data.session.user.email || '' }
      },
      async overview(slug) {
        await requireUser()
        const event = await eventRow(slug)
        const postsQuery = await supabase
          .from('posts')
          .select('*, post_media(*)')
          .eq('event_id', event.id)
          .neq('status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(2000)
        fail(postsQuery.error)
        const presenceQuery = await supabase.from('presences').select('created_at').eq('event_id', event.id)
        fail(presenceQuery.error)
        const posts: AdminPost[] = []
        for (const row of (postsQuery.data || []) as Row[]) {
          const media = await mediaItems((row.post_media as Row[]) || [], true)
          posts.push(mapPost(row, media, true) as AdminPost)
        }
        const presences = ((presenceQuery.data || []) as { created_at: string }[]).map((row) => ({
          createdAt: row.created_at,
          day: dayOf(row.created_at),
          shift: shiftOf(row.created_at),
        }))
        return {
          event: toEvent(event),
          stats: buildStats(presences.map((item) => item.createdAt), posts),
          posts,
          presences,
          aiKeyConfigured: flag(event.ai_enabled),
          truncated: posts.length >= 2000,
        } satisfies AdminOverview
      },
      async moderate(slug, postId, action, note, forcePublic) {
        await requireUser()
        const current = await supabase.from('posts').select('audience, moderation_label, event_id').eq('id', postId).single()
        fail(current.error)
        if (action === 'approve') {
          const medias = await supabase.from('post_media').select('*').eq('post_id', postId)
          fail(medias.error)
          for (const media of (medias.data || []) as Row[]) {
            if (media.public_path || !media.storage_path) continue
            const dest = String(media.storage_path).replace(/^pending\//, 'approved/')
            // Cópia feita no próprio servidor (rápida, não gasta o 4G de quem aprova); se falhar, baixa e reenvia.
            const copied = await supabase.storage.from('ulisses-private').copy(String(media.storage_path), dest, { destinationBucket: 'ulisses-public' })
            if (copied.error && !/exists|duplicate/i.test(copied.error.message)) {
              const downloaded = await supabase.storage.from('ulisses-private').download(String(media.storage_path))
              if (downloaded.error || !downloaded.data) throw new ApiError(400, 'Não foi possível abrir a mídia para aprovar.')
              const uploaded = await supabase.storage.from('ulisses-public').upload(dest, downloaded.data, {
                contentType: String(media.mime || 'application/octet-stream'),
                upsert: true,
              })
              fail(uploaded.error, 'Não foi possível publicar a mídia.')
            }
            const saved = await supabase.from('post_media').update({ public_path: dest }).eq('id', media.id)
            fail(saved.error)
          }
        }
        const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'removed'
        const row = current.data as Row
        const keepPrivate =
          action === 'approve' &&
          !forcePublic &&
          (row.audience === 'admin' || row.moderation_label === 'personal_data' || row.moderation_label === 'criticism')
        const audience = keepPrivate ? 'admin' : action === 'approve' ? 'public' : row.audience
        const updated = await supabase
          .from('posts')
          .update({
            status,
            audience,
            reviewed_at: new Date().toISOString(),
            moderation_note: note || row.moderation_note || null,
          })
          .eq('id', postId)
        fail(updated.error)
        void slug
      },
      async updatePost(_slug, postId, patch) {
        await requireUser()
        const updated = await supabase
          .from('posts')
          .update({
            category: patch.category,
            comms_format: patch.commsFormat,
            suggested_caption: patch.suggestedCaption,
            is_highlight: patch.highlight,
          })
          .eq('id', postId)
        fail(updated.error)
      },
      async deletePost(_slug, postId) {
        await requireUser()
        const medias = await supabase.from('post_media').select('storage_path, public_path').eq('post_id', postId)
        const removed = await supabase.from('posts').delete().eq('id', postId)
        fail(removed.error)
        const privatePaths = ((medias.data || []) as Row[]).map((item) => String(item.storage_path || '')).filter(Boolean)
        const publicPaths = ((medias.data || []) as Row[]).map((item) => String(item.public_path || '')).filter(Boolean)
        if (privatePaths.length) await supabase.storage.from('ulisses-private').remove(privatePaths)
        if (publicPaths.length) await supabase.storage.from('ulisses-public').remove(publicPaths)
      },
      async updateEvent(slug, patch) {
        await requireUser()
        const map: Record<string, string> = {
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
          sceneDurationSeconds: 'scene_duration_seconds',
          retentionDays: 'retention_days',
          videoMaxSeconds: 'video_max_seconds',
          autoApproveCleanMessages: 'auto_approve_clean_messages',
          aiEnabled: 'ai_enabled',
        }
        const next: Row = {}
        for (const [key, column] of Object.entries(map)) {
          if (patch[key] !== undefined) next[column] = patch[key]
        }
        if (patch.goals) next.goals_json = patch.goals
        if (patch.colors) next.colors_json = patch.colors
        if (patch.scenes) next.scenes_json = patch.scenes
        if (patch.sceneDurationSeconds != null) next.tv_epoch = new Date().toISOString()
        const updated = await supabase.from('events').update(next).eq('slug', slug).select('*').single()
        fail(updated.error)
        return toEvent(updated.data as Row)
      },
      async createEvent(name) {
        await requireUser()
        const { data, error } = await supabase.rpc('create_event', { p_name: name })
        fail(error)
        const payload = data as { slug: string }
        return toEvent(await eventRow(payload.slug))
      },
      async setEmergency(slug, stop) {
        await requireUser()
        const updated = await supabase.from('events').update({ emergency_stop: stop }).eq('slug', slug)
        fail(updated.error)
      },
      async setMural(slug, enabled) {
        await requireUser()
        const updated = await supabase.from('events').update({ mural_enabled: enabled }).eq('slug', slug)
        fail(updated.error)
      },
      async setStatus(slug, status) {
        await requireUser()
        const updated = await supabase.from('events').update({ status }).eq('slug', slug)
        fail(updated.error)
      },
      async uploadLogo(slug, file, filename) {
        await requireUser()
        const event = await eventRow(slug)
        const ext = filename.split('.').pop()?.toLowerCase() || 'png'
        const objectPath = `branding/${event.id}.${ext}`
        const uploaded = await supabase.storage.from('ulisses-public').upload(objectPath, file, {
          upsert: true,
          contentType: file.type || 'image/png',
        })
        fail(uploaded.error, 'Não foi possível guardar a logomarca.')
        const updated = await supabase.from('events').update({ logo_path: objectPath }).eq('id', event.id)
        fail(updated.error)
      },
      async purgeDemo(slug) {
        await requireUser()
        const { error } = await supabase.rpc('purge_demo', { p_slug: slug })
        fail(error)
      },
      async seedDemo(slug) {
        await requireUser()
        const { error } = await supabase.rpc('seed_demo', { p_slug: slug })
        fail(error)
      },
      async applyRetention(slug) {
        await requireUser()
        const { data, error } = await supabase.rpc('apply_retention', { p_slug: slug })
        fail(error)
        return { removed: Number(data) || 0 }
      },
      async captions(input) {
        const templates = templateCaptions(input.eventName, input.authorName || null, input.body || null, input.handle)
        if (!input.useAi) {
          return {
            ai: false,
            captions: templates,
            message: 'Nenhum serviço de inteligência artificial está configurado. As sugestões são modelos prontos.',
          }
        }
        const invoked = await supabase.functions.invoke('moderate-text', {
          body: { kind: 'caption', text: input.body || input.eventName, author: input.authorName || '' },
        })
        const caption = (invoked.data as { caption?: string } | null)?.caption
        if (invoked.error || !caption) {
          return { ai: false, captions: templates, message: 'A IA não respondeu. Usamos modelos prontos.' }
        }
        return { ai: true, captions: [caption, ...templates], message: 'A primeira sugestão veio do serviço de IA configurado.' }
      },
    },
  }
}

function buildStats(presenceTimes: string[], posts: AdminPost[]): Stats {
  const hourCounts = new Map<number, number>()
  const shiftMap = new Map<string, number>()
  for (const iso of presenceTimes) {
    const hour = cuiabaParts(iso).hour
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    const key = `${dayOf(iso)}|${shiftOf(iso)}`
    shiftMap.set(key, (shiftMap.get(key) || 0) + 1)
  }
  const authors = new Set(posts.filter((post) => post.type !== 'reaction').map((post) => post.visitorId))
  const presences = presenceTimes.length
  return {
    presences,
    messages: posts.filter((post) => post.type === 'message').length,
    messagesApproved: posts.filter((post) => post.type === 'message' && post.status === 'approved').length,
    photos: posts.filter((post) => post.type === 'photo').length,
    videos: posts.filter((post) => post.type === 'video').length,
    reactions: posts.filter((post) => post.type === 'reaction').length,
    pending: posts.filter((post) => post.status === 'pending').length,
    rejected: posts.filter((post) => post.status === 'rejected').length,
    removed: posts.filter((post) => post.status === 'removed').length,
    highlights: posts.filter((post) => post.highlight).length,
    engagementRate: presences === 0 ? 0 : Math.round((authors.size / presences) * 1000) / 10,
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourCounts.get(hour) || 0 })),
    byDayShift: [...shiftMap.entries()]
      .map(([key, count]) => {
        const [day, shift] = key.split('|')
        return { day, shift, count }
      })
      .sort((a, b) => a.day.localeCompare(b.day)),
  }
}
