// One calendar day: a rounded square. Event days show the flyer as the cell
// background with the day number overlaid; empty days are a dark surface.
export default function DayCell({ day, currentMonth, isToday, events, hasNote, onClick, theme }) {
  const accent = theme?.accent || '#c6f24e'
  const ev = events[0]
  const img = ev?.image_url
  const extra = events.length - 1

  const numColor = isToday ? accent : img ? '#fff' : currentMonth ? 'var(--text-2)' : 'var(--text-3)'

  return (
    <button
      onClick={onClick}
      disabled={!currentMonth}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 14,
        overflow: 'hidden',
        border: 'none',
        padding: 0,
        cursor: currentMonth ? 'pointer' : 'default',
        background: img ? '#161619' : currentMonth ? 'var(--surface)' : 'rgba(255,255,255,0.02)',
        opacity: currentMonth ? 1 : 0.4,
        outline: isToday ? `2px solid ${accent}` : 'none',
        outlineOffset: -2,
      }}
    >
      {img && (
        <>
          <img src={img} alt={ev.title || ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 42%, transparent 68%, rgba(0,0,0,0.4) 100%)' }} />
        </>
      )}
      <span className="mono-label" style={{ position: 'absolute', top: 6, left: 8, fontSize: 13, fontWeight: 700, color: numColor, letterSpacing: 0, textShadow: img ? '0 1px 3px rgba(0,0,0,0.6)' : 'none' }}>
        {day}
      </span>
      {isToday && <span style={{ position: 'absolute', top: 9, right: 8, width: 6, height: 6, borderRadius: '50%', background: accent }} />}
      {hasNote && currentMonth && !img && (
        <span style={{ position: 'absolute', bottom: 7, left: 8, width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)' }} />
      )}
      {extra > 0 && (
        <span className="mono-label" style={{ position: 'absolute', bottom: 5, right: 7, fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          +{extra}
        </span>
      )}
    </button>
  )
}
