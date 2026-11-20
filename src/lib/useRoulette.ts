import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface RouletteItem {
  id: string
  createdAt: string
}

/**
 * Roleta do painel: passa por TODOS os itens, um de cada vez, em ordem.
 * - Na primeira carga, a fila segue a ordem de envio (mais antigo primeiro).
 * - Item novo (chegou depois) entra no começo da fila: é o próximo a aparecer.
 * - Quando a fila acaba, recomeça com todos os itens. Ninguém é pulado.
 * - Item removido pela equipe sai da fila na hora.
 */
export function useRoulette<T extends RouletteItem>(items: T[], durationOf: (item: T) => number) {
  const known = useRef<Set<string>>(new Set())
  const queue = useRef<string[]>([])
  const currentRef = useRef<string | null>(null)
  const loaded = useRef(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [turn, setTurn] = useState(0)
  const [freshIds, setFreshIds] = useState<string[]>([])

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const ordered = useMemo(
    () => [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)),
    [items],
  )
  const orderedRef = useRef(ordered)
  orderedRef.current = ordered

  const show = useCallback((id: string | null) => {
    currentRef.current = id
    setCurrentId(id)
    setStartedAt(Date.now())
    setTurn((value) => value + 1)
  }, [])

  const advance = useCallback(() => {
    if (!queue.current.length) {
      // Nova volta completa, na ordem de envio. Só evita repetir o mesmo item duas vezes seguidas.
      const all = orderedRef.current.map((item) => item.id)
      if (all.length > 1 && all[0] === currentRef.current) all.push(all.shift() as string)
      queue.current = all
    }
    const next = queue.current.shift() ?? null
    show(next)
  }, [show])

  // Sincroniza a fila sempre que a lista muda (tempo real ou recarga periódica).
  useEffect(() => {
    const ids = new Set(ordered.map((item) => item.id))
    const fresh = ordered.filter((item) => !known.current.has(item.id)).map((item) => item.id)
    for (const id of fresh) known.current.add(id)
    for (const id of [...known.current]) if (!ids.has(id)) known.current.delete(id)
    queue.current = queue.current.filter((id) => ids.has(id) && !fresh.includes(id))
    if (!loaded.current) {
      if (ordered.length) {
        loaded.current = true
        queue.current = fresh
      }
    } else if (fresh.length) {
      queue.current = [...fresh, ...queue.current]
      setFreshIds(fresh)
    }
    if (!currentRef.current || !ids.has(currentRef.current)) {
      const next = queue.current.shift() ?? null
      if (next !== currentRef.current) show(next)
    }
  }, [ordered, show])

  const current = currentId ? byId.get(currentId) ?? null : null
  const duration = current ? durationOf(current) : 0

  useEffect(() => {
    if (!currentId || !duration) return
    const timer = window.setTimeout(advance, duration)
    return () => window.clearTimeout(timer)
    // turn garante novo temporizador mesmo quando o mesmo item volta (lista de 1 item).
  }, [currentId, duration, turn, advance])

  const position = current ? ordered.findIndex((item) => item.id === current.id) + 1 : 0
  return { current, advance, startedAt, duration, position, total: ordered.length, freshIds, turn }
}
