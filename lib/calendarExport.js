// Build "Add to Calendar" links (Google Calendar template URL + an .ics file)
// from an ezcalendar event. Times are freeform strings on flyers, so we parse
// what we can and fall back to an all-day event.

const pad = (n) => String(n).padStart(2, '0')

// Pull up to two clock times out of a freeform string ("10 PM – 2 AM", "7:30pm")
function parseTimes(timeStr) {
  if (!timeStr) return []
  const re = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/gi
  const out = []
  let m
  while ((m = re.exec(timeStr)) && out.length < 2) {
    let h = parseInt(m[1], 10)
    const min = m[2] ? parseInt(m[2], 10) : 0
    const pm = /p/i.test(m[3])
    if (pm && h < 12) h += 12
    if (!pm && h === 12) h = 0
    if (h >= 0 && h < 24) out.push({ h, min })
  }
  return out
}

const keyToCompact = (key) => key.replace(/-/g, '')
function dayAfter(key) {
  const d = new Date(key + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

// Returns { allDay, start, end } in calendar-compact form.
export function eventTimes(event) {
  const startKey = event.date
  const endKey = event.end_date && event.end_date !== event.date ? event.end_date : event.date
  const times = parseTimes(event.time_str)

  if (times.length === 0) {
    // All-day; DTEND is exclusive so add a day
    return { allDay: true, start: keyToCompact(startKey), end: dayAfter(endKey) }
  }

  const s = times[0]
  const start = `${keyToCompact(startKey)}T${pad(s.h)}${pad(s.min)}00`

  let endDayKey = endKey
  let eh, em
  if (times[1]) {
    eh = times[1].h; em = times[1].min
    // single-day range that crosses midnight (e.g. 10 PM – 2 AM)
    if (endKey === startKey && (eh * 60 + em) <= (s.h * 60 + s.min)) endDayKey = dayAfterKey(startKey)
  } else {
    eh = (s.h + 2) % 24; em = s.min          // default 2-hour duration
    if (eh < s.h) endDayKey = dayAfterKey(startKey)
  }
  const end = `${keyToCompact(endDayKey)}T${pad(eh)}${pad(em)}00`
  return { allDay: false, start, end }
}

function dayAfterKey(key) {
  const d = new Date(key + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function googleCalUrl(event) {
  const { start, end } = eventTimes(event)
  const details = [event.time_str, event.source_url].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Event',
    dates: `${start}/${end}`,
  })
  if (event.location) params.set('location', event.location)
  if (details) params.set('details', details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

// Raw VEVENT lines for one event (used by both the single-event .ics and the feed)
export function eventVevent(event) {
  const { allDay, start, end } = eventTimes(event)
  const dtstart = allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`
  const dtend = allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const details = [event.time_str, event.source_url].filter(Boolean).join('\\n')
  return [
    'BEGIN:VEVENT',
    `UID:${event.id || Date.now()}@ezcalendar`,
    `DTSTAMP:${stamp}`,
    dtstart, dtend,
    `SUMMARY:${icsEscape(event.title || 'Event')}`,
    event.location ? `LOCATION:${icsEscape(event.location)}` : null,
    details ? `DESCRIPTION:${details}` : null,
    'END:VEVENT',
  ].filter(Boolean)
}

// A full VCALENDAR string for a set of events — served by the subscribable feed
export function vcalendar(events, name = 'ezcalendar') {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ezcalendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`,
    ...(events || []).flatMap(eventVevent),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function icsHref(event) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ezcalendar//EN', 'CALSCALE:GREGORIAN', ...eventVevent(event), 'END:VCALENDAR']
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'))
}
