import { NextResponse } from 'next/server'

// Node.js runtime — fallback chains can take 30-60s; edge would hard-timeout
export const maxDuration = 60

function getScanPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `Today is ${today}. Extract event details from this content. Return ONLY valid JSON (null for anything not found):
{
  "title": "event name",
  "date": "YYYY-MM-DD start date — parse from ISO datetimes like '2026-06-13T20:00:00', startDate fields, or any date text",
  "end_date": "YYYY-MM-DD end date — ONLY if the event explicitly spans multiple days (e.g. 'Jun 14-15', 'July 4 to July 6', a multi-day festival). null for single-day events.",
  "time_str": "start time and end time if present — parse from ISO datetimes: T20:00:00=8:00 PM, T02:00:00=2:00 AM. Examples: '10:00 PM – 2:00 AM', '8:00 PM'",
  "location": "wherever the event happens — venue name + city when both are known (e.g. 'Chase Center, San Francisco, CA'), but a city or neighborhood alone is fine too (e.g. 'Sacramento, CA'). Return ANY place mentioned; only null if no place at all."
}`
}

function getVisionPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `Today is ${today}. Extract event details from this flyer image. Return ONLY valid JSON (null for anything not found):
{
  "title": "event name",
  "date": "YYYY-MM-DD — if partial date like 'Jul 24' with no year, use nearest future year",
  "end_date": "YYYY-MM-DD end date — ONLY if event explicitly spans multiple days (e.g. 'Jun 14-15', 'July 4-6'). null for single-day.",
  "time_str": "time range exactly as shown on the flyer (e.g. '7:30 PM', '10 PM - 2 AM', '4-8PM')",
  "location": "wherever the event happens, exactly as printed — venue + address + city if shown (e.g. 'Torch Oakland, 1822 Telegraph Ave, Oakland CA'), or just a city/neighborhood if that's all the flyer shows. Return ANY place mentioned; only null if none."
}`
}

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
].map(m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

// HTML entity decode — og:image URLs in raw HTML often have &amp; instead of &
const decodeHtml = s => s
  ?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'") || null

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

async function tryInstagramOembed(url) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return { _err: 'NO_CREDS' }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}&fields=thumbnail_url,title,author_name&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error) return { _err: `IG_OEMBED_${data.error.code}: ${data.error.message}` }
    return { thumbnail_url: data.thumbnail_url || null, caption: data.title || '' }
  } catch (e) {
    return { _err: `IG_OEMBED_THROW: ${e.message}` }
  }
}

