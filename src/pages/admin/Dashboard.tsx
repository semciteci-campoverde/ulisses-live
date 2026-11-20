import { useCallback, useEffect, useState } from 'react'
import { formatInt, pageUrl, participantUrl, useStats } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { AdminReport, EventRow } from '../../lib/types'
import type { Notify, UpdateEvent } from './Admin'

export function useAdminReport(eventId: string, notify: Notify) {
  const [report, setReport] = useState<AdminReport | null>(null)
  const { stats } = useStats(eventId)
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_report', { p_event: eventId })
    if (error) notify(friendlyError(error), 'error')
    else setReport(data as AdminReport)
  }, [eventId, notify])
  useEffect(() => {
    void load()
  }, [load, stats?.updated_at])
  useEffect(() => {
    const t = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(t)
  }, [load])
  return { report, reload: load }
}

export default function Dashboard({ event, updateEvent, notify }: { event: EventRow; updateEvent: UpdateEvent; notify: Notify }) {
  const { report } = useAdminReport(event.id, notify)
  const s = event.settings || {}

  const kpis: [string, number | string, string?][] = report
    ? [
        ['Presenças registradas', report.presences, 'por navegador'],
        ['Mensagens recebidas', report.messages_total],
        ['Mensagens aprovadas', report.messages_approved],
        ['Fotografias', `${report.photos_approved}/${report.photos_total}`, 'aprovadas/recebidas'],
        ['Vídeos', `${report.videos_approved}/${report.videos_total}`, 'aprovados/recebidos'],
        ['Reações', report.reactions],
        ['Pendentes', report.pending, 'aguardando análise'],
        ['Rejeitados', report.rejected],
        ['Sugestões privadas', report.feedback],
        [
          'Engajamento',
          report.presences ? `${Math.round((100 * report.engaged_visitors) / report.presences)}%` : '—',
          'presenças que enviaram algo',
        ],
      ]
    : []
  const maxHour = Math.max(1, ...(report?.by_hour || []).map((h) => h.presences))
  const peak = report?.by_hour.reduce((a, b) => (b.presences > (a?.presences ?? -1) ? b : a), undefined as AdminReport['by_hour'][number] | undefined)

  const links: [string, string][] = [
    ['Participante (QR)', participantUrl(event.slug)],
    ['Telão (TV)', pageUrl('/tv', event.slug)],
    ['QR para impressão', pageUrl('/qr', event.slug)],
    ['Galeria pública', pageUrl('/galeria', event.slug)],
    ['Memória digital', pageUrl('/memorias', event.slug)],
  ]

  return (
    <div className="space-y-6">
      {event.is_demo && <p className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100">Você está vendo o evento de teste. Os números daqui não entram no evento real.</p>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {report
          ? kpis.map(([label, value, hint]) => (
              <div key={label} className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
                <p className="mt-1 font-display text-3xl font-black text-gold">{typeof value === 'number' ? formatInt(value) : value}</p>
                {hint && <p className="text-xs text-white/50">{hint}</p>}
              </div>
            ))
          : Array.from({ length: 10 }, (_, i) => <div key={i} className="card h-24 animate-pulse" />)}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Presenças por hora</h2>
          {peak && <p className="text-sm text-white/60">Horário de maior participação: {peak.hour.slice(11)} de {peak.hour.slice(8, 10)}/{peak.hour.slice(5, 7)}, com {peak.presences} presenças.</p>}
          <div className="mt-4 space-y-1.5">
            {(report?.by_hour || []).map((h) => (
              <div key={h.hour} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-white/70">
                  {h.hour.slice(8, 10)}/{h.hour.slice(5, 7)} {h.hour.slice(11)}
                </span>
                <div className="h-5 flex-1 rounded bg-white/5">
                  <div className="h-5 rounded bg-gradient-to-r from-royal-500 to-gold-400" style={{ width: `${(100 * h.presences) / maxHour}%` }} />
                </div>
                <span className="w-12 text-right tabular-nums">{h.presences}</span>
              </div>
            ))}
            {report && !report.by_hour.length && <p className="text-sm text-white/50">Ainda sem presenças.</p>}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Por dia e turno</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {(report?.by_shift || []).map((r) => (
                <tr key={r.day + r.shift} className="border-b border-white/5">
                  <td className="py-1.5">
                    {r.day.slice(8, 10)}/{r.day.slice(5, 7)}
                  </td>
                  <td className="capitalize">{r.shift}</td>
                  <td className="text-right font-bold tabular-nums">{r.presences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-bold">Controle rápido do telão</h2>
          <Toggle
            label="Mural pausado"
            hint="O telão mostra só o contador, o QR Code, o Instagram e o convite."
            value={Boolean(s.paused)}
            onChange={(v) => void updateEvent({ settings: { ...s, paused: v } }).then((ok) => ok && notify(v ? 'Mural pausado.' : 'Mural retomado.'))}
          />
          <Toggle
            label="Aprovar mensagens automaticamente"
            hint="Só mensagens que passam no filtro de palavras. Fotos e vídeos sempre passam por uma pessoa."
            value={Boolean(s.auto_approve_messages)}
            onChange={(v) => void updateEvent({ settings: { ...s, auto_approve_messages: v } })}
          />
          <Toggle
            label="Emergência: parar o telão"
            hint="Tira na hora todas as publicações de todas as TVs."
            value={Boolean(s.emergency)}
            danger
            onChange={(v) => void updateEvent({ settings: { ...s, emergency: v } })}
          />
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Links do evento</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {links.map(([label, url]) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-white/70">{label}</span>
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-royal-300 underline">
                  {url}
                </a>
                <button
                  className="btn-ghost btn-sm shrink-0"
                  onClick={() => void navigator.clipboard.writeText(url).then(() => notify('Link copiado.'))}
                >
                  Copiar
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

export function Toggle({ label, hint, value, onChange, danger = false }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${value ? (danger ? 'bg-red-600' : 'bg-emerald-500') : 'bg-white/20'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? 'left-6' : 'left-1'}`} />
      </button>
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-white/60">{hint}</span>}
      </span>
    </label>
  )
}
