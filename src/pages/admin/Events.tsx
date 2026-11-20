import { useState, type FormEvent } from 'react'
import { pageUrl, participantUrl } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { EventRow } from '../../lib/types'
import type { Notify } from './Admin'

export default function EventsTab({
  events,
  current,
  onSelect,
  reload,
  notify,
}: {
  events: EventRow[]
  current: string
  onSelect: (id: string) => void
  reload: () => Promise<void>
  notify: Notify
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const base = events.find((e) => e.id === current) || events[0]

  function slugify(v: string) {
    return v
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    const s = slug || slugify(name)
    if (!/^[a-z0-9-]{3,40}$/.test(s)) return notify('O endereço curto deve ter de 3 a 40 letras minúsculas, números ou hífens.', 'warn')
    setBusy(true)
    const { data, error } = await supabase
      .from('events')
      .insert({
        slug: s,
        name,
        institution: base?.institution || '',
        city: base?.city || '',
        instagram_handle: base?.instagram_handle || '',
        instagram_url: base?.instagram_url || '',
        status: 'active',
        settings: { ...(base?.settings || {}), paused: false, emergency: false, memories_public: false },
      })
      .select('id')
      .single()
    setBusy(false)
    if (error) return notify(error.message.includes('duplicate') ? 'Já existe um evento com esse endereço.' : friendlyError(error), 'error')
    setName('')
    setSlug('')
    await reload()
    onSelect((data as { id: string }).id)
    notify('Evento criado. Ajuste os detalhes na aba “Evento e telão”.')
  }

  async function makeDefault(ev: EventRow) {
    const { error: e1 } = await supabase.from('events').update({ is_default: false }).eq('is_default', true)
    const { error: e2 } = await supabase.from('events').update({ is_default: true }).eq('id', ev.id)
    if (e1 || e2) notify(friendlyError(e1 || e2), 'error')
    else {
      notify(`“${ev.name}” agora abre quando o link não informa o evento.`)
      await reload()
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        {events.map((ev) => (
          <div key={ev.id} className={`card p-4 ${ev.id === current ? 'ring-2 ring-gold-400' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold">{ev.name}</h3>
              {ev.is_default && <span className="chip bg-gold-400 text-navy-900">padrão</span>}
              {ev.is_demo && <span className="chip bg-amber-500/30">teste</span>}
              <span className="chip bg-white/10">{ev.status === 'active' ? 'ativo' : ev.status === 'closed' ? 'encerrado' : 'rascunho'}</span>
              <span className="text-xs text-white/50">?e={ev.slug}</span>
              <div className="ml-auto flex gap-2">
                {ev.id !== current && (
                  <button className="btn-ghost btn-sm" onClick={() => onSelect(ev.id)}>
                    Gerenciar
                  </button>
                )}
                {!ev.is_default && !ev.is_demo && (
                  <button className="btn-ghost btn-sm" onClick={() => void makeDefault(ev)}>
                    Tornar padrão
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <a className="text-royal-300 underline" href={participantUrl(ev.slug)} target="_blank" rel="noreferrer">
                Participante
              </a>
              <a className="text-royal-300 underline" href={pageUrl('/tv', ev.slug)} target="_blank" rel="noreferrer">
                Telão
              </a>
              <a className="text-royal-300 underline" href={pageUrl('/qr', ev.slug)} target="_blank" rel="noreferrer">
                QR Code
              </a>
              <a className="text-royal-300 underline" href={pageUrl('/memorias', ev.slug)} target="_blank" rel="noreferrer">
                Memórias
              </a>
            </div>
          </div>
        ))}
      </section>
      <form onSubmit={create} className="card h-fit space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Novo evento</h2>
        <p className="text-sm text-white/60">Formaturas, mostras, jogos, reuniões... Cada evento tem seu próprio QR Code, contador e histórico.</p>
        <div>
          <label className="label">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex.: Formatura 2026" />
        </div>
        <div>
          <label className="label">Endereço curto</label>
          <input className="input" value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="formatura-2026" />
        </div>
        <button className="btn-gold w-full" disabled={busy || !name}>
          Criar evento
        </button>
      </form>
    </div>
  )
}
