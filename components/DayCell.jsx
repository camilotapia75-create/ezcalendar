// One calendar day: a rounded square. Event days with a flyer show it as the cell
// background; event days without a flyer fill the cell with the event title;
// empty days are a plain dark surface.
export default function DayCell({ day, currentMonth, isToday, events, hasNote, onClick, theme }) {
  const accent = theme?.accent || '#c6f24e'
  const ev = events[0]
  const img = ev?.image_url
  const hasEvent = !!ev
  const titleOnly = hasEvent && !img
  const extra = events.length - 1

  const numColor = isToday ? accent : img ? '#fff' : currentMonth ? 'var(--text-2)' : 'var(--text-3)'

  const background = img
    ? '#161619'
    : titleOnly
      ? `linear-gradient(160deg, ${accent}30 0%, ${accent}10 60%, transparent 100%), var(--surface)`
      : currentMonth ? 'var(--surface)' : 'var(--surface-2)'

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
        background,
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
      <span className="mono-label" style={{ position: 'absolute', top: 6, left: 8, fontSize: 13, fontWeight: 700, color: numColor, letterSpacing: 0, textShadow: img ? '0 1px 3px rgba(0,0,0,0.6)' : 'none', zIndex: 2 }}>
        {day}
      </span>
      {/* No-flyer event: title fills the cell body */}
      {titleOnly && ev.title && (
        <span style={{ position: 'absolute', top: 22, left: 5, right: 5, bottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.12, letterSpacing: '-0.01em', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
            {ev.title}
          </span>
        </span>
      )}
      {isToday && <span style={{ position: 'absolute', top: 9, right: 8, width: 6, height: 6, borderRadius: '50%', background: accent, zIndex: 2 }} />}
      {hasNote && currentMonth && !hasEvent && (
        <span style={{ position: 'absolute', bottom: 7, left: 8, width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)' }} />
      )}
      {/* More than one event: folded lime "dog-ear" corner with the extra count */}
      {extra > 0 && (
        <>
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, background: accent, clipPath: 'polygon(100% 0, 0 100%, 100% 100%)', zIndex: 2, boxShadow: '-1px -1px 3px rgba(0,0,0,0.35)' }} />
          <span className="mono-label" style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 9, fontWeight: 800, color: '#0a0a0b', zIndex: 3, letterSpacing: 0 }}>
            +{extra}
          </span>
        </>
      )}
    </button>
  )
}
