import { Link } from 'react-router-dom'
import { InstagramIcon, Logo, QR, qrDataUrl, Spinner } from '../components/ui'
import { participantUrl, useEvent } from '../lib/hooks'

async function download(value: string, filename: string, dark?: string) {
  const url = await qrDataUrl(value, 1600, dark)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export default function QRPage() {
  const { event, loading, error } = useEvent()
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (!event) return <p className="p-8 text-center">{error}</p>
  const link = participantUrl(event.slug)

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center gap-2 px-4">
        <button className="btn-gold" onClick={() => window.print()}>
          Imprimir
        </button>
        <button className="btn-blue" onClick={() => void download(link, `qr-presenca-${event.slug}.png`)}>
          Baixar QR de presença (PNG)
        </button>
        {event.instagram_url && (
          <button className="btn-ghost bg-navy-800" onClick={() => void download(event.instagram_url, 'qr-instagram.png', '#5b2a86')}>
            Baixar QR do Instagram (PNG)
          </button>
        )}
        <Link to={`/?e=${event.slug}`} className="ml-auto text-sm text-navy-800 underline">
          Voltar
        </Link>
        <p className="w-full break-all text-xs text-navy-800">Link do QR: {link}</p>
      </div>

      {/* Folha 1: presença */}
      <section className="print-page mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-gradient-to-b from-navy-800 via-royal-700 to-navy-900 text-white shadow-2xl print:shadow-none">
        <div className="flex items-center gap-4 px-[14mm] pt-[12mm]">
          <Logo event={event} className="h-[28mm] w-[28mm]" />
          <div>
            <p className="font-display text-[11pt] font-bold uppercase tracking-[.25em] text-gold-300">Ulisses Live</p>
            <h1 className="font-display text-[22pt] font-black leading-tight text-gold">{event.name}</h1>
            <p className="text-[11pt] text-white/80">{event.institution}</p>
          </div>
        </div>
        <div className="mt-[10mm] text-center">
          <p className="font-display text-[34pt] font-black leading-tight">
            <span className="text-silver">Escaneie.</span> <span className="text-gold">Participe.</span>
            <br />
            <span className="text-silver">Compartilhe.</span>
          </p>
        </div>
        <div className="mx-auto mt-[8mm] rounded-[8mm] bg-white p-[6mm] shadow-[0_0_40px_rgba(242,201,76,.5)] ring-[3mm] ring-gold-400">
          <QR value={link} size={1200} className="h-[105mm] w-[105mm]" alt="QR Code de presença" />
        </div>
        <p className="mt-[8mm] px-[14mm] text-center font-display text-[17pt] font-bold">Registre sua presença e faça parte da nossa história!</p>
        <p className="mt-[3mm] px-[18mm] text-center text-[11pt] text-white/80">
          Sem cadastro e sem senha. Envie mensagens, fotos, vídeos e reações para o telão da feira.
        </p>
        <p className="mt-auto pb-[10mm] text-center font-script text-[20pt] text-gold-200">Sua presença. Seu olhar. Nossa história.</p>
      </section>

      {/* Folha 2: Instagram */}
      {event.instagram_url && (
        <section className="mx-auto mt-6 flex h-[297mm] w-[210mm] flex-col items-center overflow-hidden bg-white text-[#2b1640] shadow-2xl print:mt-0 print:shadow-none">
          <div className="h-[8mm] w-full bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#4f5bd5]" />
          <Logo event={event} className="mt-[14mm] h-[30mm] w-[30mm]" />
          <h2 className="mt-[8mm] text-center font-display text-[30pt] font-black leading-tight">
            Conecte-se com a<br />
            nossa escola!
          </h2>
          <div className="mt-[10mm] rounded-[9mm] bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[3mm]">
            <div className="rounded-[7mm] bg-white p-[6mm]">
              <QR value={event.instagram_url} size={1200} dark="#5b2a86" className="h-[95mm] w-[95mm]" alt="QR Code do Instagram" />
            </div>
          </div>
          <p className="mt-[8mm] flex items-center gap-2 font-display text-[20pt] font-extrabold">
            <InstagramIcon className="h-[9mm] w-[9mm]" /> {event.instagram_handle}
          </p>
          <p className="mt-[5mm] max-w-[150mm] text-center text-[13pt] leading-snug text-[#4a3560]">
            Acompanhe nossos projetos, atividades, conquistas e eventos. Confira também os melhores momentos da {event.name} em nosso Instagram.
          </p>
          <div className="mt-auto h-[8mm] w-full bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#4f5bd5]" />
        </section>
      )}
    </div>
  )
}
