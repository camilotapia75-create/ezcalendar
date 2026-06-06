'use client'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
  const past   = [...events].filter(e => e.date <  todayKey).sort((a,b) => b.date.localeCompare(a.date))

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

function EventCard({ event, accent, onTap, onDelete, faded }) {
  const d = parseLocalDate(event.date)
  return (
    <div onClick={onTap} style={{ marginBottom: 20, borderRadius: 6, overflow: 'hidden', border: '2px solid #111', boxShadow: '3px 3px 0 rgba(0,0,0,0.20)', background: '#fff', cursor: 'pointer', opacity: faded ? 0.62 : 1 }}>
      {event.image_url ? (
        <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', maxHeight: 440, objectFit: 'cover', display: 'block', borderBottom: '2px solid #111' }} />
      ) : (
        <div style={{ width: '100%', height: 200, background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid #111' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: accent, textAlign: 'center', padding: '0 24px', lineHeight: 1.3 }}>{event.title || 'Event'}</p>
        </div>
      )}
      <div style={{ padding: '12px 14px', position: 'relative', background: '#fffdf8' }}>
        {event.title && <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111', lineHeight: 1.2, paddingRight: 30 }}>{event.title}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>📅 {DAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}</span>
          {event.time_str  && <span style={{ fontSize: 14, color: '#6b7280' }}>🕐 {event.time_str}</span>}
          {event.location  && <span style={{ fontSize: 14, color: '#6b7280' }}>📍 {event.location}</span>}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id) }}
          style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>
    </div>
  )
}

export default function FeedView({ events, accent, onEventTap, onDeleteEvent, onScan }) {
  const groups = getGroups(events)

  if (events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 130px)', padding: 40, textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>📸</div>
        <h2 style={{ fontSize: 30, fontWeight: 700, color: '#111', margin: 0 }}>Nothing pinned yet</h2>
        <p style={{ fontSize: 17, color: '#7c6a56', margin: 0, maxWidth: 260, lineHeight: 1.5 }}>See a flyer? Snap it and it shows up here.</p>
        <button onClick={onScan}
          style={{ marginTop: 8, padding: '12px 30px', background: '#1a1a2e', color: '#fff', border: '2px solid #1a1a2e', borderRadius: 6, boxShadow: `3px 3px 0 ${accent}`, fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
          📷 Scan a flyer
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 14px 20px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      {groups.map((group, gi) => (
        <div key={group.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: gi > 0 ? 28 : 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: group.past ? '#9ca3af' : '#111', whiteSpace: 'nowrap', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>
              {group.label}
            </span>
            <div style={{ height: 1.5, background: group.past ? '#e5e5e5' : '#111', flex: 1 }} />
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
