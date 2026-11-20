import { LIMITS } from './constants.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isVisitorId(value: string): boolean {
  return UUID_RE.test(value)
}

export function cleanName(input: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = input.normalize('NFKC').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim()
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    return { ok: false, error: 'Informe um nome de exibição com 2 a 40 caracteres.' }
  }
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) {
    return { ok: false, error: 'No nome de exibição, use letras. Não use números nem contatos.' }
  }
  return { ok: true, name }
}

export function cleanBody(input: string, max: number): { ok: true; body: string } | { ok: false; error: string } {
  const body = input
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!body) return { ok: false, error: 'Escreva uma mensagem.' }
  if (body.length > max) return { ok: false, error: `A mensagem pode ter no máximo ${max} caracteres.` }
  return { ok: true, body }
}

export function cleanCaption(input: string, max: number): { ok: true; body: string } | { ok: false; error: string } {
  const body = input
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (body.length > max) return { ok: false, error: `A legenda pode ter no máximo ${max} caracteres.` }
  return { ok: true, body }
}

export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'evento'
}

export function cuiabaParts(iso: string): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((part) => [part.type, part.value]))
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  }
}

export function shiftOf(iso: string): 'manhã' | 'tarde' | 'noite' {
  const hour = cuiabaParts(iso).hour
  if (hour >= 5 && hour < 12) return 'manhã'
  if (hour >= 12 && hour < 18) return 'tarde'
  return 'noite'
}

export function dayOf(iso: string): string {
  return cuiabaParts(iso).day
}

export function templateCaptions(eventName: string, author: string | null, body: string | null, handle: string): string[] {
  const credit = author ? ` — ${author}` : ''
  const text = body?.trim()
  const tag = handle.replace(/^@/, '')
  return [
    `${text ? `${text} ` : ''}Um registro da ${eventName}.${credit} #FeiraDoConhecimento #UlissesGuimaraes #CampoVerde`,
    `Ideias que transformam o presente e constroem o futuro. ${text || 'Orgulho da nossa comunidade escolar.'}${credit}`,
    `Melhores momentos da nossa feira.${credit} Acompanhe @${tag}`,
  ]
}

export function safeHex(input: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(input) ? input : fallback
}
