import assert from 'node:assert/strict'
import { moderateContent } from '../shared/moderation.ts'

function status(body: string, type: 'message' | 'photo' | 'video' | 'reaction' = 'message', extra: { auto?: boolean; emoji?: string } = {}) {
  return moderateContent({
    type,
    authorName: 'Ana',
    body,
    emoji: extra.emoji,
    autoApproveClean: extra.auto,
    aiEnabled: false,
  })
}

const clean = status('A feira está linda. Parabéns aos estudantes!')
assert.equal(clean.status, 'pending')
assert.equal(clean.label, 'clean')
assert.equal(clean.aiUsed, false)
assert.match(clean.note, /não é inteligência artificial/i)

const approvedByRule = status('Que orgulho da nossa escola!', 'message', { auto: true })
assert.equal(approvedByRule.status, 'approved')
assert.match(approvedByRule.note, /não é inteligência artificial/i)

const blocked = status('Que merda de organização')
assert.equal(blocked.status, 'rejected')
assert.equal(blocked.label, 'blocked')

const criticism = status('Não gostei da organização do pátio')
assert.equal(criticism.audience, 'admin')
assert.equal(criticism.label, 'criticism')
assert.notEqual(criticism.status, 'approved')

const lixo = status('Nosso projeto é sobre coleta de lixo na escola')
assert.equal(lixo.label, 'clean')
assert.equal(lixo.audience, 'public')

const racismo = status('Diga não ao racismo')
assert.equal(racismo.label, 'sensitive')
assert.equal(racismo.status, 'pending')

const email = status('Me chama em ana.silva@escola.br')
assert.equal(email.label, 'personal_data')
assert.equal(email.audience, 'admin')

const phone = status('Meu zap é 65999998888')
assert.equal(phone.label, 'personal_data')

const photo = status('Experiência de ciências muito legal', 'photo')
assert.equal(photo.status, 'pending')
assert.equal(photo.label, 'media_review')
assert.match(photo.note, /revisão humana/i)

const badPhoto = status('Isso é um porra', 'photo')
assert.equal(badPhoto.status, 'rejected')

const reaction = moderateContent({ type: 'reaction', emoji: '👏' })
assert.equal(reaction.status, 'approved')
assert.equal(reaction.label, 'emoji')

const badReaction = moderateContent({ type: 'reaction', emoji: '💀', body: 'oi' })
assert.equal(badReaction.status, 'rejected')

console.log('Regras de moderação: ok')
