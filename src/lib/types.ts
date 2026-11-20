export type SceneKey = 'messages' | 'photos' | 'videos' | 'counter' | 'invite' | 'qr' | 'instagram'

export interface EventSettings {
  auto_approve_messages?: boolean
  paused?: boolean
  emergency?: boolean
  goals?: number[]
  scenes?: Partial<Record<SceneKey, number>>
  thank_you?: string
  memories_public?: boolean
  retention_days?: number
  logo_url?: string
  colors?: { primary?: string; secondary?: string; accent?: string }
}

export interface EventRow {
  id: string
  slug: string
  name: string
  institution: string
  city: string
  theme: string
  schedule: string
  instagram_handle: string
  instagram_url: string
  status: 'draft' | 'active' | 'closed'
  is_demo: boolean
  is_default: boolean
  settings: EventSettings
  created_at: string
}

export interface EventStats {
  event_id: string
  presences: number
  messages: number
  photos: number
  videos: number
  reactions: number
  last_reaction_emoji: string
  last_reaction_at: string | null
  last_post_at: string | null
  posts_rev: number
  updated_at: string
}

export interface MediaItem {
  path: string
  type: 'image' | 'video'
  w?: number
  h?: number
  duration?: number
  poster?: string
}

export type PostKind = 'message' | 'photo' | 'video' | 'feedback'
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'feedback' | 'removed'

export interface Post {
  id: string
  event_id: string
  kind: PostKind
  author_name: string
  body: string
  emoji: string
  media: MediaItem[]
  status: PostStatus
  flags: string[]
  featured: boolean
  consent_image: boolean
  consent_instagram: boolean
  created_at: string
  reviewed_at: string | null
}

export interface AdminReport {
  presences: number
  posts_total: number
  messages_total: number
  messages_approved: number
  photos_total: number
  photos_approved: number
  videos_total: number
  videos_approved: number
  reactions: number
  pending: number
  rejected: number
  feedback: number
  engaged_visitors: number
  by_hour: { hour: string; presences: number }[]
  by_shift: { day: string; shift: string; presences: number }[]
}
