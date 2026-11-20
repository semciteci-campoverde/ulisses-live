import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { Backdrop, Logo, Spinner, Toast } from '../../components/ui'
import { supabase, friendlyError } from '../../lib/supabase'
import type { EventRow } from '../../lib/types'
import Dashboard from './Dashboard'
import Moderation from './Moderation'
import Publications from './Publications'
import EventSettingsTab from './EventSettings'
import EventsTab from './Events'
import Reports from './Reports'

export type Notify = (message: string, tone?: 'ok' | 'warn' | 'error') => void

const TABS = [
  ['dashboard', 'Painel'],
  ['moderation', 'Moderação'],
  ['publications', 'Central de publicações'],
  ['settings', 'Evento e telão'],
  ['reports', 'Relatórios e testes'],
  ['events', 'Eventos'],
] as const
type TabKey = (typeof TABS)[number][0]

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsAdmin(null)
      return
    }
    void supabase.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)))
  }, [session])

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (!session) return <Login />
  if (isAdmin === null)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Verificando permissões..." />
      </div>
    )
  if (!isAdmin)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass max-w-md p-8 text-center">
          <p className="text-lg">Esta conta não tem permissão de administração.</p>
          <button className="btn-ghost mt-4" onClick={() => void supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>
    )
  return <AdminApp email={session.user.email || ''} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : friendlyError(error))
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Backdrop />
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm space-y-4 p-7">
        <Logo className="mx-auto h-20 w-20" />
        <h1 className="text-center font-display text-2xl font-extrabold">Área da equipe</h1>
        <div>
          <label className="label" htmlFor="em">
            E-mail
          </label>
          <input id="em" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="pw">
            Senha
          </label>
          <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {err && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm">{err}</p>}
        <button className="btn-gold w-full" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        <Link to="/" className="block text-center text-sm text-white/60 hover:text-white">
          Voltar ao início
        </Link>
      </form>
    </div>
  )
}

function AdminApp({ email }: { email: string }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [eventId, setEventId] = useState<string>(() => localStorage.getItem('ulisses.admin.event') || '')
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'warn' | 'error' } | null>(null)
  const notify: Notify = useCallback((message, tone = 'ok') => setToast({ message, tone }), [])

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase.from('events').select('*').order('created_at')
    if (error) return notify(friendlyError(error), 'error')
    const list = (data || []) as EventRow[]
    setEvents(list)
    setEventId((cur) => (list.some((e) => e.id === cur) ? cur : list.find((e) => e.is_default)?.id || list[0]?.id || ''))
  }, [notify])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!eventId) return
    localStorage.setItem('ulisses.admin.event', eventId)
    const ch = supabase
      .channel(`admin-event-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, (p) =>
        setEvents((list) => list.map((e) => (e.id === eventId ? (p.new as EventRow) : e))),
      )
      .subscribe()
    return () => void supabase.removeChannel(ch)
  }, [eventId])

  const event = events.find((e) => e.id === eventId) || null

  const updateEvent = useCallback(
    async (patch: Partial<EventRow>) => {
      if (!event) return false
      const { data, error } = await supabase.from('events').update(patch).eq('id', event.id).select('*').single()
      if (error) {
        notify(friendlyError(error), 'error')
        return false
      }
      setEvents((list) => list.map((e) => (e.id === event.id ? (data as EventRow) : e)))
      return true
    },
    [event, notify],
  )

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo event={event} className="h-10 w-10" />
          <div className="mr-auto">
            <p className="font-display text-xs font-bold uppercase tracking-[.2em] text-gold-300">Ulisses Live · Administração</p>
            <select className="mt-0.5 rounded-lg border border-white/20 bg-navy-800 px-2 py-1 text-sm font-semibold" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Evento">
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.is_demo ? '(teste)' : ''} {e.status === 'closed' ? '— encerrado' : ''}
                </option>
              ))}
            </select>
          </div>
          {event && (
            <button
              className={`btn btn-sm ${event.settings?.emergency ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white`}
              onClick={() => void updateEvent({ settings: { ...event.settings, emergency: !event.settings?.emergency } })}
              title="Tira imediatamente todos os conteúdos do telão"
            >
              {event.settings?.emergency ? '▶ Retomar telão' : '⛔ Parar telão agora'}
            </button>
          )}
          <span className="hidden text-xs text-white/50 md:inline">{email}</span>
          <button className="btn-ghost btn-sm" onClick={() => void supabase.auth.signOut()}>
            Sair
          </button>
        </div>
        {event?.settings?.emergency && (
          <p className="bg-red-600 px-4 py-1.5 text-center text-sm font-bold">Telão em modo de emergência: nenhuma publicação está sendo exibida.</p>
        )}
        <nav className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-gold-400 text-navy-900' : 'text-white/75 hover:bg-white/10'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {!event ? (
          <Spinner />
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard event={event} updateEvent={updateEvent} notify={notify} />}
            {tab === 'moderation' && <Moderation event={event} notify={notify} />}
            {tab === 'publications' && <Publications event={event} notify={notify} />}
            {tab === 'settings' && <EventSettingsTab event={event} updateEvent={updateEvent} notify={notify} />}
            {tab === 'reports' && <Reports event={event} notify={notify} />}
            {tab === 'events' && <EventsTab events={events} current={eventId} onSelect={setEventId} reload={loadEvents} notify={notify} />}
          </>
        )}
      </main>
      {toast && <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  )
}

export type UpdateEvent = (patch: Partial<EventRow>) => Promise<boolean>
