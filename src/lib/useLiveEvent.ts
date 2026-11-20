import { useCallback, useEffect, useState } from 'react'
import type { PublicEvent, PublicPost } from '../../shared/types.ts'
import { api } from './api.ts'

export function useLiveEvent(slug: string) {
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [posts, setPosts] = useState<PublicPost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [clockOffset, setClockOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const next = await api.getEvent(slug)
      const feed = await api.feed(slug)
      setEvent(next)
      setPosts(feed)
      setClockOffset(Date.parse(next.serverTime) - Date.now())
      setError(null)
      setConnected(true)
      const root = document.documentElement
      root.style.setProperty('--navy', next.colors.navy)
      root.style.setProperty('--royal', next.colors.royal)
      root.style.setProperty('--gold', next.colors.gold)
      root.style.setProperty('--ink', next.colors.ink)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sem conexão com o painel.')
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    let timer = 0
    const unsubscribe = api.subscribe(slug, (stream) => {
      if (stream.type === 'status') setConnected(stream.connected)
      if (stream.type === 'hello') setClockOffset(Date.parse(stream.serverTime) - Date.now())
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void reload()
      }, 160)
    })
    void reload()
    const poll = window.setInterval(() => {
      void reload()
    }, 8000)
    const online = () => {
      void reload()
    }
    window.addEventListener('online', online)
    return () => {
      unsubscribe()
      window.clearInterval(poll)
      window.clearTimeout(timer)
      window.removeEventListener('online', online)
    }
  }, [slug, reload])

  return { event, posts, error, connected, clockOffset, loading, reload }
}
