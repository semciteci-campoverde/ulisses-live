import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dataDir = mkdtempSync(path.join(tmpdir(), 'ulisses-'))
const port = 8791
const base = `http://127.0.0.1:${port}`
let child: ChildProcess | null = null

const visitorA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const visitorB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('servidor não subiu')
}

async function json(pathName: string, init?: RequestInit) {
  const response = await fetch(`${base}${pathName}`, init)
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body: body as Record<string, unknown> }
}

function cookieFrom(response: Response): string {
  const raw = response.headers.get('set-cookie') || ''
  return raw.split(';')[0]
}

async function main() {
  child = spawn(process.execPath, ['--experimental-strip-types', 'server/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_EMAIL: 'admin@eecm.local',
      ADMIN_PASSWORD: 'senha-teste',
    },
    stdio: 'inherit',
  })
  await waitForHealth()

  const first = await json('/api/events/feira-2026/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorA }),
  })
  assert.equal(first.body.already, false)
  assert.equal(first.body.total, 1)

  const second = await json('/api/events/feira-2026/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorA }),
  })
  assert.equal(second.body.already, true)
  assert.equal(second.body.total, 1)

  const other = await json('/api/events/feira-2026/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorB }),
  })
  assert.equal(other.body.total, 2)

  const pending = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorA,
      type: 'message',
      authorName: 'Ana',
      body: 'A feira está linda e os trabalhos inspiram.',
      emoji: '👏',
      openedAt: Date.now() - 5000,
    }),
  })
  assert.equal(pending.status, 201)
  const pendingMod = pending.body.moderation as { status: string; aiUsed: boolean; label: string }
  assert.equal(pendingMod.status, 'approved')
  assert.equal(pendingMod.label, 'positive')
  assert.equal(pendingMod.aiUsed, false)
  const postId = String(pending.body.postId)

  const feedBefore = await json('/api/events/feira-2026/feed')
  const liveMessages = (feedBefore.body.posts as { id: string; type: string }[]).filter((post) => post.type === 'message')
  assert.equal(liveMessages.length, 1)
  assert.equal(liveMessages[0].id, postId)

  const obfuscated = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorB,
      type: 'message',
      authorName: 'Bia',
      body: 'p o r r a',
      openedAt: Date.now() - 5000,
    }),
  })
  assert.equal(obfuscated.status, 400)
  assert.match(String(obfuscated.body.error), /mensagem positiva/)

  const neutral = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorA,
      type: 'message',
      authorName: 'Ana',
      body: 'Estou na sala de robotica.',
      openedAt: Date.now() - 5000,
    }),
  })
  assert.equal((neutral.body.moderation as { status: string; label: string }).status, 'pending')
  assert.equal((neutral.body.moderation as { label: string }).label, 'neutral')
  const neutralId = String(neutral.body.postId)

  const blocked = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorB,
      type: 'message',
      authorName: 'Bia',
      body: 'que merda',
      openedAt: Date.now() - 5000,
    }),
  })
  assert.equal(blocked.status, 400)

  const criticism = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorId: visitorB,
      type: 'message',
      authorName: 'Caio',
      body: 'Não gostei da fila da entrada',
      openedAt: Date.now() - 5000,
    }),
  })
  assert.equal((criticism.body.moderation as { audience: string }).audience, 'admin')

  const reaction = await json('/api/events/feira-2026/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorA, type: 'reaction', emoji: '🚀', openedAt: Date.now() - 5000 }),
  })
  assert.equal((reaction.body.moderation as { status: string }).status, 'approved')
  const feedReaction = await json('/api/events/feira-2026/feed')
  const midFeed = feedReaction.body.posts as { id: string; type: string }[]
  assert.equal(midFeed.some((post) => post.type === 'reaction'), true)
  assert.equal(midFeed.some((post) => post.id === postId), true)
  assert.equal(midFeed.some((post) => post.id === neutralId), false)

  const login = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@eecm.local', password: 'senha-teste' }),
  })
  assert.equal(login.status, 200)
  const cookie = cookieFrom(login)
  assert.match(cookie, /ul_session=/)

  const badLogin = await json('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@eecm.local', password: 'errada' }),
  })
  assert.equal(badLogin.status, 401)

  const approved = await json(`/api/admin/events/feira-2026/moderate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ postId: neutralId, action: 'approve' }),
  })
  assert.equal(approved.status, 200)
  const feedAfter = await json('/api/events/feira-2026/feed')
  const messages = (feedAfter.body.posts as { id: string; type: string }[]).filter((post) => post.type === 'message')
  assert.equal(messages.some((post) => post.id === neutralId), true)
  assert.equal(messages.some((post) => post.id === postId), true)

  const hidden = await fetch(`${base}/api/media/nao-existe`)
  assert.equal(hidden.status, 404)

  const photoPath = path.join(dataDir, 'foto.jpg')
  await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180', '-frames:v', '1', photoPath])
  const photoBytes = await (await import('node:fs')).promises.readFile(photoPath)
  const photoForm = new FormData()
  photoForm.set('visitorId', visitorA)
  photoForm.set('type', 'photo')
  photoForm.set('authorName', 'Ana')
  photoForm.set('body', 'Bancada de ciências')
  photoForm.set('emoji', '💡')
  photoForm.set('imageConsent', 'true')
  photoForm.set('instagramConsent', 'false')
  photoForm.set('openedAt', String(Date.now() - 5000))
  photoForm.set('files', new Blob([photoBytes], { type: 'image/jpeg' }), 'foto.jpg')
  const photoRes = await fetch(`${base}/api/events/feira-2026/posts`, { method: 'POST', body: photoForm })
  const photoBody = await photoRes.json() as { postId: string; moderation: { status: string; label: string } }
  assert.equal(photoRes.status, 201)
  assert.equal(photoBody.moderation.status, 'pending')
  assert.equal(photoBody.moderation.label, 'media_review')

  const overview = await json('/api/admin/events/feira-2026', { headers: { Cookie: cookie } })
  const photoPost = (overview.body.posts as { id: string; media: { id: string }[] }[]).find((post) => post.id === photoBody.postId)
  assert.ok(photoPost && photoPost.media.length === 1)
  const mediaId = photoPost.media[0].id
  const locked = await fetch(`${base}/api/media/${mediaId}`)
  assert.equal(locked.status, 401)
  const staff = await fetch(`${base}/api/media/${mediaId}`, { headers: { Cookie: cookie } })
  assert.equal(staff.status, 200)
  assert.match(staff.headers.get('content-type') || '', /image/)

  const approvePhoto = await json('/api/admin/events/feira-2026/moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ postId: photoBody.postId, action: 'approve' }),
  })
  assert.equal(approvePhoto.status, 200)
  const openMedia = await fetch(`${base}/api/media/${mediaId}`)
  assert.equal(openMedia.status, 200)

  const shortVideo = path.join(dataDir, 'curto.mp4')
  const longVideo = path.join(dataDir, 'longo.mp4')
  await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:d=2', '-f', 'lavfi', '-i', 'sine=f=440:d=2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', shortVideo])
  await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=160x90:d=18', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', longVideo])

  async function sendVideo(file: string, who: string) {
    const bytes = await (await import('node:fs')).promises.readFile(file)
    const form = new FormData()
    form.set('visitorId', who)
    form.set('type', 'video')
    form.set('authorName', 'Leo')
    form.set('body', 'Vídeo da feira')
    form.set('imageConsent', 'true')
    form.set('openedAt', String(Date.now() - 4000))
    form.set('files', new Blob([bytes], { type: 'video/mp4' }), 'v.mp4')
    const response = await fetch(`${base}/api/events/feira-2026/posts`, { method: 'POST', body: form })
    return { status: response.status, body: await response.json() as { error?: string; moderation?: { status: string } } }
  }
  const tooLong = await sendVideo(longVideo, visitorB)
  assert.equal(tooLong.status, 400)
  assert.match(tooLong.body.error || '', /15 segundos/)
  const short = await sendVideo(shortVideo, visitorA)
  assert.equal(short.status, 201)
  assert.equal(short.body.moderation?.status, 'pending')

  const emergency = await json('/api/admin/events/feira-2026/emergency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ stop: true }),
  })
  assert.equal(emergency.status, 200)
  const stopped = await json('/api/events/feira-2026')
  assert.equal(stopped.body.emergencyStop, true)
  await json('/api/admin/events/feira-2026/emergency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ stop: false }),
  })

  const demoBefore = await json('/api/events/feira-2026-demo')
  assert.equal(demoBefore.body.presenceCount, 0)
  const realBefore = await json('/api/events/feira-2026')
  const realCount = Number(realBefore.body.presenceCount)
  const seeded = await json('/api/admin/events/feira-2026-demo/seed-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  })
  assert.equal(seeded.status, 200)
  const demoAfter = await json('/api/events/feira-2026-demo')
  assert.ok(Number(demoAfter.body.presenceCount) >= 4)
  const realAfter = await json('/api/events/feira-2026')
  assert.equal(Number(realAfter.body.presenceCount), realCount)
  const purged = await json('/api/admin/events/feira-2026-demo/purge-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  })
  assert.equal(purged.status, 200)
  const demoClean = await json('/api/events/feira-2026-demo')
  assert.equal(demoClean.body.presenceCount, 0)
  const realStill = await json('/api/events/feira-2026')
  assert.equal(Number(realStill.body.presenceCount), realCount)
  const cannotPurgeReal = await json('/api/admin/events/feira-2026/purge-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: '{}',
  })
  assert.equal(cannotPurgeReal.status, 400)

  const erased = await json('/api/events/feira-2026/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorB, scope: 'all' }),
  })
  assert.equal(erased.status, 200)

  const stream = await fetch(`${base}/api/events/feira-2026/stream`)
  assert.equal(stream.status, 200)
  const reader = stream.body?.getReader()
  const chunk = await reader?.read()
  const text = new TextDecoder().decode(chunk?.value)
  assert.match(text, /hello/)
  await reader?.cancel()

  console.log('Fluxos de presença, moderação, mídia e demonstração: ok')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    child?.kill('SIGTERM')
    rmSync(dataDir, { recursive: true, force: true })
  })
