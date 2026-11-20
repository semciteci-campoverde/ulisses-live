import { DEFAULT_SLUG, DEMO_SLUG } from '../../shared/constants.ts'

export function eventSlug(params: URLSearchParams): string {
  const modo = params.get('modo') || params.get('demo')
  if (modo === 'demo' || modo === '1') return DEMO_SLUG
  return params.get('e') || DEFAULT_SLUG
}

export function withEvent(path: string, slug: string): string {
  if (slug === DEMO_SLUG) return `${path}?modo=demo`
  if (slug === DEFAULT_SLUG) return path
  return `${path}?e=${encodeURIComponent(slug)}`
}
