import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrImage({
  value,
  label,
  dark = '#071433',
  light = '#ffffff',
  className,
}: {
  value: string
  label: string
  dark?: string
  light?: string
  className?: string
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { width: 640, margin: 1, color: { dark, light }, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (alive) setSrc(url)
      })
      .catch(() => {
        if (alive) setSrc('')
      })
    return () => {
      alive = false
    }
  }, [value, dark, light])
  if (!src) return <div className={className} style={{ width: 180, height: 180, background: '#fff' }} />
  return <img src={src} alt={label} className={className} />
}
