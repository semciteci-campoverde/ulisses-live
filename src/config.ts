// Endereço e chave PÚBLICA do Supabase. A chave pública (anon/publishable) foi feita para ficar no site:
// tudo o que ela permite está limitado pelas regras de segurança do banco (supabase/migrations).
// Nunca coloque aqui a chave secreta (service_role / sb_secret_...).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const APP_NAME = 'ULISSES LIVE'
export const APP_TAGLINE = 'Presença, Interação e Memória Digital'
export const APP_SLOGAN = 'Sua presença. Seu olhar. Nossa história.'

export const REACTION_EMOJIS = ['👏', '❤️', '😍', '🚀', '🤩', '🙌', '💡', '🎉', '👍'] as const
export const MESSAGE_EMOJIS = ['👏', '❤️', '😍', '🚀', '🤩', '🙌', '💡', '🎉', '👍', '🔬', '📚', '🌱', '🌎', '⭐', '🏆', '✨'] as const

export const LIMITS = {
  messageChars: 200,
  nameChars: 40,
  photosPerPost: 5,
  videoSeconds: 15,
  videoBytes: 25 * 1024 * 1024,
  imageMaxSide: 1600,
}

export const TIMEZONE = 'America/Cuiaba'
