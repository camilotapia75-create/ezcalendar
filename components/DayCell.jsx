const EMOJI_PINS = {
  star: '⭐', heart: '❤️', flower: '🌸', gem: '💎',
  ribbon: '🎀', butterfly: '🦋', moon: '🌙',
  fire: '🔥', rainbow: '🌈', lightning: '⚡', sparkle: '✨',
}

const Pin = ({ styleId }) => {
  if (!styleId || styleId === 'classic') {
    return (
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none' }}>
        <svg width="13" height="17" viewBox="0 0 13 17" fill="none">
          <circle cx="6.5" cy="5" r="5" fill="#ef4444" />
          <circle cx="4.8" cy="3.2" r="1.8" fill="rgba(255,255,255,0.32)" />
          <line x1="6.5" y1="9.5" x2="6.5" y2="16.5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none', fontSize: 14, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>
      {EMOJI_PINS[styleId] || '📌'}
    </div>
  )
}

const getFanStyle = (idx, total) => {
  if (total === 1) return { left: '6%', right: '6%', rotate: -1 }
  if (total === 2) return idx === 0
    ? { left: '-4%', right: '32%', rotate: -9 }
    : { left: '32%', right: '-4%', rotate: 9 }
  if (idx === 0) return { left: '-6%', right: '44%', rotate: -13 }
  if (idx === 1) return { left: '17%', right: '17%', rotate: 1 }
  return { left: '44%', right: '-6%', rotate: 13 }
}

export default function DayCell({ day, currentMonth, isToday, isWeekend, events, hasNote, onClick, onEventClick, theme, pinStyle }) {
  const displayed = events.slice(0, 3)
  const count = displayed.length
  const accent = theme?.accent || '#7c3aed'
  const dark = theme?.dark

  const numColor = isToday ? '#fff'
    : !currentMonth ? (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)')
    : isWeekend ? accent
    : (dark ? '#d4d4d8' : '#1a1a2e')

  return (
    <div
      onClick={onClick}
      className={[
        'relative flex flex-col',
        'min-h-[88px] md:min-h-[112px]',
        currentMonth ? 'cursor-pointer' : 'pointer-events-none',
      ].join(' ')}
      style={{
        borderRight: dark ? '2px solid rgba(255,255,255,0.08)' : '2px solid #1a1a2e',
        borderBottom: dark ? '2px solid rgba(255,255,255,0.08)' : '2px solid #1a1a2e',
        background: !currentMonth ? (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)') : 'transparent',
      }}
    >
      <div style={{ padding: '5px 5px 3px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            width: isToday ? 26 : 'auto',
            height: isToday ? 26 : 'auto',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isToday ? '50%' : undefined,
            background: isToday ? accent : 'transparent',
            color: numColor,
            fontSize: 'clamp(14px, 2.8vw, 20px)',
            fontWeight: isWeekend || isToday ? 800 : 600,
            lineHeight: 1,
            letterSpacing: '-0.5px',
            fontFamily: 'var(--font-caveat), Caveat, cursive',
          }}
        >
          {day}
        </span>
        {hasNote && currentMonth && (
          <span style={{ fontSize: 9, lineHeight: 1, opacity: 0.6 }}>📝</span>
        )}
      </div>

      {count > 0 && (
        <div className="flex-1 relative">
          <button
            onClick={(e) => { e.stopPropagation(); onEventClick() }}
            className="absolute inset-0"
            style={{ overflow: 'visible' }}
          >
            {displayed.map((event, idx) => {
              const s = getFanStyle(idx, count)
              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={{ left: s.left, right: s.right, bottom: 10, height: 54, transform: `rotate(${s.rotate}deg)`, zIndex: idx + 1 }}
                >
                  <Pin styleId={pinStyle} />
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      className="w-full h-full object-cover rounded"
                      style={{ border: '2.5px solid white', boxShadow: '0 3px 12px rgba(0,0,0,0.22)' }}
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded flex items-center justify-center px-1"
                      style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}44)`, border: `1.5px solid ${accent}66`, boxShadow: `0 2px 8px ${accent}25` }}
                    >
                      <p className="text-[8px] font-semibold text-center" style={{ color: accent }}>{event.title}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </button>
          {events.length > 3 && (
            <div
              className="absolute top-0 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: accent, zIndex: 20 }}
            >
              +{events.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
