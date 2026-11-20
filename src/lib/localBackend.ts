import type { AdminOverview, CreatePostResult, PublicEvent, PublicPost, StreamEvent } from '../../shared/types.ts'
import { ApiError, type Backend, type PostDraft } from './backend.ts'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new ApiError(response.status, data.error || 'Não foi possível concluir agora.')
  return data as T
}

function draftBody(draft: PostDraft): FormData | string {
  if (draft.type === 'photo' || draft.type === 'video') {
    const form = new FormData()
    form.set('visitorId', draft.visitorId)
    form.set('type', draft.type)
    form.set('authorName', draft.authorName || '')
    form.set('body', draft.body || '')
    form.set('emoji', draft.emoji || '')
    form.set('imageConsent', draft.imageConsent ? 'true' : 'false')
    form.set('instagramConsent', draft.instagramConsent ? 'true' : 'false')
    form.set('website', draft.website || '')
    form.set('openedAt', String(draft.openedAt || 0))
    if (draft.durationSeconds) form.set('durationSeconds', String(draft.durationSeconds))
    for (const file of draft.files || []) form.append('files', file.blob, file.name)
    return form
  }
  return JSON.stringify({
    visitorId: draft.visitorId,
    type: draft.type,
    authorName: draft.authorName || '',
    body: draft.body || '',
    emoji: draft.emoji || '',
    imageConsent: draft.imageConsent ? 'true' : 'false',
    instagramConsent: draft.instagramConsent ? 'true' : 'false',
    website: draft.website || '',
    openedAt: draft.openedAt || 0,
  })
}

export function createLocalBackend(): Backend {
  return {
    mode: 'local',
    getEvent: (slug) => call<PublicEvent>(`/api/events/${encodeURIComponent(slug)}`),
    listEvents: () => call<PublicEvent[]>('/api/events'),
    registerPresence: (slug, visitorId) =>
      call(`/api/events/${encodeURIComponent(slug)}/presence`, { method: 'POST', body: JSON.stringify({ visitorId }) }),
    createPost: (slug, draft) =>
      call<CreatePostResult>(`/api/events/${encodeURIComponent(slug)}/posts`, {
        method: 'POST',
        body: draftBody(draft),
      }),
    deleteMine: async (slug, visitorId, scope) => {
      await call(`/api/events/${encodeURIComponent(slug)}/mine`, {
        method: 'POST',
        body: JSON.stringify({ visitorId, scope }),
      })
    },
    feed: async (slug) => {
      const data = await call<{ posts: PublicPost[] }>(`/api/events/${encodeURIComponent(slug)}/feed`)
      return data.posts
    },
    subscribe(slug, cb) {
      const source = new EventSource(`/api/events/${encodeURIComponent(slug)}/stream`)
      source.onopen = () => cb({ type: 'status', connected: true })
      source.onmessage = (message) => {
        try {
          cb(JSON.parse(message.data) as StreamEvent)
        } catch {
          /* ignora quadro inválido */
        }
      }
      source.onerror = () => cb({ type: 'status', connected: false })
      return () => source.close()
    },
    admin: {
      login: (email, password) =>
        call('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
      logout: async () => {
        await call('/api/admin/logout', { method: 'POST', body: '{}' })
      },
      me: () => call<{ email: string | null }>('/api/admin/me').then((data) => (data.email ? { email: data.email } : null)),
      overview: (slug) => call<AdminOverview>(`/api/admin/events/${encodeURIComponent(slug)}`),
      moderate: async (slug, postId, action, note, forcePublic) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/moderate`, {
          method: 'POST',
          body: JSON.stringify({ postId, action, note, forcePublic: Boolean(forcePublic) }),
        })
      },
      updatePost: async (slug, postId, patch) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/posts/${postId}`, {
          method: 'POST',
          body: JSON.stringify(patch),
        })
      },
      deletePost: async (slug, postId) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/posts/${postId}`, { method: 'DELETE' })
      },
      updateEvent: (slug, patch) =>
        call(`/api/admin/events/${encodeURIComponent(slug)}/settings`, { method: 'POST', body: JSON.stringify(patch) }),
      createEvent: (name) => call('/api/admin/events', { method: 'POST', body: JSON.stringify({ name }) }),
      setEmergency: async (slug, stop) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/emergency`, {
          method: 'POST',
          body: JSON.stringify({ stop }),
        })
      },
      setMural: async (slug, enabled) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/mural`, {
          method: 'POST',
          body: JSON.stringify({ enabled }),
        })
      },
      setStatus: async (slug, status) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/status`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        })
      },
      uploadLogo: async (slug, file, filename) => {
        const form = new FormData()
        form.append('files', file, filename)
        await call(`/api/admin/events/${encodeURIComponent(slug)}/logo`, { method: 'POST', body: form })
      },
      purgeDemo: async (slug) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/purge-demo`, { method: 'POST', body: '{}' })
      },
      seedDemo: async (slug) => {
        await call(`/api/admin/events/${encodeURIComponent(slug)}/seed-demo`, { method: 'POST', body: '{}' })
      },
      applyRetention: (slug) =>
        call(`/api/admin/events/${encodeURIComponent(slug)}/retention`, { method: 'POST', body: '{}' }),
      captions: (input) => call('/api/admin/captions', { method: 'POST', body: JSON.stringify(input) }),
    },
  }
}
