import { DEFAULT_COLORS, DEFAULT_GOALS, DEFAULT_SCENES } from './constants.ts'
import type { EventColors, PublicEvent, SceneFlags } from './types.ts'

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  if (value && typeof value === 'object') return value as T
  return fallback
}

export function mapEventRow(
  row: Record<string, unknown>,
  opts: { serverTime: string; aiConfigured: boolean; logoUrl: string },
): PublicEvent {
  const colors = parseJson<Partial<EventColors>>(row.colors_json, {})
  const scenes = parseJson<Partial<SceneFlags>>(row.scenes_json, {})
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    institution: String(row.institution),
    municipality: String(row.municipality),
    state: String(row.state),
    theme: String(row.theme),
    slogan: String(row.slogan),
    description: String(row.description),
    internalDate: String(row.internal_date).slice(0, 10),
    publicDate: String(row.public_date).slice(0, 10),
    publicHours: String(row.public_hours),
    instagramHandle: String(row.instagram_handle),
    instagramUrl: String(row.instagram_url),
    status: (row.status as PublicEvent['status']) || 'draft',
    isDemo: flag(row.is_demo),
    logoUrl: opts.logoUrl,
    sceneDurationSeconds: Number(row.scene_duration_seconds) || 12,
    goals: parseJson<number[]>(row.goals_json, DEFAULT_GOALS),
    emergencyStop: flag(row.emergency_stop),
    muralEnabled: flag(row.mural_enabled),
    videoMaxSeconds: Number(row.video_max_seconds) || 15,
    videoMaxBytes: Number(row.video_max_bytes) || 26 * 1024 * 1024,
    photoMaxCount: Number(row.photo_max_count) || 5,
    messageMaxChars: Number(row.message_max_chars) || 200,
    presenceCount: Number(row.presence_count) || 0,
    feedVersion: Number(row.feed_version) || 0,
    colors: {
      navy: colors.navy || DEFAULT_COLORS.navy,
      royal: colors.royal || DEFAULT_COLORS.royal,
      gold: colors.gold || DEFAULT_COLORS.gold,
      ink: colors.ink || DEFAULT_COLORS.ink,
    },
    scenes: { ...DEFAULT_SCENES, ...scenes },
    welcomeText: String(row.welcome_text || ''),
    celebratedGoals: parseJson<number[]>(row.celebrated_goals_json, []),
    celebrationGoal: row.celebration_goal == null ? null : Number(row.celebration_goal),
    celebrationUntil: row.celebration_until ? String(row.celebration_until) : null,
    tvEpoch: String(row.tv_epoch),
    retentionDays: Number(row.retention_days) || 365,
    aiConfigured: opts.aiConfigured,
    autoApproveCleanMessages: flag(row.auto_approve_clean_messages),
    aiEnabled: flag(row.ai_enabled),
    serverTime: opts.serverTime,
  }
}
