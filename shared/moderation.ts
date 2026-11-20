import { EMOJIS, type AllowedEmoji } from './constants.ts'
import type { ModerationResult, PostType } from './types.ts'

/**
 * Classificador de regras em português, no servidor.
 * Não é inteligência artificial: é léxico, normalização e pontuação.
 * Mensagem claramente positiva e limpa é publicada.
 * Ofensa é recusada. Crítica fica só na equipe. Neutro espera uma pessoa.
 * Foto e vídeo nunca são publicados aqui.
 */

const RULE = 'Classificação automática por regras (não é inteligência artificial)'

const BLOCKED: Record<string, string[]> = {
  'palavrão': [
    'porra', 'poha', 'caralho', 'carai', 'cacete', 'krl', 'crl', 'pqp', 'vsf', 'vtnc', 'tnc', 'fdp',
    'merda', 'bosta', 'cu', 'foda', 'foder', 'fodas', 'fodase', 'fodase', 'fuder', 'fudido', 'fudida',
  ],
  'ofensa': [
    'arrombado', 'arrombada', 'otario', 'otaria', 'idiota', 'imbecil', 'babaca', 'desgracado', 'desgracada',
    'nojento', 'nojenta', 'vagabundo', 'vagabunda', 'retardado', 'retardada',
  ],
  'conteúdo sexual': [
    'buceta', 'boceta', 'puta', 'puto', 'putaria', 'vadia', 'pornografia', 'porno', 'porn', 'nudes',
    'punheta', 'boquete', 'xoxota', 'xereca', 'piroca', 'onlyfans', 'peladao', 'gostosa', 'gostoso',
  ],
  'violência': ['estupro', 'estuprar', 'pedofil', 'pedofilia', 'te matar', 'vou matar', 'matar voce', 'te quebrar'],
  'discriminação': ['nazista', 'nazi', 'viado', 'viada', 'bicha', 'baitola', 'seu macaco', 'sua macaca'],
}

const BLOCKED_PHRASES = [
  'vai se foder', 'vai se ferrar', 'tomar no cu', 'filho da puta', 'filha da puta',
  'cala a boca', 'seu burro', 'sua burra', 'seus burros', 'suas burras', 'seu idiota',
  'seu lixo', 'sua piranha', 'seu puto', 'sua puta',
]

const CRITICISM = [
  'nao gostei', 'nao recomendo', 'poderia melhorar', 'precisa melhorar', 'faltou organiz',
  'mal organizado', 'desorganizado', 'desorganizada', 'reclamacao', 'reclamar', 'decepcion',
  'muito ruim', 'que absurdo', 'indignado', 'indignada', 'pior evento', 'pessima organizacao',
  'nao estava bom', 'fila enorme', 'fila grande', 'demorou demais', 'falta de organizacao',
  'ponto a melhorar', 'sugestao de melhoria', 'pouca organizacao',
]

const NEGATIVE = [
  'pessimo', 'pessima', 'horrivel', 'odiei', 'odeio', 'chato', 'chata', 'triste', 'fracasso',
  'vergonha', 'detestei', 'nao presta', 'uma droga', 'muito ruim', 'ridiculo', 'ridicula',
]

const SENSITIVE = [
  'sexo', 'sexual', 'nudez', 'pelado', 'pelada', 'sexy', 'droga', 'drogas', 'violencia',
  'suicidio', 'suicidar', 'matar', 'morte', 'arma', 'armas', 'sangue', 'odio', 'racismo',
  'machismo', 'homofobia', 'bullying', 'preconceito',
]

const SPAM = [
  'ganhe dinheiro', 'clique aqui', 'siga meu', 'siga o meu', 'cassino', 'apostas', 'aposta gratis',
  'pix de', 'compre agora', 'whatsapp', 'onlyfans', 'promoção relâmpago', 'promocao relampago',
]

const POSITIVE_STRONG = [
  'parabens', 'orgulho', 'orgulh', 'lindo', 'linda', 'lindos', 'lindas', 'incrivel', 'incriveis',
  'amei', 'adorei', 'maravilh', 'excelente', 'otimo', 'otima', 'inspir', 'arrasou', 'sensacional',
  'perfeito', 'perfeita', 'gratidao', 'obrigado', 'obrigada', 'emocion', 'brilhant', 'espetac',
  'fantast', 'talentos', 'talentoso', 'talentosa', 'sucesso', 'feliz', 'alegria', 'amado', 'amada',
]

const POSITIVE_SHORT = ['top', 'show', 'bacana', 'joia', 'massa', 'dahora', 'daora']

