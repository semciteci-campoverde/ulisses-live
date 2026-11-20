const STARS: Array<[number, number, number]> = [
  [8, 10, 0], [16, 28, 0.8], [28, 8, 1.4], [70, 6, 0.4], [82, 18, 1.1],
  [90, 40, 0.2], [62, 22, 1.7], [40, 14, 0.6], [6, 46, 1.2], [94, 64, 0.9],
  [22, 62, 0.3], [50, 72, 1.5], [76, 78, 0.7], [34, 40, 1.9],
]

export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      {STARS.map(([left, top, delay]) => (
        <span key={`${left}-${top}`} className="star" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }} />
      ))}
      <div className="orb orb-a" />
      <div className="atom">
        <i />
        <b />
        <span />
      </div>
    </div>
  )
}

export function SchoolLogo({ src, className }: { src?: string | null; className?: string }) {
  return (
    <img
      src={src || '/brand/logo.png'}
      alt="Logomarca da Escola Estadual Cívico-Militar Ulisses Guimarães"
      className={className}
    />
  )
}
