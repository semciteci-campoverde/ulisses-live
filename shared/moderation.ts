import { EMOJIS, type AllowedEmoji } from './constants.ts'
import type { ModerationResult, PostType } from './types.ts'

/** Termos explícitos incompatíveis com o painel escolar. Correspondência por palavra inteira. */
const BLOCKED = [
  'porra', 'caralho', 'cacete', 'foder', 'fodas', 'fodase', 'foda', 'fdp',
  'merda', 'bosta', 'buceta', 'boceta', 'puta', 'puto', 'putaria',
  'arrombado', 'arrombada', 'viado', 'viada', 'bicha', 'baitola',
  'retardado', 'retardada', 'vagabundo', 'vagabunda', 'otario', 'otaria',
  'vsf', 'vtnc', 'tnc', 'pqp', 'krl',
  'nazista', 'nazi',
  'estupro', 'estuprar', 'pedofil', 'pedofilia', 'pornografia', 'porno', 'porn',
  'punheta', 'boquete', 'xoxota', 'xereca', 'piroca', 'nudes',
  'onlyfans',
]

/** Críticas à organização: ficam só na administração, mesmo quando educadas. */
const CRITICISM = [
  'nao gostei',
  'nao recomendo',
  'pessimo',
  'pessima',
  'horrivel',
  'decepcion',
  'reclamacao',
  'reclamar',
  'reclame',
  'fracasso',
  'vergonha',
  'mal organizado',
  'desorganizado',
  'desorganizada',
  'muito ruim',
  'que absurdo',
  'indignado',
  'indignada',
  'pior evento',
  'pessima organizacao',
]

/** Termos sensíveis: não vão ao ar sozinhos; uma pessoa decide. */
const SENSITIVE = [
  'sexo', 'sexual', 'nudez', 'pelado', 'pelada', 'sexy',
  'droga', 'drogas', 'violencia', 'suicidio', 'suicidar',
  'matar', 'morte', 'arma', 'armas', 'sangue', 'odio',
  'racismo', 'machismo', 'homofobia', 'bullying', 'preconceito',
]

const SPAM_PHRASES = [
  'ganhe dinheiro',
  'clique aqui',
  'siga meu',
  'siga o meu',
  'cassino',
  'apostas',
  'aposta gratis',
  'pix de',
  'compre agora',
  'whatsapp',
]

const RULE_NOTE = 'Filtro de regras da escola. Isto não é inteligência artificial.'

export function fold(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
}

function tokens(folded: string): string[] {
  return folded.split(/[^a-z]+/).filter(Boolean)
}

function hasToken(folded: string, term: string): boolean {
  if (term.includes(' ')) return folded.includes(term)
  return tokens(folded).includes(term)
}

function findTerm(folded: string, list: string[]): string | null {
  for (const term of list) {
    if (hasToken(folded, term)) return term
  }
  return null
}

export function hasPersonalData(raw: string): boolean {
  const text = raw.replace(/\u00a0/g, ' ')
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return true
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text)) return true
  if (/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[-\s]?\d{4}/.test(text)) return true
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
  autoApproveClean?: boolean
  aiEnabled?: boolean
}

/**
 * Classifica texto e mídia sem simular IA.
 * Fotos e vídeos nunca são aprovados aqui.
 * Mensagens limpas ficam pendentes, salvo se a escola ligou o filtro automático
 * e a IA não está habilitada.
 */
export function moderateContent(input: ModerateInput): ModerationResult {
  if (input.type === 'reaction') {
    if (!input.emoji || !isAllowedEmoji(input.emoji) || (input.body && input.body.trim())) {
      return {
        label: 'blocked',
        status: 'rejected',
        audience: 'public',
        note: `${RULE_NOTE} A reação precisa ser um emoji da lista oficial, sem texto.`,
        aiUsed: false,
        sentiment: null,
      }
    }
    return {
      label: 'emoji',
      status: 'approved',
      audience: 'public',
      note: 'Reação da lista oficial, sem texto livre. Publicada direto no painel.',
      aiUsed: false,
      sentiment: 'positive',
    }
  }

  const raw = `${input.authorName || ''} ${input.body || ''}`.trim()
  const folded = fold(raw)
  let result: ModerationResult = {
    label: 'clean',
    status: 'pending',
    audience: 'public',
    note: `${RULE_NOTE} Nenhum termo bloqueado. Aguardando aprovação humana.`,
    aiUsed: false,
    sentiment: null,
  }

  if (findTerm(folded, BLOCKED)) {
    result = {
      label: 'blocked',
      status: 'rejected',
      audience: 'public',
      note: `${RULE_NOTE} Termo incompatível com o ambiente escolar. Não publicado.`,
      aiUsed: false,
      sentiment: 'negative',
    }
  } else if (hasPersonalData(raw)) {
    result = {
      label: 'personal_data',
      status: 'pending',
      audience: 'admin',
      note: `${RULE_NOTE} Possível telefone, e-mail ou CPF. Visível só na administração.`,
      aiUsed: false,
      sentiment: null,
    }
  } else if (/(.)\1{11,}/u.test(raw) || (raw.match(/https?:\/\/|www\./gi) || []).length >= 1 || findTerm(folded, SPAM_PHRASES)) {
    result = {
      label: 'spam',
      status: 'pending',
      audience: 'admin',
      note: `${RULE_NOTE} Possível propaganda ou repetição. Visível só na administração.`,
      aiUsed: false,
      sentiment: null,
    }
  } else if (findTerm(folded, CRITICISM)) {
    result = {
      label: 'criticism',
      status: 'pending',
      audience: 'admin',
      note: `${RULE_NOTE} Possível crítica. Encaminhada somente à administração, sem ir ao painel.`,
      aiUsed: false,
      sentiment: 'negative',
    }
  } else if (findTerm(folded, SENSITIVE)) {
    result = {
      label: 'sensitive',
      status: 'pending',
      audience: 'public',
      note: `${RULE_NOTE} Termo sensível para o ambiente escolar. Aguardando revisão humana.`,
      aiUsed: false,
      sentiment: null,
    }
  }

  const isMedia = input.type === 'photo' || input.type === 'video'
  if (isMedia) {
    if (result.status === 'rejected' || result.audience === 'admin') return result
    return {
      ...result,
      label: result.label === 'clean' ? 'media_review' : result.label,
      status: 'pending',
      audience: 'public',
      note:
        result.label === 'clean'
          ? 'Fotografia ou vídeo aguarda revisão humana antes de aparecer no painel, especialmente por poder envolver estudantes. Não é inteligência artificial.'
          : result.note,
    }
  }

  if (
    input.type === 'message' &&
    result.label === 'clean' &&
    input.autoApproveClean &&
    !input.aiEnabled
  ) {
    return {
      ...result,
      status: 'approved',
      note: 'Aprovado pelo filtro de regras (lista de termos), conforme configuração da escola. Isto não é inteligência artificial e não entende ironia.',
    }
  }

  return result
}
