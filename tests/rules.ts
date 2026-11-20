import assert from 'node:assert/strict'
import { moderateContent } from '../shared/moderation.ts'
import type { ModerationResult } from '../shared/types.ts'

function judge(body: string, type: 'message' | 'photo' | 'video' = 'message', author = 'Ana'): ModerationResult {
  return moderateContent({ type, authorName: author, body, autoPublishPositive: true })
}

function expectStatus(body: string, status: ModerationResult['status'], label?: ModerationResult['label'], audience?: ModerationResult['audience']) {
  const got = judge(body)
  assert.equal(got.status, status, `${body} → status ${got.status}, esperado ${status}. ${got.note}`)
  if (label) assert.equal(got.label, label, `${body} → rótulo ${got.label}`)
  if (audience) assert.equal(got.audience, audience, `${body} → audiência ${got.audience}`)
  assert.equal(got.aiUsed, false)
  assert.match(got.note, /não é inteligência artificial/i)
}

const positive = [
  'A feira está linda! Orgulho da nossa escola.',
  'Parabéns aos estudantes, que trabalho incrível!',
  'Amei cada projeto. Vocês arrasaram!',
  'Que apresentação maravilhosa. Obrigado, Ulisses!',
  'Ficou excelente. Sucesso sempre!',
  'Estou muito feliz com a feira.',
  'Top!',
  'Show de bola os experimentos.',
  'Adorei a feira e os trabalhos.',
  'Que lindo ver a comunidade reunida.',
  'Inspirador. Um futuro brilhante para Campo Verde.',
  'Nota 10 para a turma de ciências.',
]

const swearing = [
  'que porra é essa',
  'p o r r a',
  'P.O.R.R.A!!!',
  'pooorraaa',
  'p0rr@',
  'p-o-r-r-a',
  'c a r a l h o',
  'm3rda',
  'f o d a',
  'v t n c',
  'vai se foder',
  'seu arrombado',
  'Que lindo, sua porra',
]

const offensive = [
  'Vocês são uns idiotas',
  'seu burro',
  'cala a boca',
  'seu lixo',
  'filho da puta',
  'que nojento',
]

const spam = [
  'Ganhe dinheiro agora clique aqui',
  'Apostas grátis no cassino',
  'Acesse https://exemplo.com e compre agora',
]

const criticism = [
  'Não gostei da organização da fila.',
  'Poderia melhorar o som do auditório.',
  'Faltou organização na entrada.',
  'Faltou organização na entrada, mas parabéns aos alunos.',
  'A fila estava enorme.',
]

const neutral = [
  'Estou na sala 3.',
  'Projeto de robótica.',
  'Ok',
  'Nosso projeto é sobre coleta de lixo na escola.',
  'O burro é o tema do projeto de ciências.',
]

const sensitive = [
  'Diga não ao racismo.',
  'Projeto sobre violência na escola.',
]

for (const text of positive) expectStatus(text, 'approved', 'positive', 'public')
for (const text of swearing) expectStatus(text, 'rejected', 'blocked', 'public')
for (const text of offensive) expectStatus(text, 'rejected', 'blocked', 'public')
for (const text of spam) expectStatus(text, 'rejected', 'spam')
for (const text of criticism) expectStatus(text, 'pending', 'criticism', 'admin')
for (const text of neutral) expectStatus(text, 'pending', 'neutral', 'public')
for (const text of sensitive) expectStatus(text, 'pending', 'sensitive', 'public')

expectStatus('Me chama em ana.silva@escola.br, amei', 'pending', 'personal_data', 'admin')
expectStatus('Meu zap é (65) 99999-8888', 'pending', 'personal_data', 'admin')
expectStatus('CPF 123.456.789-09', 'pending', 'personal_data', 'admin')

const paused = moderateContent({
  type: 'message',
  authorName: 'Ana',
  body: 'A feira está linda',
  autoPublishPositive: false,
})
assert.equal(paused.status, 'pending')
assert.equal(paused.label, 'positive')

const photo = judge('Experiência linda de ciências', 'photo')
assert.equal(photo.status, 'pending')
assert.equal(photo.label, 'media_review')
assert.match(photo.note, /revisão humana/i)

const badPhoto = judge('Isso é uma porra', 'photo')
assert.equal(badPhoto.status, 'rejected')

const reaction = moderateContent({ type: 'reaction', emoji: '👏' })
assert.equal(reaction.status, 'approved')
assert.equal(reaction.aiUsed, false)

const badName = moderateContent({ type: 'message', authorName: 'Porra', body: 'Amei a feira' })
assert.equal(badName.status, 'rejected')

console.log(`Classificador: ${positive.length} positivas, ${swearing.length} palavrões, ${offensive.length} ofensas, ${spam.length} spams, ${criticism.length} críticas, ${neutral.length} neutras. ok`)
