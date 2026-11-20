import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mediaPaths, signedUrls } from './media'
import { supabase } from './supabase'
import type { EventRow, EventStats, Post, PostKind } from './types'

/** Lê o evento pelo parâmetro ?e=slug, ou o evento padrão. Acompanha mudanças em tempo real. */
export function useEvent() {
  const [params] = useSearchParams()
  const slug = params.get('e') || ''
  const [event, setEvent] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const q = supabase.from('events').select('*')
    const { data, error: err } = slug ? await q.eq('slug', slug).maybeSingle() : await q.eq('is_default', true).maybeSingle()
    if (err) setError(err.message)
    else if (!data) setError('Evento não encontrado.')
    else {
      setError(null)
      setEvent(data as EventRow)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const id = event?.id
  useEffect(() => {
    if (!id) return
    const ch = supabase
      .channel(`event-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` }, (p) =>
        setEvent(p.new as EventRow),
      )
      .subscribe()
    const t = window.setInterval(() => void load(), 60_000)
    return () => {
      window.clearInterval(t)
      void supabase.removeChannel(ch)
    }
  }, [id, load])

  return { event, loading, error, reload: load, slug: event?.slug || slug }
}

/** Contadores públicos do evento, em tempo real, com verificação periódica de segurança. */
export function useStats(eventId: string | undefined) {
  const [stats, setStats] = useState<EventStats | null>(null)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    if (!eventId) return
    const { data } = await supabase.from('event_stats').select('*').eq('event_id', eventId).maybeSingle()
    if (data) setStats(data as EventStats)
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    void load()
    const ch = supabase
      .channel(`stats-${eventId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_stats', filter: `event_id=eq.${eventId}` }, (p) =>
        setStats(p.new as EventStats),
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    const t = window.setInterval(() => void load(), 20_000)
    const onOnline = () => void load()
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(ch)
    }
  }, [eventId, load])

  return { stats, live, reload: load }
}

/** Publicações aprovadas, recarregadas quando o contador de revisão muda. */
export function useApprovedPosts(eventId: string | undefined, rev: number | undefined, kinds: PostKind[] = ['message', 'photo', 'video'], limit = 300) {
  const [posts, setPosts] = useState<Post[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const kindsKey = kinds.join(',')
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    if (!eventId) return
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .in('kind', kindsKey.split(','))
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return
    const list = (data || []) as Post[]
    const paths = mediaPaths(list)
    const signed = paths.length ? await signedUrls(paths) : {}
    setUrls((u) => ({ ...u, ...signed }))
    setPosts(list)
    setLoaded(true)
  }, [eventId, kindsKey, limit])

  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(), loaded ? 700 : 0)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, rev])

  useEffect(() => {
    const t = window.setInterval(() => void load(), 45_000)
    return () => window.clearInterval(t)
  }, [load])

  return { posts, urls, loaded, reload: load }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

/** Número que anima até o valor alvo. */
export function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(a + (target - a) * eased))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export function participantUrl(slug: string) {
  const base = window.location.origin + window.location.pathname
  return `${base}#/participar${slug ? `?e=${encodeURIComponent(slug)}` : ''}`
}

export function pageUrl(route: string, slug?: string) {
  const base = window.location.origin + window.location.pathname
  return `${base}#${route}${slug ? `?e=${encodeURIComponent(slug)}` : ''}`
}

export function formatInt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}
