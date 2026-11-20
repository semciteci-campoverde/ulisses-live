export type EventStatus = 'draft' | 'live' | 'ended'
export type PostType = 'message' | 'photo' | 'video' | 'reaction'
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'removed'
export type Audience = 'public' | 'admin'
export type ModerationLabel =
  | 'clean'
  | 'positive'
  | 'neutral'
  | 'blocked'
  | 'criticism'
  | 'personal_data'
  | 'spam'
  | 'sensitive'
  | 'media_review'
  | 'emoji'

export interface EventColors {
  navy: string
  royal: string
  gold: string
  ink: string
}

export interface SceneFlags {
  messages: boolean
  photos: boolean
  videos: boolean
  counter: boolean
  invite: boolean
  instagram: boolean
}

export interface PublicEvent {
  id: string
  slug: string
  name: string
  institution: string
  municipality: string
  state: string
  theme: string
  slogan: string
  description: string
  internalDate: string
  publicDate: string
  publicHours: string
  instagramHandle: string
  instagramUrl: string
  status: EventStatus
  isDemo: boolean
  logoUrl: string
  sceneDurationSeconds: number
  goals: number[]
  emergencyStop: boolean
  muralEnabled: boolean
  videoMaxSeconds: number
  videoMaxBytes: number
  photoMaxCount: number
  messageMaxChars: number
  presenceCount: number
  feedVersion: number
  colors: EventColors
  scenes: SceneFlags
  welcomeText: string
  celebratedGoals: number[]
  celebrationGoal: number | null
  celebrationUntil: string | null
  tvEpoch: string
  retentionDays: number
  aiConfigured: boolean
  autoApproveCleanMessages: boolean
  aiEnabled: boolean
  serverTime: string
}

export interface MediaItem {
  id: string
  url: string
  mime: string
  bytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
  sortOrder: number
}

export interface PublicPost {
  id: string
  type: PostType
  authorName: string | null
  body: string | null
  emoji: string | null
  createdAt: string
  highlight: boolean
  media: MediaItem[]
}

export interface AdminPost extends PublicPost {
  status: PostStatus
  visitorId: string
  moderationNote: string | null
  moderationLabel: string | null
  audience: Audience
  aiUsed: boolean
  sentiment: string | null
  instagramConsent: boolean
  imageConsent: boolean
  category: string | null
  commsFormat: string | null
  suggestedCaption: string | null
}

export interface Stats {
  presences: number
  messages: number
  messagesApproved: number
  photos: number
  videos: number
  reactions: number
  pending: number
  rejected: number
  removed: number
  highlights: number
  engagementRate: number
  byHour: { hour: number; count: number }[]
  byDayShift: { day: string; shift: string; count: number }[]
}

export interface PresenceExport {
  createdAt: string
  day: string
  shift: string
}

export interface AdminOverview {
  event: PublicEvent
  stats: Stats
  posts: AdminPost[]
  presences: PresenceExport[]
  aiKeyConfigured: boolean
  truncated: boolean
}

export interface ModerationResult {
  label: ModerationLabel
  status: PostStatus
  audience: Audience
  note: string
  aiUsed: boolean
  sentiment: string | null
}

export interface CreatePostResult {
  postId: string
  moderation: ModerationResult
}

export type StreamEvent =
  | { type: 'hello'; serverTime: string }
  | { type: 'refresh'; reason: string }
  | { type: 'status'; connected: boolean }
  | { type: 'celebration'; goal: number; total: number; until: string }
