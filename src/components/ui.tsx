import { useEffect, useMemo, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import type { EventRow } from '../lib/types'

export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`

export function logoFor(event?: EventRow | null) {
  return event?.settings?.logo_url || asset('brand/escudo.png')
}

export function Logo({ event, className = '' }: { event?: EventRow | null; className?: string }) {
  return (
    <img
      src={logoFor(event)}
      alt="Brasão da EECM Ulisses Guimarães"
      className={`rounded-2xl object-contain shadow-[0_0_30px_rgba(79,139,255,.35)] ${className}`}
    />
  )
}

/** Fundo animado com brilhos, órbitas e partículas (leve, apenas CSS). */
export function Backdrop({ intense = false }: { intense?: boolean }) {
  const dots = useMemo(
    () =>
      Array.from({ length: intense ? 46 : 26 }, (_, i) => ({
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        size: 1 + ((i * 7) % 3),
        delay: (i % 10) * 0.6,
      })),
    [intense],
  )
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-[20%] -top-[30%] h-[80vmax] w-[80vmax] rounded-full bg-royal-500/25 blur-[120px]" />
      <div className="absolute -bottom-[30%] -right-[10%] h-[70vmax] w-[70vmax] rounded-full bg-royal-700/30 blur-[120px]" />
      <div className="absolute left-1/2 top-1/3 h-[40vmax] w-[40vmax] -translate-x-1/2 rounded-full bg-gold-400/10 blur-[100px]" />
      <svg className="absolute right-[4%] top-[8%] h-[22vmin] w-[22vmin] animate-float opacity-40" viewBox="0 0 100 100">
        <g fill="none" stroke="#86b0ff" strokeWidth="1.4">
          <ellipse cx="50" cy="50" rx="44" ry="16" />
          <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)" />
          <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)" />
        </g>
        <circle cx="50" cy="50" r="6" fill="#f2c94c" />
      </svg>
      <svg className="absolute bottom-[10%] left-[3%] h-[16vmin] w-[16vmin] animate-float opacity-30 [animation-delay:1.5s]" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="22" fill="none" stroke="#f2c94c" strokeWidth="1.5" />
        <ellipse cx="50" cy="50" rx="46" ry="12" fill="none" stroke="#86b0ff" strokeWidth="1.5" transform="rotate(-18 50 50)" />
      </svg>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute animate-pulse rounded-full bg-white"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, opacity: 0.55 }}
        />
      ))}
    </div>
  )
}

export function QR({
  value,
  size = 512,
  dark = '#06153d',
  light = '#ffffff',
  className = '',
  alt = 'QR Code',
}: {
  value: string
  size?: number
  dark?: string
  light?: string
  className?: string
  alt?: string
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'H', color: { dark, light } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value, size, dark, light])
  return src ? <img src={src} alt={alt} className={className} /> : <div className={`animate-pulse bg-white/20 ${className}`} />
}

export async function qrDataUrl(value: string, size = 1200, dark = '#06153d') {
  return QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'H', color: { dark, light: '#ffffff' } })
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-white/80">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-gold-400" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/80 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative max-h-[92dvh] w-full max-w-lg animate-fadeUp overflow-y-auto rounded-t-3xl border border-white/15 bg-gradient-to-b from-navy-800 to-navy-900 p-5 pb-8 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20" aria-label="Fechar">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, tone = 'ok', onDone }: { message: string; tone?: 'ok' | 'warn' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 5000)
    return () => window.clearTimeout(t)
  }, [message, onDone])
  const color = tone === 'ok' ? 'bg-emerald-600' : tone === 'warn' ? 'bg-amber-600' : 'bg-red-600'
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" role="status">
      <div className={`max-w-md animate-pop rounded-2xl px-5 py-3 text-center font-semibold shadow-2xl ${color}`}>{message}</div>
    </div>
  )
}

export function EmojiPicker({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {options.map((e) => (
        <button
          type="button"
          key={e}
          onClick={() => onChange(value === e ? '' : e)}
          className={`aspect-square rounded-xl text-2xl transition ${value === e ? 'scale-110 bg-gold-400/30 ring-2 ring-gold-400' : 'bg-white/5 hover:bg-white/10'}`}
          aria-pressed={value === e}
          aria-label={`Emoji ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

export function InstagramIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="glass max-w-md p-8">
        <h1 className="font-display text-2xl font-extrabold">Sistema em configuração</h1>
        <p className="mt-3 text-white/70">O endereço do banco de dados ainda não foi definido nesta publicação.</p>
      </div>
    </div>
  )
}
