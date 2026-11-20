// Identificador anônimo do navegador. Fica só no aparelho do visitante e serve
// apenas para não contar a mesma presença duas vezes. Não identifica a pessoa.

const KEY = 'ulisses.visitor'
const NAME_KEY = 'ulisses.name'
let memoryId: string | null = null

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
    const id = uuid()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Navegador sem armazenamento (modo privado restrito): vale só nesta aba.
    if (!memoryId) memoryId = uuid()
    return memoryId
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    /* sem armazenamento: tudo bem */
  }
}
