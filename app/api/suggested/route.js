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
function cityFrom(loc) {
  const parts = String(loc || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!parts.length) return null
  let idx = parts.length - 1
  const last = parts[idx].toLowerCase().replace(/\b\d{5}(-\d{4})?\b/, '').trim()
  if ((US_STATES.has(last) || /^\d{5}/.test(parts[idx])) && parts.length >= 2) idx = parts.length - 2
  return parts[idx] || null
}

function fmtTime(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})/)
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

// ── AI ranking by taste ─────────────────────────────────────────────────────
async function aiRank(taste, candidates, apiKey) {
  if (!apiKey || !taste.length) return null
  const list = candidates.map((c, i) => `${i}. ${c.title}${c.genre ? ` [${c.genre}]` : ''}${c.venue ? ` @ ${c.venue}` : ''}`).join('\n')
  const prompt = `A user saves these local events to their calendar (their taste):\n${taste.join(', ')}\n\nHere are upcoming REAL local events:\n${list}\n\nPick the ones this user is MOST likely to want to attend, best first. Only genuinely relevant picks — fewer is better than padding, and skip anything that doesn't match their taste. Return ONLY JSON: {"picks":[{"i":<index number>,"reason":"<max 5 words why it fits>"}]} with up to 6 picks.`
  const urls = await getGeminiUrls(apiKey)
  for (const u of urls) {
    try {
      const res = await fetch(`${u}?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed.picks)) {
        return parsed.picks.filter(p => Number.isInteger(p.i) && p.i >= 0 && p.i < candidates.length)
      }
    } catch {}
  }
  return null
}

const dayKey = (d) => d.toISOString().split('T')[0]
const normKey = (title, date) => `${String(title || '').toLowerCase().trim()}|${date}`

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ suggestions: [] }, { status: 401 })

  const { data: events } = await supabase
    .from('events').select('title, location').eq('user_id', user.id)
  if (!events?.length) return NextResponse.json({ suggestions: [], reason: 'no_pins' })

  // Infer the user's city from where they actually pin events
  const tally = {}
  for (const e of events) {
    const c = cityFrom(e.location)
    if (c) tally[c] = (tally[c] || 0) + 1
  }
  const city = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!city) return NextResponse.json({ suggestions: [], reason: 'no_city' })

  const candidates = []
  const seen = new Set()
  const add = (c) => { const k = normKey(c.title, c.date); if (c.date && c.title && !seen.has(k)) { seen.add(k); candidates.push(c) } }

  // ── The moat: other users' POPULAR PUBLIC events in this city ──
  // Privacy guard: only events pinned by 2+ distinct people AND carrying a flyer
  // image surface here — a personal one-off ("Cat sitting") never does.
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
      add({ title: e.title, date: e.date, time_str: e.time_str || null, venue: null, city, url: e.source_url || null, image: e.image_url || null, genre: 'In your scene', community: true, count: g.users.size })
    }
  } catch {}

  // ── Real listings from Ticketmaster ──
  const tmKey = process.env.TICKETMASTER_API_KEY
  if (tmKey) {
    try {
      const start = new Date().toISOString().split('.')[0] + 'Z'
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${tmKey}&city=${encodeURIComponent(city)}&startDateTime=${start}&sort=date,asc&size=40`
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const d = await r.json()
      for (const ev of (d?._embedded?.events || [])) {
        add({
          title: ev.name,
          date: ev.dates?.start?.localDate || null,
          time_str: fmtTime(ev.dates?.start?.localTime),
          venue: ev._embedded?.venues?.[0]?.name || null,
          city: ev._embedded?.venues?.[0]?.city?.name || city,
          url: ev.url || null,
          image: pickImage(ev.images),
          genre: [ev.classifications?.[0]?.segment?.name, ev.classifications?.[0]?.genre?.name].filter(Boolean).filter(g => g !== 'Undefined').join(' / '),
        })
      }
    } catch {}
  }

  if (!candidates.length) return NextResponse.json({ suggestions: [], reason: 'no_events', city })

  // Rank by taste (AI); fall back to community-first + soonest if AI is unavailable
  const taste = [...new Set(events.map(e => e.title).filter(Boolean))].slice(0, 40)
  const picks = await aiRank(taste, candidates, process.env.GOOGLE_AI_API_KEY).catch(() => null)

  let suggestions
  if (picks?.length) {
    suggestions = picks.map(p => ({ ...candidates[p.i], reason: p.reason })).filter(s => s.title)
  } else {
    suggestions = candidates.slice(0, 6)
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 8), city })
}