// Instagram's public embed page — serves image + caption without login or API approval
async function tryInstagramEmbed(type, shortcode) {
  try {
    const res = await fetch(`https://www.instagram.com/${type}/${shortcode}/embed/captioned/`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { _err: `IG_EMBED_HTTP_${res.status}` }
    const html = await res.text()

    let image =
      html.match(/class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i)?.[1] ||
      html.match(/src=["']([^"']+)["'][^>]*class=["']EmbeddedMediaImage["']/i)?.[1] ||
      null
    if (!image) {
      const duMatch = html.match(/"display_url"\s*\\?:\s*\\?"((?:https?|\\\/\\\/)[^"]+?)\\?"/)
      if (duMatch) image = duMatch[1]
    }
    if (image) {
      image = image.replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&')
    }

    let caption = ''
    const capMatch = html.match(/<div[^>]*class=["'][^"']*Caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    if (capMatch) {
      caption = capMatch[1]
        .replace(/<br[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim()
    }

    if (!image && !caption) {
      const wall = /login|consent|challenge/i.test(html.slice(0, 3000)) ? ',wall' : ''
      return { _err: `IG_EMBED_EMPTY(${html.length}ch${wall})` }
    }
    return { image, caption }
  } catch (e) {
    return { _err: `IG_EMBED_THROW: ${e.message}` }
  }
}

async function tryFacebookGraphAPI(eventId) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return { _err: 'NO_CREDS' }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${eventId}?fields=name,description,start_time,end_time,place,cover&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error) return { _err: `FB_API_${data.error.code}: ${data.error.message}` }
    if (!data.name) return { _err: `FB_API_NO_NAME status=${res.status}` }

    const parseIso = (iso) => {
      const m = iso?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
      if (!m) return null
      const h = parseInt(m[2])
      return { date: m[1], time: `${h % 12 === 0 ? 12 : h % 12}:${m[3]} ${h >= 12 ? 'PM' : 'AM'}` }
    }
    const start = parseIso(data.start_time)
    const end   = parseIso(data.end_time)
    let time_str = start?.time || null
    if (time_str && end?.time) time_str += ` – ${end.time}`

    const location = data.place
      ? [data.place.name, data.place.location?.city].filter(Boolean).join(', ')
      : null

    let ogImage = data.cover?.source || null
    if (ogImage) {
      try {
        const imgRes = await fetch(ogImage, {
          headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
          signal: AbortSignal.timeout(8000),
        })
        if (imgRes.ok) {
          const ct = imgRes.headers.get('content-type') || 'image/jpeg'
          if (ct.startsWith('image/')) {
            const buf = await imgRes.arrayBuffer()
            if (buf.byteLength < 2000000) ogImage = `data:${ct};base64,${arrayBufferToBase64(buf)}`
          }
        }
      } catch {}
    }

    return { title: data.name, date: start?.date || null, time_str, location, og_image: ogImage }
  } catch (e) {
    return { _err: `FB_API_THROW: ${e.message}` }
  }
}

// Facebook iCal export — structured date/title/end_date without login
async function tryFacebookICal(eventId) {
  try {
    const res = await fetch(`https://www.facebook.com/events/ical/export/?eid=${eventId}`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { _err: `ICAL_HTTP_${res.status}` }
    const text = await res.text()
    if (!text.includes('BEGIN:VEVENT')) return { _err: `ICAL_NOT_ICS(${text.length}ch)` }
    const unesc = s => s?.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
    const get = k => text.match(new RegExp(`^${k}([^:\\r\\n]*):(.+)$`, 'm'))
    const parseDt = (m) => {
      if (!m) return null
      const v = m[2].trim()
      const d = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/)
      if (!d) return null
      const isUtc = /Z\s*$/.test(v)
      const hasTz = /TZID=/i.test(m[1])
      let time = null
      if (d[4] && (hasTz || !isUtc)) {
        const h = parseInt(d[4])
        time = `${h % 12 === 0 ? 12 : h % 12}:${d[5]} ${h >= 12 ? 'PM' : 'AM'}`
      }
      return { date: `${d[1]}-${d[2]}-${d[3]}`, time, utc: isUtc && !hasTz }
    }
    const s = parseDt(get('DTSTART'))
    const e = parseDt(get('DTEND'))
    let time_str = s?.time || null
    if (time_str && e?.time && e.date === s.date) time_str += ` – ${e.time}`
    return {
      title: unesc(get('SUMMARY')?.[2]) || null,
      date: s?.date || null,
      dateIsUtc: s?.utc || false,
      end_date: e && s && e.date !== s.date ? e.date : null,
      time_str,
      location: unesc(get('LOCATION')?.[2]) || null,
      description: unesc(get('DESCRIPTION')?.[2])?.slice(0, 2000) || null,
    }
  } catch (e) {
    return { _err: `ICAL_THROW: ${e.message}` }
  }
}

// Facebook serves og:image/og:title to link-preview crawlers
async function tryFacebookOg(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { _err: `FB_OG_HTTP_${res.status}` }
    const html = await res.text()
    const meta = (prop) =>
      html.match(new RegExp(`property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
      html.match(new RegExp(`content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] || null
    const image = decodeHtml(meta('image'))
    const title = decodeHtml(meta('title'))
    const description = decodeHtml(meta('description'))
    if (!image && !title && !description) return { _err: `FB_OG_EMPTY(${html.length}ch)` }
    return { image, title, description }
  } catch (e) {
    return { _err: `FB_OG_THROW: ${e.message}` }
  }
}

// Directly parse Facebook's og:description to extract time/date/location without Gemini.
// Facebook serves predictable formats like:
// "Wednesday, October 28, 2026 at 7:00 PM UTC-07:00 · Oakland Arena, Oakland, California"
function parseFacebookOgDescription(description) {
  if (!description) return {}
  const result = {}

  // Time: "at 7 PM", "at 7:00 PM", optionally "– 10:00 PM", with optional timezone suffix
  const timeM = description.match(
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM))(?:\s*(?:UTC[+-][\d:]+|[A-Z]{2,4}T))?(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?/i
  )
  if (timeM) {
    result.time_str = timeM[2]
      ? `${timeM[1].trim()} – ${timeM[2].trim()}`
      : timeM[1].trim()
  }

  // Location: text after the · separator Facebook uses between time and venue
  const bulletIdx = description.indexOf('·')
  if (bulletIdx !== -1) {
    result.location = description.slice(bulletIdx + 1).trim().split('\n')[0].trim()
  }

  // Date: "Wednesday, October 28, 2026" or just "October 28"
  const MONTHS = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
  const dateM = description.match(/(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i)
  if (dateM) {
    const month = MONTHS[dateM[1].toLowerCase()]
    const day = parseInt(dateM[2])
    const year = dateM[3] ? parseInt(dateM[3]) : new Date().getFullYear()
    if (month) result.date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  return result
}

async function fetchViaJina(url, format = 'markdown') {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)',
      'Accept': 'text/plain',
      'X-Return-Format': format,
      'X-Timeout': '20',
    }
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(22000),
    })
    if (!res.ok) return { _err: `JINA_HTTP_${res.status}` }
    const text = await res.text()
    return { text, chars: text.length }
  } catch (e) {
    return { _err: `JINA_THROW: ${e.message}` }
  }
}

