import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this webpage content. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD",
  "time_str": "time range e.g. 7:00 PM – 10:00 PM",
  "location": "venue name and/or city"
}`

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

async function tryFacebookGraphAPI(eventId) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return { _needsCreds: true }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${eventId}?fields=name,description,start_time,end_time,place,cover&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error || !data.name) return null

    let dateStr = null, timeStr = null
    const parseTime = (iso) => {
      const m = iso?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
      if (!m) return null
      const h = parseInt(m[2]), min = m[3]
      const period = h >= 12 ? 'PM' : 'AM'
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
      return { date: m[1], time: `${h12}:${min} ${period}` }
    }
    const start = parseTime(data.start_time)
    if (start) {
      dateStr = start.date
      timeStr = start.time
      const end = parseTime(data.end_time)
      if (end) timeStr += ` – ${end.time}`
    }

    const location = data.place
      ? [data.place.name, data.place.location?.city].filter(Boolean).join(', ')
      : null

    let ogImage = data.cover?.source || null
    if (ogImage) {
      try {
        const imgRes = await fetch(ogImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)' },
          signal: AbortSignal.timeout(6000),
        })
        if (imgRes.ok) {
          const ct = imgRes.headers.get('content-type') || 'image/jpeg'
          if (ct.startsWith('image/')) {
            const buf = await imgRes.arrayBuffer()
            if (buf.byteLength < 800000) ogImage = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
          }
        }
      } catch {}
    }

    return { title: data.name, date: dateStr, time_str: timeStr, location, og_image: ogImage }
  } catch {
    return null
  }
}

async function fetchViaJina(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)',
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-Timeout': '20',
      },
      signal: AbortSignal.timeout(28000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function callGemini(text, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\nContent:\n${text.slice(0, 8000)}` }] }],
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
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)', 'Referer': referer },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return imageUrl
    const ct = res.headers.get('content-type') || 'image/jpeg'
    if (!ct.startsWith('image/')) return imageUrl
    const buf = await res.arrayBuffer()
    if (buf.byteLength >= 800000) return imageUrl
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
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

  // Facebook events: try Graph API first, then fall through to Jina
  const fbMatch = url.match(/facebook\.com\/events\/(\d+)/i)
  if (fbMatch) {
    const fbResult = await tryFacebookGraphAPI(fbMatch[1])
    if (fbResult?._needsCreds) {
      return NextResponse.json({
        error: 'Facebook scanning needs a one-time setup: add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to your Vercel environment variables.',
      }, { status: 400 })
    }
    if (fbResult) return NextResponse.json(fbResult)
    // Graph API returned null (permissions issue or private event) — fall through to Jina
  }

  // Step 1: Direct HTML fetch
  let html = ''
  let blocked = false
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) })
    if (res.ok) {
      html = await res.text()
    } else {
      blocked = true
    }
  } catch (err) {
    return NextResponse.json({ error: `Could not reach URL: ${err.message}` }, { status: 400 })
  }

  let ogImageUrl = null
  let textForGemini = ''

  if (html) {
    const ogMatch =
      html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    ogImageUrl = ogMatch?.[1] || null
    if (ogImageUrl) {
      if (ogImageUrl.startsWith('//')) ogImageUrl = 'https:' + ogImageUrl
      else if (ogImageUrl.startsWith('/')) ogImageUrl = baseUrl + ogImageUrl
      else if (!ogImageUrl.startsWith('http')) ogImageUrl = baseUrl + '/' + ogImageUrl
    }

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
          }
        }
      } catch {}
    }

    const metaMatch =
      html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const metaDesc = metaMatch?.[1] || ''

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 5000)

    textForGemini = [structuredInfo, metaDesc && `Meta: ${metaDesc}`, `Page text:\n${pageText}`].filter(Boolean).join('\n\n')
  }

  // Step 2: Jina AI Reader fallback
  if (blocked || !html) {
    const jinaText = await fetchViaJina(url)
    if (jinaText && jinaText.length > 100) {
      textForGemini = jinaText
      const imgMatch = jinaText.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/)
      if (imgMatch) ogImageUrl = imgMatch[1]
    } else {
      return NextResponse.json({ error: 'Could not access that page. Try a different URL or paste an image of the event instead.' }, { status: 400 })
    }
  }

  const ogImageData = await proxyImage(ogImageUrl, url)
  const data = await callGemini(textForGemini, apiKey)
  if (data) return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })

  return NextResponse.json({ error: 'Could not extract event details from that URL.' }, { status: 500 })
}
