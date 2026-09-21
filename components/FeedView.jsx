'use client'

import React from 'react'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// A self-contained flyer for the first-run sample card — no network fetch, so it
// always renders and the app never looks "unfinished" on a brand-new account.
const SAMPLE_FLYER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12140c"/><stop offset="1" stop-color="#1e2410"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="640" cy="140" r="150" fill="#bcea47" opacity="0.18"/><circle cx="150" cy="500" r="120" fill="#bcea47" opacity="0.10"/><text x="60" y="150" font-family="Georgia,serif" font-size="30" fill="#bcea47" letter-spacing="8">LIVE • ROOFTOP</text><text x="60" y="250" font-family="Georgia,serif" font-weight="bold" font-size="76" fill="#f4f7ec">Sunset</text><text x="60" y="330" font-family="Georgia,serif" font-weight="bold" font-size="76" fill="#f4f7ec">Session</text><rect x="60" y="380" width="220" height="4" fill="#bcea47"/><text x="60" y="450" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="#cdd3c2">7:30 PM · The Lookout</text><text x="60" y="500" font-family="Helvetica,Arial,sans-serif" font-size="26" fill="#9aa38b">Downtown</text></svg>`)

// The single first-run sample event. Placed a few days out so it lands in an
// upcoming bucket. id is a sentinel and it is NEVER written to Supabase.
function makeSampleEvent() {
  const d = new Date(); d.setDate(d.getDate() + 3)
  const pad = n => String(n).padStart(2, '0')
  return {
    id: '__sample__',
    sample: true,
    title: 'Rooftop Live: Sunset Session',
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time_str: '7:30 PM',
    location: 'The Lookout, Downtown',
    image_url: SAMPLE_FLYER,
  }
}

function SampleExplainer({ accent, onScan, onClose }) {
  return (
    <div onClick={onClose} className="anim-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--overlay)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="anim-modal"
        style={{ width: '100%', maxWidth: 380, borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', padding: '26px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 46, lineHeight: 1 }}>👋</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: '12px 0 8px' }}>This one&apos;s just a sample</h2>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 18px' }}>
          Your real events will look just like it. Snap a flyer — a poster, a screenshot, an Instagram post — and ezcalendar reads the date, time, and place automatically and pins it here. Tap any event to add it to Google or Apple Calendar.
        </p>
        <button onClick={() => { onClose(); onScan?.() }} className="btn-lime"
          style={{ width: '100%', padding: '14px', fontSize: 17, cursor: 'pointer' }}>
          📷 Scan your first flyer
        </button>
        <button onClick={onClose} className="btn-dark"
          style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, marginTop: 8, cursor: 'pointer' }}>
          Got it
        </button>
      </div>
    </div>
  )
}

