import type { AdminOverview, CreatePostResult, PublicEvent, PublicPost, StreamEvent } from '../../shared/types.ts'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface PostDraft {
  visitorId: string
  type: 'message' | 'photo' | 'video' | 'reaction'
  authorName?: string
  body?: string
  emoji?: string
  imageConsent?: boolean
  instagramConsent?: boolean
  website?: string
  openedAt?: number
  durationSeconds?: number
  files?: { blob: Blob; name: string }[]
  /** Progresso do envio dos arquivos (0 a 1). */
  onProgress?: (fraction: number) => void
}

export interface Backend {
  mode: 'local' | 'supabase'
  getEvent(slug: string): Promise<PublicEvent>
  listEvents(): Promise<PublicEvent[]>
  registerPresence(slug: string, visitorId: string): Promise<{ already: boolean; total: number }>
  createPost(slug: string, draft: PostDraft): Promise<CreatePostResult>
  deleteMine(slug: string, visitorId: string, scope: 'content' | 'presence' | 'all'): Promise<void>
  feed(slug: string): Promise<PublicPost[]>
  subscribe(slug: string, cb: (event: StreamEvent) => void): () => void
  admin: {
    login(email: string, password: string): Promise<{ email: string }>
    logout(): Promise<void>
    me(): Promise<{ email: string } | null>
    overview(slug: string): Promise<AdminOverview>
    moderate(slug: string, postId: string, action: 'approve' | 'reject' | 'remove', note?: string, forcePublic?: boolean): Promise<void>
    updatePost(slug: string, postId: string, patch: { category?: string; commsFormat?: string; suggestedCaption?: string; highlight?: boolean }): Promise<void>
    deletePost(slug: string, postId: string): Promise<void>
    updateEvent(slug: string, patch: Record<string, unknown>): Promise<PublicEvent>
    createEvent(name: string): Promise<PublicEvent>
    setEmergency(slug: string, stop: boolean): Promise<void>
    setMural(slug: string, enabled: boolean): Promise<void>
    setStatus(slug: string, status: 'draft' | 'live' | 'ended'): Promise<void>
    uploadLogo(slug: string, file: Blob, filename: string): Promise<void>
    purgeDemo(slug: string): Promise<void>
    seedDemo(slug: string): Promise<void>
    applyRetention(slug: string): Promise<{ removed: number }>
    captions(input: { eventName: string; authorName?: string | null; body?: string | null; handle: string; useAi: boolean }): Promise<{ ai: boolean; captions: string[]; message: string }>
  }
}
