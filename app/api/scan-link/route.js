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
  "location": "full venue name AND city/state — e.g. 'Chase Center, San Francisco, CA'. Always include the venue name, not just the city."
}`
}

function getVisionPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `Today is ${today}. Extract event details from this flyer image. Return ONLY valid JSON (null for anything not found):
{
  "title": "event name",
  "date": "YYYY-MM-DD — if partial date like 'Jul 24' with no year, use nearest future year",
  "end_date": "YYYY-MM-DD end date — ONLY if event explicitly spans multiple days (e.g. 'Jun 14-15', 'July 4-6'). null for single-day.",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`
}

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
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
      return { date: `${d[1]}-${d[2]}-${d[3]}`, time }
    }
    const s = parseDt(get('DTSTART'))
    const e = parseDt(get('DTEND'))
    let time_str = s?.time || null
    if (time_str && e?.time && e.date === s.date) time_str += ` – ${e.time}`
    return {
      title: unesc(get('SUMMARY')?.[2]) || null,
      date: s?.date || null,
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
    if (!image && !title) return { _err: `FB_OG_EMPTY(${html.length}ch)` }
    return { image, title }
  } catch (e) {
    return { _err: `FB_OG_THROW: ${e.message}` }
  }
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
        signal: AbortSignal.timeout(20000),
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
  // Facebook CDN serves images more reliably to their own crawler UA
  const isFbCdn = /fbcdn\.net|scontent\./i.test(imageUrl)
  const ua = isFbCdn
    ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    : 'Mozilla/5.0 (compatible; EZCalendar/1.0)'
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': ua, 'Referer': referer || imageUrl },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return imageUrl
    const ct = res.headers.get('content-type') || 'image/jpeg'
    if (!ct.startsWith('image/')) return imageUrl
    const buf = await res.arrayBuffer()
    if (buf.byteLength >= 2000000) return imageUrl
    return `data:${ct};base64,${arrayBufferToBase64(buf)}`
  } catch {
    return imageUrl
  }
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

    // 1) Direct embed page fetch
    const embed = await tryInstagramEmbed(igMatch[1], igMatch[2])
    if (!embed._err) {
      igImage = embed.image || null
      igText = embed.caption || ''
    } else {
      errors.push(embed._err)
    }

    // 2) Jina on embed URL (renders the embed in a real browser)
    if (!igImage || igText.length < 80) {
      const jinaEmbed = await fetchViaJina(embedUrl)
      if (!jinaEmbed._err && jinaEmbed.chars > 100) {
        if (!igImage) igImage = extractJinaImage(jinaEmbed.text)
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jinaEmbed.text}` : jinaEmbed.text
      } else {
        errors.push(jinaEmbed._err || `JINA_EMBED_SHORT(${jinaEmbed.chars ?? 0}ch)`)
      }
    }

    // 3) oEmbed API (requires Meta app review — often fails)
    if (!igImage || !igText) {
      const oembed = await tryInstagramOembed(url)
      if (!oembed._err) {
        if (!igImage) igImage = oembed.thumbnail_url || null
        if (!igText)  igText  = oembed.caption || ''
      } else {
        errors.push(oembed._err)
      }
    }

    // 4) Jina on the post URL itself
    if (!igImage || igText.length < 80) {
      const jina = await fetchViaJina(url)
      if (!jina._err && jina.chars > 100) {
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jina.text}` : jina.text
        if (!igImage) igImage = extractJinaImage(jina.text)
      } else {
        errors.push(jina._err || `JINA_SHORT(${jina.chars ?? 0}ch)`)
      }
    }

    // — Extract from caption text
    let textData = null
    if (igText.length > 50) {
      const { data, diag } = await callGemini(igText, apiKey)
      textData = data
      if (!data && diag) errors.push(`GEMINI_TEXT(${diag})`)
    }

    // — Proxy the flyer image (needed for vision + stable storage)
    const imageData = igImage ? await proxyImage(igImage, url) : null

    // — Vision on the flyer: Instagram captions rarely have date/location — the flyer image does
    let visionData = null
    if (imageData?.startsWith('data:') && (!textData?.date || !textData?.location)) {
      visionData = await callGeminiVision(imageData, apiKey)
    }

    // — Merge: text for title, vision for date/time/location/end_date
    const merged = {
      title:    textData?.title    || visionData?.title    || null,
      date:     textData?.date     || visionData?.date     || null,
      end_date: textData?.end_date || visionData?.end_date || null,
      time_str: textData?.time_str || visionData?.time_str || null,
      location: textData?.location || visionData?.location || null,
    }

    if (merged.title || merged.date) {
      return NextResponse.json({ ...merged, og_image: imageData || igImage })
    }
    if (imageData) {
      return NextResponse.json({
        ...merged, og_image: imageData,
        warning: "Got the flyer image, but couldn't read the event details — fill them in below.",
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
    }

    // OG: event cover image (decode HTML entities — Facebook HTML has &amp; in URLs)
    if (!ogResult._err) {
      if (ogResult.image) merged.og_image = decodeHtml(ogResult.image)
      if (ogResult.title && !merged.title) merged.title = ogResult.title
    } else {
      errors.push(ogResult._err)
    }

    // Jina: full rendered page text → Gemini extracts venue name + time
    // Facebook's rendered page explicitly states "Saturday, June 20 at 10 PM – 2 AM CDT"
    let jinaText = (!jinaResult._err && jinaResult.chars > 100) ? jinaResult.text : ''
    if (!jinaText) errors.push(jinaResult._err || `JINA_SHORT(${jinaResult.chars ?? 0}ch)`)
    if (!merged.og_image && jinaText) merged.og_image = extractJinaImage(jinaText)

    // Gemini on Jina text (preferred) or iCal description (fallback)
    const geminiInput = jinaText || (icalResult.description ? `${merged.title || ''}\n${icalResult.description}` : '')
    if (geminiInput.length > 30) {
      const { data, diag } = await callGemini(geminiInput, apiKey)
      if (data) {
        // Gemini from rendered page is best for venue name and time
        if (data.location) merged.location = data.location
        if (data.time_str && !merged.time_str) merged.time_str = data.time_str
        if (data.title && !merged.title) merged.title = data.title
        if (data.date && !merged.date) merged.date = data.date
        if (data.end_date && !merged.end_date) merged.end_date = data.end_date
      } else if (diag) errors.push(`GEMINI(${diag})`)
    }

    // Last resort: Graph API (requires special app permissions, usually fails)
    if (!merged.title || !merged.date) {
      const fb = await tryFacebookGraphAPI(occurrenceId || seriesId)
      if (!fb._err) {
        for (const k of Object.keys(merged)) if (!merged[k] && fb[k]) merged[k] = fb[k]
      } else if (fb._err !== 'NO_CREDS') errors.push(fb._err)
    }

    if (merged.title || merged.date) {
      merged.og_image = await proxyImage(merged.og_image, url)
      // Vision on cover image for any still-missing fields
      if (merged.og_image?.startsWith('data:') && (!merged.date || !merged.time_str || !merged.location)) {
        const vd = await callGeminiVision(merged.og_image, apiKey)
        if (vd) for (const k of Object.keys(merged)) if (!merged[k] && vd[k]) merged[k] = vd[k]
      }
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

  const ogImageData = await proxyImage(ogImageUrl, url)
  const { data, diag } = await callGemini(textForGemini, apiKey)
  if (data) return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })

  return NextResponse.json({ error: `Could not extract event details from that URL.${diag ? ` [GEMINI: ${diag}]` : ''}` }, { status: 500 })
}