function getGroups(events) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const pad = n => String(n).padStart(2, '0')
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const todayKey = toKey(todayStart)
  const tom = new Date(todayStart); tom.setDate(todayStart.getDate() + 1)
  const tomorrowKey = toKey(tom)

  const endKey = e => e.end_date || e.date
  const future = [...events].filter(e => endKey(e) >= todayKey).sort((a,b) => a.date.localeCompare(b.date))
  const past   = [...events].filter(e => endKey(e) <  todayKey).sort((a,b) => a.date.localeCompare(b.date))

  const buckets = { Today: [], Tomorrow: [], 'This Week': [], 'Next Week': [], 'Coming Up': [] }
  future.forEach(e => {
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
  const bg = faded ? 'rgba(255,255,255,0.08)' : accent
  const fg = faded ? 'var(--text-3)' : '#0a0a0b'
  const fgSoft = faded ? 'var(--text-3)' : 'rgba(10,10,11,0.62)'
  const font = 'var(--font-mono-stack)'

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

// No image: the title fills the hero zone (gig-poster style) so the card doesn't
// look empty — and the title is NOT repeated in the details row below.
function TitleHero({ title, accent }) {
  return (
    <div style={{ width: '100%', position: 'relative', paddingTop: '75%', background: 'linear-gradient(145deg, #d4f560 0%, #bcea47 42%, #8fbf2e 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 18px 20px' }}>
        <p style={{ margin: 0, paddingBottom: 4, fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#0a0a0b', lineHeight: 1.18, letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title || 'Event'}
        </p>
      </div>
    </div>
  )
}

function EventCard({ event, accent, onTap, onDelete, faded, animIndex = 0, inSlideshow }) {
  const [imgFailed, setImgFailed] = React.useState(false)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const hasImg = event.image_url && !imgFailed
  return (
    <div onClick={onTap} className={faded ? undefined : 'anim-card'} style={{ animationDelay: `${Math.min(animIndex, 10) * 45}ms`, marginBottom: inSlideshow ? 0 : 12, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: faded ? 'none' : '0 8px 24px rgba(0,0,0,0.35)', background: 'var(--surface)', cursor: 'pointer', opacity: faded ? 0.5 : 1, transition: 'opacity 0.2s' }}>
      {hasImg ? (
        // Padding-top 75% = 4:3 ratio; works on all browsers including old iOS (unlike aspect-ratio CSS)
        <div style={{ position: 'relative', overflow: 'hidden', paddingTop: '75%' }}>
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
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top', display: 'block',
              opacity: imgLoaded ? 1 : 0,
              filter: imgLoaded ? 'none' : 'blur(12px)',
              transform: imgLoaded ? 'scale(1)' : 'scale(1.06)',
              transition: 'opacity 0.45s ease, filter 0.45s ease, transform 0.45s ease',
            }}
          />
          {event.sample && (
            <span className="mono-label" style={{ position: 'absolute', top: 12, left: 12, zIndex: 2, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#0a0a0b', background: accent, borderRadius: 999, padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
              SAMPLE
            </span>
          )}
        </div>
      ) : (
        <TitleHero title={event.title} accent={accent} />
      )}
      <div style={{ padding: '12px 14px 14px', position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: inSlideshow ? 96 : undefined }}>
        <DateBadge dateStr={event.date} endDateStr={event.end_date} accent={accent} faded={faded} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title only shown here when the image is the hero — otherwise it lives in TitleHero */}
          {hasImg && event.title && (
            <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em', paddingRight: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.title}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: hasImg ? 2 : 0 }}>
            {event.time_str && (
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12 }}>🕐</span> {event.time_str}
              </span>
            )}
            {event.location && (
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                <span style={{ fontSize: 12 }}>📍</span> {event.location}
              </span>
            )}
            {!hasImg && !event.time_str && !event.location && (
              <span className="mono-label" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>TAP TO EDIT DETAILS</span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id) }} title="Remove event"
          style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// Horizontal slideshow for Today and This Week.
// Continuous smooth auto-scroll: a requestAnimationFrame loop nudges scrollLeft
// by a fraction of a pixel each frame for a slow, constant glide (no stepped
// jumps). Items are duplicated once so the wrap-around is seamless — when the
// scroll passes the width of one full set, we subtract that width and the
// identical second set makes it invisible. Manual swipe uses the native scroll
// container and pauses the auto-glide; dots reflect the current card.
const GLIDE_PX_PER_FRAME = 0.45  // ≈ 27px/sec at 60fps — slow and smooth

function SlideShow({ items, accent, onEventTap, onDeleteEvent }) {
  const scrollRef  = React.useRef(null)
  const rafRef     = React.useRef(0)
  const posRef     = React.useRef(0)
  const touching   = React.useRef(false)
  const resumeRef  = React.useRef(null)
  const idxRef     = React.useRef(0)
  const [activeIdx, setActiveIdx] = React.useState(0)
  const n = items.length
  const loop = n > 1

  // Duplicate the list so the loop point is seamless
  const rendered = loop ? [...items, ...items] : items

  const metrics = () => {
    const el = scrollRef.current
    const first = el?.firstElementChild
    const card = first ? first.offsetWidth : 0
    const gap = 12
    return { card, gap, one: (card + gap) * n }
  }

  React.useEffect(() => {
    if (!loop) return
    const el = scrollRef.current
    if (!el) return

    posRef.current = el.scrollLeft

    const tick = () => {
      const { card, gap, one } = metrics()
      if (one > 0 && !touching.current) {
        posRef.current += GLIDE_PX_PER_FRAME
        if (posRef.current >= one) posRef.current -= one
        el.scrollLeft = posRef.current
        const idx = Math.round((posRef.current % one) / (card + gap)) % n
        if (idx !== idxRef.current) { idxRef.current = idx; setActiveIdx(idx) }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const onTouchStart = () => { touching.current = true; clearTimeout(resumeRef.current) }
    const onTouchEnd = () => {
      clearTimeout(resumeRef.current)
      resumeRef.current = setTimeout(() => {
        posRef.current = el.scrollLeft   // resume from wherever the user left off
        touching.current = false
      }, 2500)
    }
    // Keep pos + dots in sync while the user is manually scrolling
    const onScroll = () => {
      if (!touching.current) return
      const { card, gap, one } = metrics()
      posRef.current = el.scrollLeft
      if (one > 0) {
        const idx = Math.round((el.scrollLeft % one) / (card + gap)) % n
        if (idx !== idxRef.current) { idxRef.current = idx; setActiveIdx(idx) }
      }
    }

    el.addEventListener('touchstart',  onTouchStart, { passive: true })
    el.addEventListener('touchend',    onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel', onTouchEnd,   { passive: true })
    el.addEventListener('scroll',      onScroll,     { passive: true })

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(resumeRef.current)
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('scroll',      onScroll)
    }
  }, [loop, n])

  const goTo = (i) => {
    const el = scrollRef.current
    if (!el) return
    const { card, gap } = metrics()
    touching.current = true
    clearTimeout(resumeRef.current)
    el.scrollTo({ left: i * (card + gap), behavior: 'smooth' })
    idxRef.current = i
    setActiveIdx(i)
    resumeRef.current = setTimeout(() => {
      posRef.current = el.scrollLeft
      touching.current = false
    }, 2500)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <div
        ref={scrollRef}
        className="hide-scroll"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
        }}
      >
        {rendered.map((event, i) => (
          <div
            key={i}
            style={{ flexShrink: 0, width: 'calc(100vw - 72px)', maxWidth: 360 }}
          >
            <EventCard
              event={event} accent={accent} faded={false} animIndex={i < n ? i : 0} inSlideshow
              onTap={() => onEventTap(event)} onDelete={onDeleteEvent}
            />
          </div>
        ))}
      </div>

      {n > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIdx ? 16 : 5,
                height: 5,
                borderRadius: 3,
                background: accent,
                opacity: i === activeIdx ? 0.85 : 0.3,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.25s, opacity 0.25s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SLIDESHOW_GROUPS = new Set(['Today', 'This Week'])

// "Suggested for you" — real local events (Ticketmaster + popular community pins)
// ranked by taste. A horizontal row above the feed with a one-tap Pin.
function SuggestedRow({ items, accent, onPin, onOpen }) {
  const [pinning, setPinning] = React.useState(null)
  const [dt] = React.useState(() => (dateStr) => {
    try { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return dateStr }
  })
  if (!items?.length) return null
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span className="mono-label" style={{ fontSize: 11, letterSpacing: '0.16em', color: accent, whiteSpace: 'nowrap' }}>✨ SUGGESTED FOR YOU</span>
        <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
      </div>
      <div className="hide-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 4px' }}>
        {items.map((s, i) => (
          <div key={i} onClick={() => onOpen?.(s)} style={{ flexShrink: 0, width: 220, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
            <div style={{ position: 'relative', paddingTop: '66%', background: s.image ? '#000' : 'linear-gradient(150deg, #d4f560, #8fbf2e)' }}>
              {s.image && <img src={s.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              {s.community && (
                <span className="mono-label" style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, letterSpacing: '0.06em', color: '#0a0a0b', background: accent, borderRadius: 999, padding: '3px 8px', fontWeight: 800 }}>🔥 {s.count} PINNED</span>
              )}
            </div>
            <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.title}</p>
              <p className="mono-label" style={{ margin: 0, fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em' }}>{dt(s.date)}{s.venue ? ` · ${s.venue}` : ''}</p>
              {s.reason && <p style={{ margin: '2px 0 0', fontSize: 12, color: accent, fontWeight: 600, lineHeight: 1.3 }}>{s.reason}</p>}
              <button onClick={(e) => { e.stopPropagation(); setPinning(i); Promise.resolve(onPin(s)).catch(() => setPinning(null)) }} disabled={pinning === i}
                className="btn-lime" style={{ marginTop: 'auto', padding: '9px', fontSize: 13, borderRadius: 11, opacity: pinning === i ? 0.6 : 1 }}>
                {pinning === i ? 'Pinning…' : '📌 Pin it'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FeedView({ events, accent, onEventTap, onDeleteEvent, onScan, dark, loading, suggestions = [], onPinSuggested, onSuggestionTap, suggestMeta }) {
  const groups = getGroups(events)
  const [showPast, setShowPast] = React.useState(false)
  const [sampleOpen, setSampleOpen] = React.useState(false)
  const [sampleGone, setSampleGone] = React.useState(false)

  const headingColor = dark ? '#e2e8f0' : '#1a1a2e'
  const dividerColor = dark ? 'rgba(255,255,255,0.18)' : '#1a1a2e'
  const dividerMuted = dark ? 'rgba(255,255,255,0.08)' : '#e5e5e5'

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 130px)', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${accent}30`, borderTopColor: accent, animation: 'calLoadSpin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (events.length === 0) {
    // Brand-new account. Rather than a bare screen, show a welcome with ONE
    // clearly-badged sample card so the app looks alive and teaches the flow.
    // The sample is client-only and disappears the moment a real event exists.
    if (sampleGone) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 130px)', padding: 40, textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 72, lineHeight: 1 }}>📸</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>Nothing pinned yet</h2>
          <p style={{ fontSize: 17, color: 'var(--text-2)', margin: 0, maxWidth: 260, lineHeight: 1.5 }}>See a flyer? Snap it and it shows up here.</p>
          <button onClick={onScan} className="btn-lime"
            style={{ marginTop: 8, padding: '14px 30px', fontSize: 18, cursor: 'pointer' }}>
            📷 Scan a flyer
          </button>
        </div>
      )
    }
    const sample = makeSampleEvent()
    return (
      <div style={{ padding: '20px 0 24px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <div style={{ padding: '0 20px 4px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: '4px 0 6px' }}>Welcome 👋</h2>
          <p style={{ fontSize: 16, color: 'var(--text-2)', margin: '0 auto 4px', maxWidth: 320, lineHeight: 1.5 }}>
            Here&apos;s what a pinned event looks like. Tap it to see how it works — then snap your own.
          </p>
        </div>
        <div className="mono-label" style={{ padding: '14px 16px 6px', fontSize: 11, letterSpacing: '0.16em', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ whiteSpace: 'nowrap' }}>EXAMPLE</span>
          <span style={{ height: 1, background: 'var(--border)', flex: 1 }} />
        </div>
        <div style={{ padding: '0 16px' }}>
          <EventCard event={sample} accent={accent}
            onTap={() => setSampleOpen(true)}
            onDelete={() => setSampleGone(true)} />
        </div>
        <div style={{ padding: '18px 20px 0', textAlign: 'center' }}>
          <button onClick={onScan} className="btn-lime"
            style={{ padding: '15px 32px', fontSize: 18, cursor: 'pointer' }}>
            📷 Scan your first flyer
          </button>
        </div>
        {sampleOpen && <SampleExplainer accent={accent} onScan={onScan} onClose={() => setSampleOpen(false)} />}
      </div>
    )
  }

  let cardIndex = 0
  return (
    <div style={{ padding: '12px 0 20px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      {onPinSuggested && suggestions.length > 0 && (
        <SuggestedRow items={suggestions} accent={accent} onPin={onPinSuggested} onOpen={onSuggestionTap} />
      )}
      {onPinSuggested && suggestions.length === 0 && suggestMeta && suggestMeta.reason !== 'no_pins' && (
        <div style={{ margin: '0 16px 26px', padding: '14px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="mono-label" style={{ margin: '0 0 6px', fontSize: 11, letterSpacing: '0.16em', color: accent }}>✨ SUGGESTED FOR YOU</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {suggestMeta.reason === 'no_city'
              ? "Pin an event with a city in its location (like “Oakland, CA”) and we'll suggest local events."
              : suggestMeta.reason === 'no_source'
                ? 'Suggestions source isn\'t configured yet.'
                : suggestMeta.city
                  ? `No listings near ${suggestMeta.city} right now — check back soon.`
                  : "Nothing to suggest yet — pin a few events and we'll learn your taste."}
          </p>
          <p className="mono-label" style={{ margin: '8px 0 0', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-3)' }}>
            {suggestMeta.reason || '—'}{suggestMeta.city ? ` · ${suggestMeta.city}` : ''}
          </p>
        </div>
      )}
      {groups.map((group, gi) => {
        const useSlide = SLIDESHOW_GROUPS.has(group.label) && !group.past
        const collapsed = group.past && !showPast
        return (
          <div key={group.label}>
            <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: collapsed ? 0 : 14, marginTop: gi > 0 ? 26 : 0 }}>
              {group.past ? (
                <button onClick={() => setShowPast(s => !s)} className="mono-label"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-3)', fontSize: 11, letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', fontSize: 9, transition: 'transform 0.2s', transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  PAST ({group.items.length})
                </button>
              ) : (
                <span className="mono-label" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {group.label}
                </span>
              )}
              <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
            </div>

            {collapsed ? null : useSlide ? (
              <SlideShow
                items={group.items}
                accent={accent}
                onEventTap={onEventTap}
                onDeleteEvent={onDeleteEvent}
              />
            ) : (
              <div style={{ padding: '0 16px' }}>
                {group.items.map(event => (
                  <EventCard key={event.id} event={event} accent={accent} faded={group.past}
                    animIndex={cardIndex++}
                    onTap={() => onEventTap(event)}
                    onDelete={onDeleteEvent}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
