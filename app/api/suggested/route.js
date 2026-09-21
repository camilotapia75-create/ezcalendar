import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGeminiUrls } from '@/lib/geminiModels'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ── Location inference ──────────────────────────────────────────────────────
// Pull a city out of a freeform flyer location ("Bloc15, Oakland, CA" → Oakland)
const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy',
  'california','new york','texas','oregon','washington','nevada','arizona','illinois','florida','georgia',
])
// Segments that are street addresses / venues, not cities ("100 2nd St", "1822 Telegraph Ave")
const STREET_SUFFIX = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|sq|square|hwy|highway|pkwy|parkway|ste|suite|fl|floor|unit|apt|rm|room)\.?$/i
const looksLikeAddress = (s) => /\d/.test(s) || STREET_SUFFIX.test(String(s).trim())

function cityFrom(loc) {
  const parts = String(loc || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!parts.length) return null
  const lastRaw = parts[parts.length - 1]
  const last = lastRaw.toLowerCase().replace(/\b\d{5}(-\d{4})?\b/, '').trim()
  // "…, City, ST" → the token before the state is the city
  if ((US_STATES.has(last) || /^\d{5}/.test(lastRaw)) && parts.length >= 2) {
    const c = parts[parts.length - 2]
    return looksLikeAddress(c) ? null : c
  }
  // No state — the last token is the best city guess, unless it's a street/venue
  const c = parts[parts.length - 1]
  return looksLikeAddress(c) ? null : c
}

function fmtTime(t) {
  const m = String(t || '').match(/(\d{2}):(\d{2})/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}:${m[2]} ${ap}`
}

function pickImage(images) {
  if (!Array.isArray(images) || !images.length) return null
  // Prefer a wide image around 640px
  const wide = images.filter(i => i.ratio === '16_9')
  const pool = wide.length ? wide : images
  const sorted = [...pool].sort((a, b) => Math.abs((a.width || 0) - 640) - Math.abs((b.width || 0) - 640))
  return sorted[0]?.url || null
}

const stripHtml = (s) => String(s || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// ── Shared Gemini text call ─────────────────────────────────────────────────
// One place for the fallback-chain + JSON-extraction plumbing both the ranker
// and the web-extractor use. Returns the parsed value, or null on any failure.
async function geminiJson(prompt, apiKey, { open = '{', close = '}', timeout = 15000 } = {}) {
  if (!apiKey) return null
  const urls = await getGeminiUrls(apiKey)
  for (const u of urls) {
    try {
      const res = await fetch(`${u}?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) continue
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const json = raw.slice(raw.indexOf(open), raw.lastIndexOf(close) + 1)
      return JSON.parse(json)
    } catch {}
  }
  return null
}

// ── AI ranking by taste ─────────────────────────────────────────────────────
async function aiRank(taste, candidates, apiKey) {
  if (!apiKey || !taste.length) return null
  const list = candidates.map((c, i) => `${i}. ${c.title}${c.genre ? ` [${c.genre}]` : ''}${c.venue ? ` @ ${c.venue}` : ''}`).join('\n')
  const prompt = `A user saves these local events to their calendar (their taste):\n${taste.join(', ')}\n\nHere are upcoming REAL local events:\n${list}\n\nRank the ones this user might want to attend, best first — skip only events that clearly don't match their taste. Return ONLY JSON: {"picks":[{"i":<index number>,"reason":"<max 5 words why it fits>"}]} with up to 16 picks, best first.`
  const parsed = await geminiJson(prompt, apiKey)
  if (parsed && Array.isArray(parsed.picks)) {
    return parsed.picks.filter(p => Number.isInteger(p.i) && p.i >= 0 && p.i < candidates.length)
  }
  return null
}

