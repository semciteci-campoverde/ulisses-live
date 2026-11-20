import { useState } from 'react'
import { listEventFiles, removeFiles } from '../../lib/adminStorage'
import { formatInt, pageUrl, participantUrl } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { AdminReport, EventRow, Post } from '../../lib/types'
import type { Notify } from './Admin'
import { useAdminReport } from './Dashboard'
import { FLAG_LABELS } from './Moderation'

function csv(rows: (string | number | boolean)[][]) {
  const esc = (v: string | number | boolean) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')
}

function save(content: string, name: string, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })

export default function Reports({ event, notify }: { event: EventRow; notify: Notify }) {
  const { report, reload } = useAdminReport(event.id, notify)
  const [busy, setBusy] = useState('')

  async function exportPosts() {
    const { data, error } = await supabase.from('posts').select('*').eq('event_id', event.id).order('created_at').limit(10000)
    if (error) return notify(friendlyError(error), 'error')
    const rows: (string | number | boolean)[][] = [['data_hora', 'tipo', 'status', 'autor', 'texto', 'emoji', 'arquivos', 'destaque', 'autoriza_imagem', 'autoriza_instagram', 'alertas']]
    for (const p of (data || []) as Post[])
      rows.push([
        fmt(p.created_at),
        p.kind,
        p.status,
        p.author_name,
        p.body,
        p.emoji,
        p.media.length,
        p.featured ? 'sim' : 'não',
        p.consent_image ? 'sim' : 'não',
        p.consent_instagram ? 'sim' : 'não',
        p.flags.map((f) => FLAG_LABELS[f] || f).join(', '),
      ])
    save(csv(rows), `${event.slug}-publicacoes.csv`)
  }

  function exportSummary(r: AdminReport) {
    const rows: (string | number)[][] = [
      ['indicador', 'valor'],
      ['Evento', event.name],
      ['Presenças registradas (por navegador)', r.presences],
      ['Mensagens recebidas', r.messages_total],
      ['Mensagens aprovadas', r.messages_approved],
      ['Fotos recebidas', r.photos_total],
      ['Fotos aprovadas', r.photos_approved],
      ['Vídeos recebidos', r.videos_total],
      ['Vídeos aprovados', r.videos_approved],
      ['Reações', r.reactions],
      ['Pendentes', r.pending],
      ['Rejeitados/retirados', r.rejected],
      ['Sugestões privadas', r.feedback],
      ['Presenças que enviaram algo', r.engaged_visitors],
      [],
      ['hora', 'presenças'],
      ...r.by_hour.map((h) => [h.hour, h.presences]),
      [],
      ['dia', 'turno', 'presenças'],
      ...r.by_shift.map((s) => [s.day, s.shift, s.presences]),
    ]
    save(csv(rows), `${event.slug}-indicadores.csv`)
  }

  function printReport(r: AdminReport) {
    const w = window.open('', '_blank')
    if (!w) return notify('Permita janelas pop-up para gerar o PDF.', 'warn')
    const row = (a: string, b: string | number) => `<tr><td>${a}</td><td style="text-align:right"><b>${typeof b === 'number' ? formatInt(b) : b}</b></td></tr>`
    const max = Math.max(1, ...r.by_hour.map((h) => h.presences))
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório · ${event.name}</title>
      <style>body{font-family:Arial,sans-serif;color:#0a2159;margin:32px}h1{margin:0}h2{border-bottom:3px solid #d4a72c;padding-bottom:4px;margin-top:28px}
      table{border-collapse:collapse;width:100%}td{padding:6px 4px;border-bottom:1px solid #dde}small{color:#667}.bar{background:linear-gradient(90deg,#1650d6,#f2c94c);height:12px;border-radius:3px}</style></head><body>
      <h1>${event.name}</h1><p>${event.institution} · ${event.city}<br><small>Relatório gerado em ${fmt(new Date().toISOString())} pelo ULISSES LIVE</small></p>
      <h2>Indicadores</h2><table>
      ${row('Presenças registradas (por navegador)', r.presences)}${row('Mensagens recebidas / aprovadas', `${r.messages_total} / ${r.messages_approved}`)}
      ${row('Fotos recebidas / aprovadas', `${r.photos_total} / ${r.photos_approved}`)}${row('Vídeos recebidos / aprovados', `${r.videos_total} / ${r.videos_approved}`)}
      ${row('Reações', r.reactions)}${row('Pendentes', r.pending)}${row('Rejeitados ou retirados', r.rejected)}${row('Sugestões privadas', r.feedback)}
      ${row('Taxa de engajamento', r.presences ? `${Math.round((100 * r.engaged_visitors) / r.presences)}%` : '—')}</table>
      <p><small>O número de presenças conta navegadores, não pessoas: quem usou dois aparelhos conta duas vezes, e quem não escaneou o QR Code não conta.</small></p>
      <h2>Presenças por hora</h2><table>${r.by_hour.map((h) => `<tr><td style="width:150px">${h.hour.slice(8, 10)}/${h.hour.slice(5, 7)} ${h.hour.slice(11)}</td><td><div class="bar" style="width:${(100 * h.presences) / max}%"></div></td><td style="width:50px;text-align:right">${h.presences}</td></tr>`).join('')}</table>
      <h2>Por dia e turno</h2><table>${r.by_shift.map((s) => `<tr><td>${s.day.slice(8, 10)}/${s.day.slice(5, 7)}</td><td>${s.shift}</td><td style="text-align:right">${s.presences}</td></tr>`).join('')}</table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`)
    w.document.close()
  }

  async function purge() {
    if (!event.is_demo) return
    if (!window.confirm('Apagar todos os registros de teste (presenças, publicações, reações e arquivos) deste evento de teste?')) return
    try {
      setBusy('Listando arquivos de teste...')
      const files = await listEventFiles(event.id)
      await removeFiles(files, (n) => setBusy(`Apagando arquivos ${n}/${files.length}...`))
      setBusy('Apagando registros...')
      const { error } = await supabase.rpc('admin_purge_event', { p_event: event.id })
      if (error) throw error
      notify('Registros de teste apagados. O evento real não foi alterado.')
      void reload()
    } catch (e) {
      notify(friendlyError(e), 'error')
    }
    setBusy('')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Exportar relatórios</h2>
        <p className="text-sm text-white/60">Os arquivos CSV abrem no Excel e no Google Planilhas. O PDF abre a janela de impressão: escolha “Salvar como PDF”.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-blue btn-sm" disabled={!report} onClick={() => report && exportSummary(report)}>
            Indicadores (CSV)
          </button>
          <button className="btn-blue btn-sm" onClick={() => void exportPosts()}>
            Todas as publicações (CSV)
          </button>
          <button className="btn-gold btn-sm" disabled={!report} onClick={() => report && printReport(report)}>
            Relatório em PDF
          </button>
        </div>
        <p className="text-sm text-white/60">Para baixar fotos e vídeos autorizados, use a aba “Central de publicações”.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Ambiente de testes</h2>
        <p className="text-sm text-white/70">
          Existe um evento separado, “Modo de teste”, para experimentar tudo antes da feira: presença em vários celulares, bloqueio de duplicidade, envio de
          fotos e vídeos, moderação e várias TVs. Ele não altera os números do evento real.
        </p>
        <TestLinks />
        {event.is_demo ? (
          <>
            <p className="text-sm">
              Registros atuais do teste: <b>{report ? formatInt(report.presences) : '...'}</b> presenças, <b>{report ? formatInt(report.posts_total) : '...'}</b> publicações.
            </p>
            <button className="btn-red btn-sm" disabled={!!busy} onClick={() => void purge()}>
              Apagar registros de teste
            </button>
          </>
        ) : (
          <p className="text-sm text-amber-200">Para apagar registros de teste, selecione o evento “Modo de teste” no topo da página.</p>
        )}
        {busy && <p className="text-sm text-white/70">{busy}</p>}
      </section>
    </div>
  )
}

function TestLinks() {
  return (
    <ul className="space-y-1 text-sm">
      <li>
        <a className="text-royal-300 underline" href={participantUrl('teste')} target="_blank" rel="noreferrer">
          Página do participante (teste)
        </a>
      </li>
      <li>
        <a className="text-royal-300 underline" href={pageUrl('/tv', 'teste')} target="_blank" rel="noreferrer">
          Telão (teste)
        </a>
      </li>
      <li>
        <a className="text-royal-300 underline" href={pageUrl('/qr', 'teste')} target="_blank" rel="noreferrer">
          QR Code (teste)
        </a>
      </li>
    </ul>
  )
}
