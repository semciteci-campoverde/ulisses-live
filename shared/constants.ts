export const DEFAULT_SLUG = 'feira-2026'
export const DEMO_SLUG = 'feira-2026-demo'

export const EMOJIS = ['👏', '❤️', '😍', '🚀', '🤩', '🙌', '💡', '🎉', '👍'] as const
export type AllowedEmoji = (typeof EMOJIS)[number]

export const DEFAULT_COLORS = {
  navy: '#071433',
  royal: '#1347e6',
  gold: '#f0c14d',
  ink: '#f7f4ea',
}

export const DEFAULT_SCENES = {
  messages: true,
  photos: true,
  videos: true,
  counter: true,
  invite: true,
  instagram: true,
}

export const DEFAULT_GOALS = [50, 100, 200, 300, 500, 1000]

export const LIMITS = {
  messageMax: 200,
  nameMin: 2,
  nameMax: 40,
  photosPerPost: 5,
  photoBytes: 5 * 1024 * 1024,
  videoBytes: 26 * 1024 * 1024,
  videoSeconds: 15,
  contentPer10Min: 8,
  contentPerDay: 30,
  reactionsPer10Min: 30,
  minOpenMs: 800,
}

export const REAL_EVENT = {
  slug: DEFAULT_SLUG,
  name: 'Feira do Conhecimento 2026',
  institution: 'Escola Estadual Cívico-Militar Ulisses Guimarães',
  municipality: 'Campo Verde',
  state: 'MT',
  theme: 'Ideias que transformam o presente e constroem o futuro!',
  slogan: 'Sua presença. Seu olhar. Nossa história.',
  description:
    'A EECM Ulisses Guimarães convida toda a comunidade, pais, responsáveis e a população em geral para prestigiar os trabalhos dos estudantes na Feira do Conhecimento 2026.',
  internalDate: '2026-11-24',
  publicDate: '2026-11-25',
  publicHours: 'Das 9h às 11h e das 15h às 17h',
  instagramHandle: '@e.e.c.m.ulissesguimaraes',
  instagramUrl: 'https://www.instagram.com/e.e.c.m.ulissesguimaraes/',
  welcomeText: 'Presença confirmada! Você faz parte desta história.',
}

export const INSTAGRAM_BLURB =
  'Conecte-se com a nossa escola! Acompanhe nossos projetos, atividades, conquistas e eventos. Confira também os melhores momentos da Feira do Conhecimento em nosso Instagram.'
