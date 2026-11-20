import { useEffect, useState, type ChangeEvent } from 'react'
import { listEventFiles, removeFiles } from '../../lib/adminStorage'
import { friendlyError, supabase } from '../../lib/supabase'
import type { EventRow, EventSettings, SceneKey } from '../../lib/types'
import { uuid } from '../../lib/visitor'
import type { Notify, UpdateEvent } from './Admin'
import { Toggle } from './Dashboard'

const SCENES: [SceneKey, string, number][] = [
  ['messages', 'Mensagens', 14],
  ['photos', 'Mosaico de fotos', 14],
  ['videos', 'Vídeos', 30],
  ['counter', 'Contador de participantes', 8],
  ['qr', 'Convite à participação (QR Code)', 12],
  ['instagram', 'Instagram da escola', 10],
  ['invite', 'Convite animado da feira', 12],
]

type Info = Pick<EventRow, 'name' | 'institution' | 'city' | 'theme' | 'schedule' | 'instagram_handle' | 'instagram_url'>

export default function EventSettingsTab({ event, updateEvent, notify }: { event: EventRow; updateEvent: UpdateEvent; notify: Notify }) {
  const [info, setInfo] = useState<Info>(event)
  const [s, setS] = useState<EventSettings>(event.settings || {})
  const [goals, setGoals] = useState((event.settings?.goals || []).join(', '))
  const [busy, setBusy] = useState('')

  useEffect(() => {
    setInfo(event)
    setS(event.settings || {})
    setGoals((event.settings?.goals || []).join(', '))
  }, [event.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Info) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInfo((i) => ({ ...i, [k]: e.target.value }))

  async function saveAll() {
    const parsedGoals = goals
      .split(/[,; ]+/)
      .map((g) => parseInt(g, 10))
      .filter((g) => g > 0)
      .sort((a, b) => a - b)
    const ok = await updateEvent({
      name: info.name,
      institution: info.institution,
      city: info.city,
      theme: info.theme,
      schedule: info.schedule,
      instagram_handle: info.instagram_handle,
      instagram_url: info.instagram_url,
      settings: { ...event.settings, ...s, goals: parsedGoals },
    })
    if (ok) notify('Configurações salvas. As TVs já foram atualizadas.')
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    if (file.size > 5 * 1048576) return notify('A logo deve ter até 5 MB.', 'warn')
    setBusy('Enviando logo...')
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1] || 'png'
    const path = `${event.id}/logo-${uuid()}.${ext}`
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: false })
    setBusy('')
    if (error) return notify(friendlyError(error), 'error')
    const url = supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
    if (await updateEvent({ settings: { ...event.settings, logo_url: url } })) notify('Logo atualizada.')
  }

  async function closeEvent(close: boolean) {
    const msg = close
      ? 'Encerrar o evento? O QR Code deixa de registrar presenças e a página de memória digital é publicada.'
      : 'Reabrir o evento para novas presenças e publicações?'
    if (!window.confirm(msg)) return
    if (await updateEvent({ status: close ? 'closed' : 'active', settings: { ...event.settings, memories_public: close ? true : event.settings?.memories_public } }))
      notify(close ? 'Evento encerrado e memória digital publicada.' : 'Evento reaberto.')
  }

  async function deleteAllMedia() {
    if (!window.confirm('Apagar TODAS as fotos e vídeos deste evento, inclusive os aprovados? Isso não pode ser desfeito.')) return
    if (window.prompt('Para confirmar, digite APAGAR') !== 'APAGAR') return
    try {
      setBusy('Listando arquivos...')
      const files = await listEventFiles(event.id)
      await removeFiles(files, (n) => setBusy(`Apagando ${n} de ${files.length}...`))
      const { error } = await supabase.from('posts').delete().eq('event_id', event.id).in('kind', ['photo', 'video'])
      if (error) throw error
      notify(`${files.length} arquivos apagados.`)
    } catch (e) {
      notify(friendlyError(e), 'error')
    }
    setBusy('')
  }

  const scenes = { ...(s.scenes || {}) }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Informações do evento</h2>
        {(
          [
            ['name', 'Nome do evento'],
            ['institution', 'Instituição'],
            ['city', 'Município'],
            ['theme', 'Tema'],
            ['instagram_handle', 'Perfil do Instagram (com @)'],
            ['instagram_url', 'Link do Instagram'],
          ] as [keyof Info, string][]
        ).map(([k, label]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <input className="input" value={info[k]} onChange={set(k)} />
          </div>
        ))}
        <div>
          <label className="label">Programação</label>
          <textarea className="input min-h-[80px]" value={info.schedule} onChange={set('schedule')} />
        </div>
        <div>
          <label className="label">Mensagem de agradecimento (memória digital)</label>
          <textarea className="input min-h-[80px]" value={s.thank_you || ''} onChange={(e) => setS({ ...s, thank_you: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Telão</h2>
        <p className="text-sm text-white/60">Tempo de cada cena em segundos. Use 0 para desligar uma cena. Cenas sem conteúdo aprovado são puladas.</p>
        <div className="grid grid-cols-2 gap-3">
          {SCENES.map(([k, label, def]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input
                type="number"
                min={0}
                max={300}
                className="input"
                value={scenes[k] ?? def}
                onChange={(e) => setS({ ...s, scenes: { ...scenes, [k]: Math.max(0, Math.min(300, Number(e.target.value) || 0)) } })}
              />
            </div>
          ))}
        </div>
        <div>
          <label className="label">Metas de público para comemorar (separadas por vírgula)</label>
          <input className="input" value={goals} onChange={(e) => setGoals(e.target.value)} />
        </div>
        <Toggle label="Aprovar mensagens automaticamente" hint="Só as que passam no filtro de palavras." value={Boolean(s.auto_approve_messages)} onChange={(v) => setS({ ...s, auto_approve_messages: v })} />
        <Toggle label="Publicar a memória digital agora" hint="Normalmente é publicada ao encerrar o evento." value={Boolean(s.memories_public)} onChange={(v) => setS({ ...s, memories_public: v })} />
        <div>
          <label className="label">Prazo de guarda dos conteúdos (dias)</label>
          <input type="number" min={1} className="input" value={s.retention_days ?? 180} onChange={(e) => setS({ ...s, retention_days: Number(e.target.value) || 180 })} />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Identidade visual</h2>
        <p className="text-sm text-white/60">
          A identidade segue o convite oficial (azul royal, azul-marinho e dourado). Você pode trocar a logomarca exibida em todas as telas; envie a logo original
          da escola, sem alterações.
        </p>
        <div className="flex items-center gap-4">
          <img src={event.settings?.logo_url || `${import.meta.env.BASE_URL}brand/escudo.png`} alt="Logo atual" className="h-20 w-20 rounded-xl bg-white/5 object-contain" />
          <label className="btn-blue btn-sm cursor-pointer">
            Enviar nova logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
          </label>
          {event.settings?.logo_url && (
            <button className="btn-ghost btn-sm" onClick={() => void updateEvent({ settings: { ...event.settings, logo_url: undefined } })}>
              Voltar à logo padrão
            </button>
          )}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Encerramento e dados</h2>
        {event.status === 'closed' ? (
          <button className="btn-blue" onClick={() => void closeEvent(false)}>
            Reabrir evento
          </button>
        ) : (
          <button className="btn-red" onClick={() => void closeEvent(true)}>
            Encerrar o evento
          </button>
        )}
        <button className="btn-ghost text-red-200" onClick={() => void deleteAllMedia()} disabled={!!busy}>
          Apagar todas as fotos e vídeos deste evento
        </button>
        {busy && <p className="text-sm text-white/70">{busy}</p>}
      </section>

      <div className="sticky bottom-4 lg:col-span-2">
        <button className="btn-gold w-full text-lg shadow-2xl" onClick={() => void saveAll()}>
          Salvar configurações
        </button>
      </div>
    </div>
  )
}
