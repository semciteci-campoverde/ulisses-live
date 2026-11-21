const CACHE = 'ulisses-live-v5'
// Fotos e vídeos aprovados ficam guardados no disco da TV: cada arquivo é baixado uma vez só,
// e as voltas seguintes da roleta tocam do cache (menos internet e menos consumo do Supabase).
const MEDIA = 'ulisses-media-v1'
const MEDIA_MAX = 200
const SHELL = ['/', '/participar', '/brand/logo.png', '/fonts/fonts.css', '/manifest.webmanifest', '/favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== MEDIA).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

const inflight = new Map()

function isApprovedMedia(url) {
  return url.pathname.includes('/storage/v1/object/public/ulisses-public/approved/')
}

async function fromTv(event) {
  const id = event.clientId || event.resultingClientId
  if (!id) return false
  const client = await self.clients.get(id)
  return Boolean(client && new URL(client.url).pathname.startsWith('/tv'))
}

function fillCache(key) {
  if (inflight.has(key)) return inflight.get(key)
  const job = fetch(key, { mode: 'cors', credentials: 'omit' })
    .then(async (response) => {
      if (!response.ok) return
      const cache = await caches.open(MEDIA)
      await cache.put(key, response)
      const keys = await cache.keys()
      for (const old of keys.slice(0, Math.max(0, keys.length - MEDIA_MAX))) await cache.delete(old)
    })
    .catch(() => {})
    .finally(() => inflight.delete(key))
  inflight.set(key, job)
  return job
}

async function mediaResponse(event) {
  const key = event.request.url.split('#')[0]
  const cache = await caches.open(MEDIA)
  const cached = await cache.match(key)
  if (!cached) {
    // Primeira vez: toca direto da rede e guarda uma cópia em segundo plano.
    event.waitUntil(fillCache(key))
    return fetch(event.request)
  }
  const range = event.request.headers.get('range')
  if (!range) return cached
  const blob = await cached.blob()
  const size = blob.size
  const match = /bytes=(\d*)-(\d*)/.exec(range)
  let start = match && match[1] ? Number(match[1]) : 0
  let end = match && match[2] ? Number(match[2]) : size - 1
  if (match && !match[1] && match[2]) { start = Math.max(0, size - Number(match[2])); end = size - 1 }
  end = Math.min(end, size - 1)
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('content-type') || blob.type || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) {
    if (!isApprovedMedia(url)) return
    event.respondWith(
      fromTv(event)
        .then((tv) => (tv ? mediaResponse(event) : fetch(event.request)))
        .catch(() => fetch(event.request)),
    )
    return
  }
  if (url.pathname.startsWith('/api')) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !url.pathname.startsWith('/api')) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  )
})
