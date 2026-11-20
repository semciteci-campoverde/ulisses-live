import { Link } from 'react-router-dom'
import { APP_NAME, APP_SLOGAN, APP_TAGLINE } from '../config'
import { Backdrop, InstagramIcon, Logo, Spinner } from '../components/ui'
import { formatInt, useEvent, useStats } from '../lib/hooks'

export default function Home() {
  const { event, loading, error, slug } = useEvent()
  const { stats } = useStats(event?.id)
  const q = slug ? `?e=${slug}` : ''

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Backdrop />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center px-5 py-10 text-center">
        <Logo event={event} className="h-28 w-28 animate-pop" />
        <p className="mt-4 font-display text-sm font-bold uppercase tracking-[.3em] text-gold-300">{APP_TAGLINE}</p>
        <h1 className="mt-2 font-display text-5xl font-black tracking-tight sm:text-6xl">
          <span className="text-silver">ULISSES</span> <span className="text-gold">LIVE</span>
        </h1>
        <p className="mt-2 font-script text-2xl text-gold-200 sm:text-3xl">{APP_SLOGAN}</p>

        {error && <p className="mt-8 rounded-xl bg-red-500/20 px-4 py-3">{error}</p>}

        {event && (
          <section className="glass mt-8 w-full p-6 text-left sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-royal-300">{event.institution}</p>
            <h2 className="mt-1 font-display text-3xl font-extrabold text-gold">{event.name}</h2>
            {event.theme && <p className="mt-2 text-lg italic text-white/90">{event.theme}</p>}
            {event.schedule && <p className="mt-4 text-white/75">{event.schedule}</p>}
            {event.city && <p className="mt-1 text-white/60">{event.city}</p>}
            {stats && (
              <p className="mt-5 font-display text-xl font-bold">
                <span className="text-gold">{formatInt(stats.presences)}</span> presenças registradas
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {event.status === 'active' ? (
                <Link to={`/participar${q}`} className="btn-gold text-lg">
                  Participar agora
                </Link>
              ) : (
                <Link to={`/memorias${q}`} className="btn-gold text-lg">
                  Ver a memória do evento
                </Link>
              )}
              <Link to={`/galeria${q}`} className="btn-ghost text-lg">
                Galeria
              </Link>
            </div>
            {event.instagram_url && (
              <a href={event.instagram_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
                <InstagramIcon className="h-5 w-5" /> {event.instagram_handle}
              </a>
            )}
          </section>
        )}

        <footer className="mt-auto pt-10 text-xs text-white/40">
          {APP_NAME} · <Link to={`/tv${q}`} className="hover:text-white/70">Telão</Link> · <Link to={`/qr${q}`} className="hover:text-white/70">QR Code</Link> ·{' '}
          <Link to="/admin" className="hover:text-white/70">Equipe</Link>
        </footer>
      </main>
    </div>
  )
}
