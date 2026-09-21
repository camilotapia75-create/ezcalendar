// The ezcalendar wordmark as one reusable lockup so the brand looks identical
// everywhere. Two-tone: "ez" pops in the lime accent, "calendar" in the text
// color, tight tracking and a weight step so it reads as a designed logo rather
// than plain text. No hooks — safe in both server and client components.
export default function Wordmark({
  size = 22,
  color = 'var(--text)',
  accent = '#c6f24e',
  pin = false,
  style = {},
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.34,
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.045em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {pin && <span aria-hidden style={{ fontSize: size * 0.8, letterSpacing: 0 }}>📌</span>}
      <span>
        <span style={{ color: accent, fontWeight: 800 }}>ez</span>
        <span style={{ color }}>calendar</span>
      </span>
    </span>
  )
}