// ── Source: Ticketmaster Discovery ──────────────────────────────────────────
async function fetchTicketmaster(city, tmKey) {
  const out = []
  if (!tmKey) return out
  try {
    const start = new Date().toISOString().split('.')[0] + 'Z'
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${tmKey}&city=${encodeURIComponent(city)}&startDateTime=${start}&sort=date,asc&size=40`
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    for (const ev of (d?._embedded?.events || [])) {
      out.push({
        title: ev.name,
        date: ev.dates?.start?.localDate || null,
        time_str: fmtTime(ev.dates?.start?.localTime),
        venue: ev._embedded?.venues?.[0]?.name || null,
        city: ev._embedded?.venues?.[0]?.city?.name || city,
        url: ev.url || null,
        image: pickImage(ev.images),
        genre: [ev.classifications?.[0]?.segment?.name, ev.classifications?.[0]?.genre?.name].filter(Boolean).filter(g => g !== 'Undefined').join(' / '),
        source: 'Ticketmaster',
      })
    }
  } catch {}
  return out
}

// ── Source: SeatGeek ────────────────────────────────────────────────────────
// Read-only, free with a client ID. venue.city filters to the user's town;
// performers[0].image gives us a flyer surface.
async function fetchSeatgeek(city, sgKey) {
  const out = []
  if (!sgKey) return out
  try {
    const now = new Date().toISOString().split('.')[0]
    const url = `https://api.seatgeek.com/2/events?client_id=${sgKey}&venue.city=${encodeURIComponent(city)}&datetime_utc.gte=${now}&sort=datetime_utc.asc&per_page=40`
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    for (const ev of (d?.events || [])) {
      const local = ev.datetime_local || ev.datetime_utc || ''
      out.push({
        title: ev.short_title || ev.title,
        date: local ? local.split('T')[0] : null,
        time_str: fmtTime(local.split('T')[1]),
        venue: ev.venue?.name || null,
        city: ev.venue?.city || city,
        url: ev.url || null,
        image: ev.performers?.[0]?.image || ev.performers?.[0]?.images?.huge || null,
        genre: ev.taxonomies?.[0]?.name ? ev.taxonomies[0].name.replace(/_/g, ' ') : (ev.type ? ev.type.replace(/_/g, ' ') : null),
        source: 'SeatGeek',
      })
    }
  } catch {}
  return out
}

// ── Source: open web (Brave Search + AI extraction) ─────────────────────────
// The long-tail lane: warehouse parties, gallery openings, pop-ups that never
// touch a ticketing API. We search, pull a few result pages, and have Gemini
// EXTRACT events that are literally on the page — never invent. Anything without
// a concrete future date in the text is dropped, so it can't hallucinate.
async function fetchWebEvents(city, taste, braveKey, aiKey) {
  const out = []
  if (!braveKey || !aiKey) return out
  try {
    const interests = taste.slice(0, 6).join(', ')
    const q = `${city} events this week ${interests}`.trim()
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=8&freshness=pw`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey }, signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return out
    const data = await r.json()
    const results = (data?.web?.results || []).slice(0, 6)
    // Feed Brave's own descriptions to the model first (cheap, no extra fetches)
    const digest = results
      .map(x => `URL: ${x.url}\nTITLE: ${stripHtml(x.title)}\nTEXT: ${stripHtml(x.description)}`)
      .join('\n\n')
      .slice(0, 6000)
    if (!digest.trim()) return out
    const today = dayKey(new Date())
    const prompt = `Today is ${today}. Below are web search results about events in ${city}. Extract ONLY real, specific events that have a concrete future date stated in the text. Do NOT invent events, dates, or details — if a date isn't clearly present, skip it. Return ONLY JSON: {"events":[{"title":"","date":"YYYY-MM-DD","time":"7:00 PM or null","venue":"or null","url":"the source URL","genre":"short label or null"}]} with up to 8 events, dates on or after ${today}.\n\n${digest}`
    const parsed = await geminiJson(prompt, aiKey, { timeout: 15000 })
    for (const e of (parsed?.events || [])) {
      if (!e?.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || e.date < today) continue
      out.push({
        title: String(e.title).slice(0, 140),
        date: e.date,
        time_str: e.time && e.time !== 'null' ? e.time : null,
        venue: e.venue && e.venue !== 'null' ? e.venue : null,
        city,
        url: e.url || null,
        image: null,
        genre: e.genre && e.genre !== 'null' ? e.genre : 'Around town',
        source: 'Web',
      })
    }
  } catch {}
  return out
}

const dayKey = (d) => d.toISOString().split('T')[0]
const normKey = (title, date) => `${String(title || '').toLowerCase().trim()}|${date}`