const POSITIVE_PHRASES = [
  'muito bom', 'muito boa', 'muito legal', 'que bom', 'que lindo', 'que linda', 'ficou lindo',
  'ficou linda', 'nota 10', 'sao demais', 'e demais', 'show de bola', 'trabalho lindo',
  'feira linda', 'amei a feira', 'adorei a feira',
]

const INSULT_CONTEXT = [
  'seu burro', 'sua burra', 'voce e burro', 'voce e burra', 'voces sao burros', 'que burro', 'que burra',
]

function result(
  label: ModerationResult['label'],
  status: ModerationResult['status'],
  audience: ModerationResult['audience'],
  reason: string,
  sentiment: ModerationResult['sentiment'],
): ModerationResult {
  return {
    label,
    status,
    audience,
    note: `${RULE}: ${reason}`,
    aiUsed: false,
    sentiment,
  }
}

export function fold(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/\$/g, 's')
    .replace(/ph/g, 'f')
  return base.replace(/\d/g, (digit, offset) => {
    const prev = base[offset - 1] || ''
    const next = base[offset + 1] || ''
    if (!/[a-z]/.test(prev) && !/[a-z]/.test(next)) return digit
    const map: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' }
    return map[digit] || ''
  })
}

export function squeeze(input: string): string {
  return input.replace(/(.)\1+/gu, '$1')
}

/** Junta letras soltas (p o r r a, p.o.r.r.a) e reduz repetição (pooorraaa). */
export function normalizeForModeration(input: string): string {
  const folded = fold(input)
    .replace(/([a-z])[|!](?=[a-z])/g, '$1i')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = folded.split(' ').filter(Boolean)
  const out: string[] = []
  let buf = ''
  const flush = () => {
    if (!buf) return
    const squeezed = squeeze(buf)
    const blocked = isBlockedToken(buf) || isBlockedToken(squeezed)
    if (buf.length >= 3 || blocked) out.push(buf)
    else out.push(...buf.split(''))
    buf = ''
  }
  for (const part of parts) {
    if (part.length === 1) buf += part
    else {
      flush()
      out.push(part)
    }
  }
  flush()
  return out.join(' ')
}

function tokensOf(text: string): string[] {
  return text.split(/[^a-z]+/).filter(Boolean)
}

function isBlockedToken(token: string): boolean {
  const squeezed = squeeze(token)
  for (const list of Object.values(BLOCKED)) {
    for (const term of list) {
      if (!term.includes(' ')) {
        if (token === term || squeezed === squeeze(term)) return true
      }
    }
  }
  return false
}

function findBlocked(normalized: string): string | null {
  const compact = squeeze(normalized.replace(/ /g, ''))
  for (const [kind, list] of Object.entries(BLOCKED)) {
    for (const term of list) {
      if (term.includes(' ')) {
        if (normalized.includes(term) || squeeze(normalized).includes(squeeze(term))) return kind
        continue
      }
      const body = `(^|[^a-z])${term}([^a-z]|$)`
      const squeezedBody = `(^|[^a-z])${squeeze(term)}([^a-z]|$)`
      if (new RegExp(body).test(normalized) || new RegExp(squeezedBody).test(squeeze(normalized))) return kind
      if (term.length >= 6 && (compact.includes(squeeze(term)) || normalized.replace(/ /g, '').includes(term))) return kind
    }
  }
  for (const phrase of BLOCKED_PHRASES) {
    if (normalized.includes(phrase) || squeeze(normalized).includes(squeeze(phrase))) {
      return phrase.includes('macac') ? 'discriminação' : 'ofensa'
    }
  }
  for (const phrase of INSULT_CONTEXT) {
    if (normalized.includes(phrase)) return 'ofensa'
  }
  return null
}

function hasPhrase(text: string, phrases: string[]): boolean {
  const squeezed = squeeze(text)
  return phrases.some((phrase) => text.includes(phrase) || squeezed.includes(squeeze(phrase)))
}

function hasStem(text: string, stems: string[]): boolean {
  const toks = tokensOf(text)
  const squeezed = toks.map(squeeze)
  return stems.some((stem) => {
    const prefix = stem.length > 3
    return toks.some((token) => token === stem || (prefix && token.startsWith(stem)))
      || squeezed.some((token) => token === squeeze(stem) || (prefix && token.startsWith(squeeze(stem))))
  })
}

function hasExact(text: string, words: string[]): boolean {
  const toks = new Set(tokensOf(text).map(squeeze))
  return words.some((word) => toks.has(squeeze(word)))
}

export function hasPersonalData(raw: string): boolean {
  const text = raw.replace(/\u00a0/g, ' ')
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return true
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text)) return true
  if (/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[-\s.]?\d{4}/.test(text)) return true
  if (/\b(?:\d[\s.-]*){10,11}\b/.test(text) && /9/.test(text)) return true
  return false
}