function extractJinaImage(text) {
  const m =
    text.match(/!\[.*?\]\((https?:\/\/[^)\s"']+)\)/) ||
    text.match(/(https?:\/\/[^\s"'<>)]+(?:cdninstagram|fbcdn)[^\s"'<>)]+)/i) ||
    text.match(/(https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>)]*)?)/i)
  return m?.[1] || null
}

// Returns { data, diag } — diag surfaces per-model quota/error info
async function callGemini(text, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${getScanPrompt()}\n\nContent:\n${text.slice(0, 8000)}` }] }],
  })
  const diags = []
  for (const modelUrl of MODELS) {
    const name = modelUrl.split('/models/')[1].split(':')[0].replace('gemini-', '')
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) { diags.push(`${name}:${res.status}`); continue }
      const result = await res.json()
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!raw) { diags.push(`${name}:empty`); continue }
      const match = raw.match(/\{[\s\S]*\}/)
      return { data: JSON.parse(match ? match[0] : raw), diag: diags.join(',') }
    } catch (e) { diags.push(`${name}:${(e.message || 'err').slice(0, 30)}`); continue }
  }
  return { data: null, diag: diags.join(',') }
}

// Reads event details off a flyer image (data URL)
async function callGeminiVision(dataUrl, apiKey) {
  const m = dataUrl?.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!m) return null
  const body = JSON.stringify({
    contents: [{ parts: [
      { inlineData: { mimeType: m[1], data: m[2] } },
      { text: getVisionPrompt() },
    ]}],
  })
  for (const modelUrl of MODELS) {
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const result = await res.json()
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!raw) continue
      const match = raw.match(/\{[\s\S]*\}/)
      return JSON.parse(match ? match[0] : raw)
    } catch { continue }
  }
  return null
}

async function proxyImage(imageUrl, referer) {
  if (!imageUrl) return null
  const isFbCdn = /fbcdn\.net|scontent\./i.test(imageUrl)

  const attempt = async (ua) => {
    try {
      const res = await fetch(imageUrl, {
        headers: { 'User-Agent': ua, 'Referer': referer || imageUrl },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      const ct = res.headers.get('content-type') || 'image/jpeg'
      if (!ct.startsWith('image/')) return null
      const buf = await res.arrayBuffer()
      if (buf.byteLength >= 2000000) return imageUrl
      return `data:${ct};base64,${arrayBufferToBase64(buf)}`
    } catch { return null }
  }

  if (isFbCdn) {
    // Facebook CDN: try their own crawler UA first, fall back to a browser UA.
    // Never return the raw fbcdn URL — browsers can't load it (signed/expiring)
    return (
      await attempt('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)') ??
      await attempt(BROWSER_HEADERS['User-Agent']) ??
      null
    )
  }
  return (await attempt('Mozilla/5.0 (compatible; EZCalendar/1.0)')) ?? imageUrl
}

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  let url
  try {
    const body = await request.json()
    url = body.url
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  let baseUrl = url
  try { baseUrl = new URL(url).origin } catch {}

  // —— Instagram posts / reels ——
  const igMatch = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i)
  if (igMatch) {
    const errors = []
    let igText = ''
    let igImage = null

    const embedUrl = `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/captioned/`

    // Kick off all three sources at once, but only WAIT for Jina when the
    // direct embed didn't deliver — embed typically answers in ~2s while
    // Jina takes 10-20s, so this saves most of the wait on the happy path
    const jinaEmbedP = fetchViaJina(embedUrl)
    const jinaPostP = fetchViaJina(url)
    const embed = await tryInstagramEmbed(igMatch[1], igMatch[2])

    if (!embed._err) {
      igImage = embed.image || null
      igText = embed.caption || ''
    } else {
      errors.push(embed._err)
    }

    if (!igImage || igText.length < 80) {
      const [jinaEmbed, jinaPost] = await Promise.all([jinaEmbedP, jinaPostP])

      if (!jinaEmbed._err && jinaEmbed.chars > 100) {
        if (!igImage) igImage = extractJinaImage(jinaEmbed.text)
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jinaEmbed.text}` : jinaEmbed.text
      } else {
        errors.push(`EMBED:${jinaEmbed._err || `SHORT(${jinaEmbed.chars ?? 0}ch)`}`)
      }

      if (!jinaPost._err && jinaPost.chars > 100) {
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jinaPost.text}` : jinaPost.text
        if (!igImage) igImage = extractJinaImage(jinaPost.text)
      } else {
        errors.push(`POST:${jinaPost._err || `SHORT(${jinaPost.chars ?? 0}ch)`}`)
      }
    }

    // oEmbed API as last text source (requires Meta app review — often fails)
    if (!igImage || !igText) {
      const oembed = await tryInstagramOembed(url)
      if (!oembed._err) {
        if (!igImage) igImage = oembed.thumbnail_url || null
        if (!igText)  igText  = oembed.caption || ''
      } else {
        errors.push(oembed._err)
      }
    }

    // Caption-Gemini doesn't need the image, so run it in parallel with the
    // whole proxy→vision chain instead of waiting for the proxy first
    const [textResult, { imageData, visionData }] = await Promise.all([
      igText.length > 50 ? callGemini(igText, apiKey) : Promise.resolve({ data: null, diag: 'no-text' }),
      (async () => {
        const img = igImage ? await proxyImage(igImage, url) : null
        const vd = img?.startsWith('data:') ? await callGeminiVision(img, apiKey) : null
        return { imageData: img, visionData: vd }
      })(),
    ])
    const textData = textResult.data
    if (!textData && textResult.diag) errors.push(`GEMINI_TEXT(${textResult.diag})`)
    if (imageData?.startsWith('data:') && !visionData) errors.push('VISION_FAILED')

    // Merge: text for title, vision preferred for location (flyer shows the
    // actual venue/address; captions often just name a city)
    const merged = {
      title:    textData?.title    || visionData?.title    || null,
      date:     textData?.date     || visionData?.date     || null,
      end_date: textData?.end_date || visionData?.end_date || null,
      time_str: textData?.time_str || visionData?.time_str || null,
      location: visionData?.location || textData?.location || null,
    }

    if (merged.title || merged.date) {
      return NextResponse.json({ ...merged, og_image: imageData || igImage })
    }
    if (imageData) {
      return NextResponse.json({
        ...merged, og_image: imageData,
        warning: `Got the flyer image, but couldn't read the event details — fill them in below. [${errors.join(' | ')}]`,
      })
    }

    return NextResponse.json({
      error: `Could not read Instagram post. Try saving the flyer image and uploading it instead. [${errors.join(' | ')}]`,
    }, { status: 400 })
  }

  // —— Facebook events ——
  const fbMatch = url.match(/facebook\.com\/events\/(\d+)(?:\/(\d+))?/i)
  if (fbMatch) {
    const seriesId = fbMatch[1]
    const occurrenceId = fbMatch[2] || null
    const cleanFbUrl = url.split('?')[0]
    const errors = []

    // Fetch all three sources IN PARALLEL — iCal for structure, Jina for rich
    // rendered text (Facebook shows "Sat Jun 20 at 10 PM – 2 AM" in page body),
    // OG for the cover image
    const [icalResult, jinaResult, ogResult] = await Promise.all([
      (async () => {
        for (const id of [occurrenceId, seriesId].filter(Boolean)) {
          const r = await tryFacebookICal(id)
          if (!r._err) return r
          errors.push(`${r._err}@${id}`)
        }
        return { _err: 'ICAL_ALL_FAILED' }
      })(),
      fetchViaJina(cleanFbUrl),
      tryFacebookOg(cleanFbUrl),
    ])

    const merged = { title: null, date: null, end_date: null, time_str: null, location: null, og_image: null }

    // iCal: reliable date, end_date, sometimes time (when TZID format)
    // Skip iCal location — usually just a city; Jina+Gemini gives full venue
    if (!icalResult._err) {
      if (icalResult.title)    merged.title    = icalResult.title
      if (icalResult.date)     merged.date     = icalResult.date
      if (icalResult.end_date) merged.end_date = icalResult.end_date
      if (icalResult.time_str) merged.time_str = icalResult.time_str
      // UTC iCal date can be off by 1 day — og:description carries the correct local date
      if (icalResult.dateIsUtc) merged._utcDate = true
    }

    // OG: event cover image (decode HTML entities — Facebook HTML has &amp; in URLs)
    if (!ogResult._err) {
      if (ogResult.image) merged.og_image = decodeHtml(ogResult.image)
      if (ogResult.title && !merged.title) merged.title = ogResult.title
    } else {
      errors.push(ogResult._err)
    }

    // Direct-parse Facebook's og:description for time/location/date —
    // Facebook serves "Wednesday, October 28 at 7:00 PM UTC-07:00 · Oakland Arena, City"
    // which is more reliable than Gemini for these structured formats
    if (!ogResult._err && ogResult.description) {
      const direct = parseFacebookOgDescription(ogResult.description)
      if (direct.time_str && !merged.time_str) merged.time_str = direct.time_str
      if (direct.location && !merged.location) merged.location = direct.location
      // Allow direct-parsed local date to override a potentially off-by-one UTC iCal date
      if (direct.date && (!merged.date || merged._utcDate)) merged.date = direct.date
    }

    // Jina: full rendered page text → Gemini extracts venue name + time
    // Facebook's rendered page explicitly states "Saturday, June 20 at 10 PM – 2 AM CDT"
    let jinaText = ''
    if (!jinaResult._err && jinaResult.chars > 100) {
      const isLoginWall = /log in|sign in|create an account|join facebook|you must be logged in/i.test(jinaResult.text.slice(0, 600))
      if (isLoginWall) {
        errors.push('JINA_FB_LOGIN_WALL')
        // The login wall page often still contains the event cover image URL — try to extract it
        if (!merged.og_image) merged.og_image = extractJinaImage(jinaResult.text)
      } else {
        jinaText = jinaResult.text
      }
    } else {
      errors.push(jinaResult._err || `JINA_SHORT(${jinaResult.chars ?? 0}ch)`)
    }
    if (!merged.og_image && jinaText) merged.og_image = extractJinaImage(jinaText)

    // Start downloading the cover image now — runs while Gemini reads the page text
    const proxyP = merged.og_image ? proxyImage(merged.og_image, url) : Promise.resolve(null)

    // Gemini input priority: Jina (full page) → OG description (when Jina is login-walled, FB
    // serves "Sat Jun 20 at 10 PM · City of Martinez" in og:description to crawler UAs) → iCal desc
    const ogDescText = (!ogResult._err && ogResult.description)
      ? `${merged.title || ''}\n${ogResult.description}` : ''
    const geminiInput = jinaText || ogDescText || (icalResult.description ? `${merged.title || ''}\n${icalResult.description}` : '')
    if (geminiInput.length > 30) {
      const { data, diag } = await callGemini(geminiInput, apiKey)
      if (data) {
        // Gemini from rendered page is best for venue name and time
        if (data.location) merged.location = data.location
        if (data.time_str && !merged.time_str) merged.time_str = data.time_str
        if (data.title && !merged.title) merged.title = data.title
        if (data.date && (!merged.date || merged._utcDate)) merged.date = data.date
        if (data.end_date && !merged.end_date) merged.end_date = data.end_date
      } else if (diag) errors.push(`GEMINI(${diag})`)
    }

    // Last resort: Graph API (requires special app permissions, usually fails)
    if (!merged.title || !merged.date || !merged.og_image) {
      const fb = await tryFacebookGraphAPI(occurrenceId || seriesId)
      if (!fb._err) {
        for (const k of Object.keys(merged)) if (!merged[k] && fb[k]) merged[k] = fb[k]
      } else if (fb._err !== 'NO_CREDS') errors.push(fb._err)
    }

    if (merged.title || merged.date) {
      // Graph API fallback may have set an already-proxied data URL — keep it
      if (!merged.og_image?.startsWith('data:')) merged.og_image = await proxyP
      // Vision on cover image for any still-missing fields
      if (merged.og_image?.startsWith('data:') && (!merged.date || !merged.time_str || !merged.location)) {
        const vd = await callGeminiVision(merged.og_image, apiKey)
        if (vd) for (const k of Object.keys(merged)) if (!merged[k] && vd[k]) merged[k] = vd[k]
      }
      delete merged._utcDate
      return NextResponse.json({
        ...merged,
        ...(merged.date ? {} : { warning: "Couldn't read the date — set it below." }),
      })
    }

    return NextResponse.json({ error: `Could not access Facebook event. [${errors.join(' | ')}]` }, { status: 400 })
  }

  // —— General path (Ticketmaster, event sites, etc.) ——

  // Step 1: Direct HTML fetch + JSON-LD / og:image extraction
  let html = ''
  let blocked = false
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) })
    if (res.ok) html = await res.text()
    else blocked = true
  } catch (err) {
    return NextResponse.json({ error: `Could not reach URL: ${err.message}` }, { status: 400 })
  }

  let ogImageUrl = null
  let textForGemini = ''

  if (html) {
    // Extract og:image — decode HTML entities (&amp; is common in CDN URLs)
    const ogMatch =
      html.match(/property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    ogImageUrl = decodeHtml(ogMatch?.[1]) || null
    if (ogImageUrl) {
      if (ogImageUrl.startsWith('//')) ogImageUrl = 'https:' + ogImageUrl
      else if (ogImageUrl.startsWith('/')) ogImageUrl = baseUrl + ogImageUrl
      else if (!ogImageUrl.startsWith('http')) ogImageUrl = baseUrl + '/' + ogImageUrl
    }

    // Extract JSON-LD Event schema (Ticketmaster, Eventbrite etc. all include this)
    let structuredInfo = ''
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let ldMatch
    while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const items = [JSON.parse(ldMatch[1])].flat()
        for (const item of items) {
          const types = [item['@type']].flat()
          if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('event'))) {
            structuredInfo += '\nEvent JSON-LD: ' + JSON.stringify(item).slice(0, 3000)
            if (!ogImageUrl) {
              const img = item.image
              const imgUrl = Array.isArray(img) ? img[0] : (typeof img === 'object' ? img?.url : img)
              if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) ogImageUrl = imgUrl
            }
          }
        }
      } catch {}
    }

    const metaDesc =
      html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 4000)

    textForGemini = [structuredInfo, metaDesc && `Meta: ${metaDesc}`, pageText].filter(Boolean).join('\n\n')
  }

  // Step 2: Jina fallback if blocked, OR supplement if structured data is thin
  // (Some sites like Ticketmaster load event details via JS — Jina renders that)
  if (blocked || !html || textForGemini.length < 300) {
    const jinaResult = await fetchViaJina(url)
    if (!jinaResult._err && jinaResult.chars > 100) {
      if (!ogImageUrl) ogImageUrl = extractJinaImage(jinaResult.text)
      // Use Jina text if it's more substantial than what we got from direct fetch
      if (jinaResult.text.length > textForGemini.length) textForGemini = jinaResult.text
    } else if (blocked || !html) {
      return NextResponse.json({ error: 'Could not access that page. Try a different URL or paste an image of the event instead.' }, { status: 400 })
    }
  }

  // Step 2b: Jina specifically for image if still missing
  if (html && !ogImageUrl && textForGemini.length >= 300) {
    const jinaResult = await fetchViaJina(url)
    if (!jinaResult._err && jinaResult.text) ogImageUrl = extractJinaImage(jinaResult.text)
  }

  const [ogImageData, { data, diag }] = await Promise.all([
    proxyImage(ogImageUrl, url),
    callGemini(textForGemini, apiKey),
  ])
  if (data) return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })

  return NextResponse.json({ error: `Could not extract event details from that URL.${diag ? ` [GEMINI: ${diag}]` : ''}` }, { status: 500 })
}