export async function GET(request) {
  const debug = new URL(request.url).searchParams.get('debug')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ suggestions: [] }, { status: 401 })

  const { data: events } = await supabase
    .from('events').select('title, location').eq('user_id', user.id)
  if (!events?.length) return NextResponse.json({ suggestions: [], reason: 'no_pins' })

  // Infer the user's city from where they actually pin events — count each
  // distinct location once so a recurring series doesn't dominate the vote.
  const tally = {}
  const seenLoc = new Set()
  for (const e of events) {
    const locNorm = String(e.location || '').trim().toLowerCase()
    if (!locNorm || seenLoc.has(locNorm)) continue
    seenLoc.add(locNorm)
    const c = cityFrom(e.location)
    if (c) tally[c] = (tally[c] || 0) + 1
  }
  const city = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!city) return NextResponse.json({ suggestions: [], reason: 'no_city' })

  const taste = [...new Set(events.map(e => e.title).filter(Boolean))].slice(0, 40)
  const aiKey = process.env.GOOGLE_AI_API_KEY

  const candidates = []
  const seen = new Set()
  const add = (c) => { const k = normKey(c.title, c.date); if (c.date && c.title && !seen.has(k)) { seen.add(k); candidates.push(c) } }

  // ── The moat: other users' POPULAR PUBLIC events in this city ──
  // Privacy guard: only events pinned by 2+ distinct people AND carrying a flyer
  // image surface here — a personal one-off ("Cat sitting") never does.
  const community = (async () => {
    const out = []
    try {
      const admin = createAdminClient()
      const today = dayKey(new Date())
      const in60 = dayKey(new Date(Date.now() + 60 * 86400000))
      const { data: others } = await admin
        .from('events')
        .select('title, date, time_str, location, image_url, source_url, user_id')
        .gte('date', today).lte('date', in60)
        .not('image_url', 'is', null)
        .neq('user_id', user.id)
        .limit(1000)
      const groups = {}
      for (const e of (others || [])) {
        if ((cityFrom(e.location) || '').toLowerCase() !== city.toLowerCase()) continue
        const k = normKey(e.title, e.date)
        if (!groups[k]) groups[k] = { rep: e, users: new Set() }
        groups[k].users.add(e.user_id)
      }
      for (const g of Object.values(groups)) {
        if (g.users.size < 2) continue
        const e = g.rep
        out.push({ title: e.title, date: e.date, time_str: e.time_str || null, venue: null, city, url: e.source_url || null, image: e.image_url || null, genre: 'In your scene', community: true, count: g.users.size, source: 'Community' })
      }
    } catch {}
    return out
  })()

  // ── Real listings from every source, in parallel ──
  const [communityEvents, tmEvents, sgEvents, webEvents] = await Promise.all([
    community,
    fetchTicketmaster(city, process.env.TICKETMASTER_API_KEY),
    fetchSeatgeek(city, process.env.SEATGEEK_CLIENT_ID || process.env.SEATGEEK_API_KEY),
    fetchWebEvents(city, taste, process.env.BRAVE_SEARCH_API_KEY, aiKey),
  ])
  // Community first so it wins de-dupe ties (keeps the "🔥 N pinned" badge)
  for (const e of communityEvents) add(e)
  for (const e of [...tmEvents, ...sgEvents, ...webEvents]) add(e)

  if (!candidates.length) return NextResponse.json({ suggestions: [], reason: 'no_events', city })

  // Rank by taste (AI); fall back to community-first + soonest if AI is unavailable
  const picks = await aiRank(taste, candidates, aiKey).catch(() => null)

  let suggestions
  if (picks?.length) {
    const pickedIdx = new Set(picks.map(p => p.i))
    const ranked = picks.map(p => ({ ...candidates[p.i], reason: p.reason })).filter(s => s.title)
    // Append the candidates the AI didn't explicitly pick, so the client has a
    // deep pool to rotate through and to backfill as the user dismisses cards.
    const rest = candidates.filter((_, i) => !pickedIdx.has(i))
    suggestions = [...ranked, ...rest]
  } else {
    suggestions = candidates
  }

  // Return a deep pool; the client rotates/dedupes/dismisses within it.
  const payload = { suggestions: suggestions.slice(0, 30), city }
  if (debug) {
    payload._debug = {
      city,
      keys: {
        ticketmaster: !!process.env.TICKETMASTER_API_KEY,
        seatgeek: !!(process.env.SEATGEEK_CLIENT_ID || process.env.SEATGEEK_API_KEY),
        brave: !!process.env.BRAVE_SEARCH_API_KEY,
        gemini: !!aiKey,
      },
      counts: {
        community: communityEvents.length,
        ticketmaster: tmEvents.length,
        seatgeek: sgEvents.length,
        web: webEvents.length,
        candidates: candidates.length,
      },
      webSample: webEvents.slice(0, 5).map(e => `${e.date} · ${e.title}`),
    }
  }
  return NextResponse.json(payload)
}
