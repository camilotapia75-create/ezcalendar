'use client'

import React from 'react'

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

  // A multi-day event isn't "past" until its LAST day passes, so key off the
  // end date (falling back to start). This keeps events that span today in the
  // upcoming feed instead of dropping them into Past.
  const endKey = e => e.end_date || e.date
  const future = [...events].filter(e => endKey(e) >= todayKey).sort((a,b) => a.date.localeCompare(b.date))
  const past   = [...events].filter(e => endKey(e) <  todayKey).sort((a,b) => a.date.localeCompare(b.date))

  const buckets = { Today: [], Tomorrow: [], 'This Week': [], 'Next Week': [], 'Coming Up': [] }
  future.forEach(e => {
    // Happening today = started on/before today AND ends on/after today
    // (covers single-day events today and multi-day events spanning today)
    if (e.date <= todayKey && endKey(e) >= todayKey) { buckets.Today.push(e); return }
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

function NoFlyer({ accent }) {
  return (
    <div style={{ width: '100%', height: 88, background: `linear-gradient(135deg, ${accent}14 0%, ${accent}28 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderBottom: `1px solid ${accent}20` }}>
      <span style={{ fontSize: 28, lineHeight: 1, filter: 'grayscale(0.2)' }}>📌</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>No flyer</span>
    </div>
  )
}

function EventCard({ event, accent, onTap, onDelete, faded, animIndex = 0 }) {
  const [imgFailed, setImgFailed] = React.useState(false)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  return (
    <div onClick={onTap} className={faded ? undefined : 'anim-card'} style={{ animationDelay: `${Math.min(animIndex, 10) * 45}ms`, marginBottom: 12, borderRadius: 14, overflow: 'hidden', border: '1.5px solid #e8ddd0', boxShadow: faded ? 'none' : '3px 3px 0 rgba(140,100,60,0.12)', background: '#fffdf8', cursor: 'pointer', opacity: faded ? 0.58 : 1, transition: 'opacity 0.2s' }}>
      {event.image_url && !imgFailed ? (
        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3' }}>
          {!imgLoaded && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(90deg, ${accent}12 0%, ${accent}28 50%, ${accent}12 100%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.6s ease-in-out infinite',
            }} />
          )}
          <img
            src={event.image_url}
            alt={event.title || ''}
            onError={() => setImgFailed(true)}
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block',
              opacity: imgLoaded ? 1 : 0,
              filter: imgLoaded ? 'none' : 'blur(12px)',
              transform: imgLoaded ? 'scale(1)' : 'scale(1.06)',
              transition: 'opacity 0.45s ease, filter 0.45s ease, transform 0.45s ease',
            }}
          />
        </div>
      ) : (
        <NoFlyer accent={accent} />
      )}
      <div style={{ padding: '12px 14px 14px', position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <DateBadge dateStr={event.date} endDateStr={event.end_date} accent={accent} faded={faded} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {event.title && (
            <p style={{ margin: '0 0 5px', fontSize: 17, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.25, paddingRight: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.title}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {event.time_str && (
              <span style={{ fontSize: 15, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13 }}>🕐</span> {event.time_str}
              </span>
            )}
            {event.location && (
              <span style={{ fontSize: 14, fontWeight: 500, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                <span style={{ fontSize: 13 }}>📍</span> {event.location}
              </span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id) }} title="Remove event"
          style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: 'rgba(26,26,46,0.10)', border: 'none', cursor: 'pointer', color: '#7c6a56', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

export default function FeedView({ events, accent, onEventTap, onDeleteEvent, onScan, dark }) {
  const groups = getGroups(events)

  const headingColor  = dark ? '#e2e8f0' : '#1a1a2e'
  const dividerColor  = dark ? 'rgba(255,255,255,0.18)' : '#1a1a2e'
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

  let cardIndex = 0
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
              animIndex={cardIndex++}
              onTap={() => onEventTap(event)}
              onDelete={onDeleteEvent}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
