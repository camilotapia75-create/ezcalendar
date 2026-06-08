'use client'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getGroups(events) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const pad = n => String(n).padStart(2, '0')
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const todayKey = toKey(todayStart)
  const tom = new Date(todayStart); tom.setDate(todayStart.getDate() + 1)
  const tomorrowKey = toKey(tom)

  const future = [...events].filter(e => e.date >= todayKey).sort((a,b) => a.date.localeCompare(b.date))
  const past   = [...events].filter(e => e.date <  todayKey).sort((a,b) => a.date.localeCompare(b.date))

  const buckets = { Today: [], Tomorrow: [], 'This Week': [], 'Next Week': [], 'Coming Up': [] }
  future.forEach(e => {
    if (e.date === todayKey)    { buckets.Today.push(e); return }
    if (e.date === tomorrowKey) { buckets.Tomorrow.push(e); return }
    const diff = Math.floor((parseLocalDate(e.date) - todayStart) / 86400000)
    if (diff <= 7)  buckets['This Week'].push(e)
    else if (diff <= 14) buckets['Next Week'].push(e)
    else buckets['Coming Up'].push(e)
  })

  const groups = []
  Object.entries(buckets).forEach(([label, items]) => { if (items.length) groups.push({ label, items, past: false }) })
  if (past.length) groups.push({ label: 'Past', items: past, past: true })
  return groups
}

function DateBadge({ dateStr, endDateStr, accent, faded }) {
  const start = parseLocalDate(dateStr)
  const isMulti = endDateStr && endDateStr !== dateStr
  const bg = faded ? '#e5e5e5' : accent
  const fg = faded ? '#9ca3af' : '#fff'
  const fgSoft = faded ? '#bbb' : 'rgba(255,255,255,0.82)'
  const font = 'var(--font-inter), Inter, system-ui, sans-serif'

  if (isMulti) {
    const end = parseLocalDate(endDateStr)
    const sameMonth = end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear()
    const label = sameMonth
      ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
      : `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, borderRadius: 8, padding: '6px 10px', minWidth: 52 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: fgSoft, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1, fontFamily: font, marginBottom: 3 }}>MULTI-DAY</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: fg, lineHeight: 1.3, fontFamily: font, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, borderRadius: 8, padding: '6px 10px', minWidth: 44 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: fg, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, fontFamily: font }}>
        {MONTHS[start.getMonth()]}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: fg, lineHeight: 1.1, fontFamily: font }}>
        {start.getDate()}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: fgSoft, letterSpacing: '0.06em', fontFamily: font }}>
        {DAYS[start.getDay()]}
      </span>
    </div>
  )
}

function EventCard({ event, accent, onTap, onDelete, faded }) {
  return (
    <div onClick={onTap} style={{ marginBottom: 12, borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(0,0,0,0.10)', boxShadow: faded ? 'none' : '0 2px 12px rgba(0,0,0,0.10)', background: '#fff', cursor: 'pointer', opacity: faded ? 0.58 : 1, transition: 'opacity 0.2s' }}>
      {event.image_url && (
        <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '12px 14px 14px', position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <DateBadge dateStr={event.date} endDateStr={event.end_date} accent={accent} faded={faded} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {event.title && (
            <p style={{ margin: '0 0 5px', fontSize: 17, fontWeight: 700, color: '#111', lineHeight: 1.25, paddingRight: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.title}
            </p>
          )}
          {!event.image_url && (
            <p style={{ margin: '0 0 5px', fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>No flyer image</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
            {event.time_str && (
              <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 11 }}>🕐</span> {event.time_str}
              </span>
            )}
            {event.location && (
              <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                <span style={{ fontSize: 11 }}>📍</span> {event.location}
              </span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id) }}
          style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.80)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

export default function FeedView({ events, accent, onEventTap, onDeleteEvent, onScan, dark }) {
  const groups = getGroups(events)

  const headingColor  = dark ? '#e2e8f0' : '#111'
  const dividerColor  = dark ? 'rgba(255,255,255,0.18)' : '#111'
  const dividerMuted  = dark ? 'rgba(255,255,255,0.08)' : '#e5e5e5'

  if (events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 130px)', padding: 40, textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>📸</div>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: headingColor, margin: 0 }}>Nothing pinned yet</h2>
        <p style={{ fontSize: 17, color: dark ? '#9ca3af' : '#7c6a56', margin: 0, maxWidth: 260, lineHeight: 1.5 }}>See a flyer? Snap it and it shows up here.</p>
        <button onClick={onScan}
          style={{ marginTop: 8, padding: '12px 30px', background: dark ? '#e2e8f0' : '#1a1a2e', color: dark ? '#0d0d14' : '#fff', border: dark ? '2px solid rgba(255,255,255,0.15)' : '2px solid #1a1a2e', borderRadius: 6, boxShadow: `3px 3px 0 ${accent}`, fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
          📷 Scan a flyer
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 12px 20px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      {groups.map((group, gi) => (
        <div key={group.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: gi > 0 ? 24 : 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: group.past ? '#9ca3af' : headingColor, whiteSpace: 'nowrap', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>
              {group.label}
            </span>
            <div style={{ height: 1.5, background: group.past ? dividerMuted : dividerColor, flex: 1 }} />
          </div>
          {group.items.map(event => (
            <EventCard key={event.id} event={event} accent={accent} faded={group.past}
              onTap={() => onEventTap(event)}
              onDelete={onDeleteEvent}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
