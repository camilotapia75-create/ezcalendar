// The FLYRLY wordmark as one reusable lockup so the brand looks identical
// everywhere: the lime calendar mark + "FLYRLY". No hooks — safe in both server
// and client components.
export default function Wordmark({
  size = 22,
  color = 'var(--text)',
  accent = '#c6f24e',
  icon = true,
  style = {},
}) {
  const box = Math.round(size * 1.15)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.34,
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <CalendarMark size={box} accent={accent} />}
      <span style={{ color }}>FLYRLY</span>
    </span>
  )
}

// Lime calendar glyph: two binding posts, a rounded body with a folded corner,
// and a bold "20" — matches the FLYRLY app icon.
export function CalendarMark({ size = 26, accent = '#c6f24e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {/* binding posts */}
      <circle cx="42" cy="14" r="9" fill={accent} />
      <circle cx="78" cy="14" r="9" fill={accent} />
      {/* body */}
      <path d="M14 40 a16 16 0 0 1 16 -16 h60 l16 16 v54 a16 16 0 0 1 -16 16 H30 a16 16 0 0 1 -16 -16 Z" fill={accent} />
      {/* folded corner */}
      <path d="M90 24 l16 16 h-16 Z" fill="#0a0a0b" opacity="0.28" />
      {/* number */}
      <text x="58" y="92" textAnchor="middle" fontFamily="var(--font-display), system-ui, sans-serif" fontSize="52" fontWeight="800" fill="#0a0a0b" letterSpacing="-2">20</text>
    </svg>
  )
}
