import { isVisitorId } from '../../shared/text.ts'

const KEY = 'ulisses.visitorId'

export function visitorId(): string {
  try {
    const current = localStorage.getItem(KEY)
    if (current && isVisitorId(current)) return current
  } catch {
    /* navegador privado pode bloquear; ainda geramos um id nesta aba */
  }
  const created = crypto.randomUUID()
  try {
    localStorage.setItem(KEY, created)
  } catch {
    /* segue com o id só na memória desta visita */
  }
  return created
}