export function isAllowedEmoji(value: string): value is AllowedEmoji {
  return (EMOJIS as readonly string[]).includes(value)
}

export interface ModerateInput {
  type: PostType
  authorName?: string | null
  body?: string | null
  emoji?: string | null
  /** Quando false, mensagem positiva fica na fila em vez de ir ao painel. Padrão: publicar. */
  autoPublishPositive?: boolean
  aiEnabled?: boolean
}

export function moderateContent(input: ModerateInput): ModerationResult {
  if (input.type === 'reaction') {
    if (!input.emoji || !isAllowedEmoji(input.emoji) || (input.body && input.body.trim())) {
      return result('blocked', 'rejected', 'public', 'a reação precisa ser um emoji da lista oficial, sem texto.', null)
    }
    return result('emoji', 'approved', 'public', 'reação da lista oficial, sem texto livre. Publicada no painel.', 'positive')
  }

  const raw = `${input.authorName || ''} ${input.body || ''}`.trim()
  const readable = fold(raw).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const normalized = normalizeForModeration(raw)
  const blockedKind = findBlocked(normalized)
  let classified: ModerationResult

  if (blockedKind) {
    classified = result('blocked', 'rejected', 'public', `${blockedKind}. Não publicada no painel.`, 'negative')
  } else if (hasPersonalData(raw)) {
    classified = result('personal_data', 'pending', 'admin', 'possível telefone, e-mail ou CPF. Fica só na administração.', null)
  } else if (hasPhrase(normalized, SPAM) || hasPhrase(readable, SPAM) || (raw.match(/https?:\/\/|www\./gi) || []).length >= 1) {
    classified = result('spam', 'rejected', 'public', 'propaganda, link ou anúncio. Não publicada no painel.', 'negative')
  } else if (
    hasPhrase(normalized, CRITICISM) ||
    hasPhrase(readable, CRITICISM) ||
    (normalized.includes('fila') && hasStem(normalized, ['enorm', 'grande', 'demor', 'long', 'lotad'])) ||
    (hasStem(normalized, ['pessimo', 'horrivel', 'ridicul']) && !hasStem(normalized, POSITIVE_STRONG))
  ) {
    classified = result('criticism', 'pending', 'admin', 'crítica ou insatisfação. Encaminhada somente à equipe, sem ir ao painel.', 'negative')
  } else if (hasStem(normalized, SENSITIVE)) {
    classified = result('sensitive', 'pending', 'public', 'termo sensível para o ambiente escolar. Aguardando revisão humana.', null)
  } else {
    const shortBonus = hasExact(normalized, POSITIVE_SHORT) && tokensOf(normalized).length <= 6 ? 2 : 0
    const positive = (hasStem(normalized, POSITIVE_STRONG) ? 2 : 0) + (hasPhrase(readable, POSITIVE_PHRASES) ? 2 : 0) + shortBonus
    const negative = hasStem(normalized, NEGATIVE) || hasPhrase(normalized, NEGATIVE) ? 1 : 0
    if (positive >= 2 && negative === 0) {
      classified = result('positive', 'approved', 'public', 'mensagem positiva e sem termo proibido. Publicada no painel.', 'positive')
    } else if (negative > 0 && positive === 0) {
      classified = result('criticism', 'pending', 'admin', 'tom negativo. Encaminhada somente à equipe, sem ir ao painel.', 'negative')
    } else if (positive > 0 && negative > 0) {
      classified = result('neutral', 'pending', 'public', 'mistura de elogio e restrição. Aguardando revisão humana.', 'neutral')
    } else {
      classified = result('neutral', 'pending', 'public', 'texto neutro, sem elogio claro. Aguardando revisão humana.', 'neutral')
    }
  }

  const publish = input.autoPublishPositive !== false
  if (input.type === 'message' && classified.status === 'approved' && !publish) {
    classified = {
      ...classified,
      status: 'pending',
      note: `${classified.note} A escola desligou a publicação automática, então a mensagem espera a equipe.`,
    }
  }

  if (input.type === 'photo' || input.type === 'video') {
    if (classified.status === 'rejected' || classified.audience === 'admin') return classified
    const tone = classified.label === 'positive' ? 'A legenda foi classificada como positiva. ' : ''
    return {
      ...classified,
      label: 'media_review',
      status: 'pending',
      audience: 'public',
      note: `${RULE}: ${tone}fotografia ou vídeo aguarda revisão humana antes do painel, especialmente por poder envolver estudantes.`,
    }
  }

  return classified
}
