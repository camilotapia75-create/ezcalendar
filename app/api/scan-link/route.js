import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this webpage content. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the page",
  "location": "venue name and/or city"
}`

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
].map(m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)

const EMPTY = { title: null, date: null, time_str: null, location: null, og_image: null }

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
  try {
    const parsed = new URL(url)
    baseUrl = `${parsed.protocol}//${parsed.host}`
  } catch {}

  // Fetch page HTML server-side
  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      // Site blocked the request (login wall, bot protection, etc.) — let user fill in manually
      return NextResponse.json({
        ...EMPTY,
        warning: `This site (${new URL(url).hostname}) requires login or blocks automated reading. Fill in the details below.`,
      })
    }
    html = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Could not reach URL: ${err.message}` }, { status: 400 })
  }

  // Extract og:image / twitter:image
  const ogMatch =
    html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    html.match(/name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
  let ogImageUrl = ogMatch?.[1] || null
  if (ogImageUrl) {
    if (ogImageUrl.startsWith('//')) ogImageUrl = 'https:' + ogImageUrl
    else if (ogImageUrl.startsWith('/')) ogImageUrl = baseUrl + ogImageUrl
    else if (!ogImageUrl.startsWith('http')) ogImageUrl = baseUrl + '/' + ogImageUrl
  }

  // Extract JSON-LD structured data — most reliable source for event sites
  let structuredInfo = ''
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let ldMatch
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const ldData = JSON.parse(ldMatch[1])
      const items = Array.isArray(ldData) ? ldData : [ldData]
      for (const item of items) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
        if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('event'))) {
          structuredInfo += '\nStructured Event Data (JSON-LD): ' + JSON.stringify(item).slice(0, 3000)
        }
      }
    } catch {}
  }

  // Meta description fallback
  const descMatch =
    html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
    html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  const metaDesc = descMatch?.[1] || ''

  // Strip HTML → plain text
  const pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)

  // Proxy og:image server-side to avoid hotlink protection
  let ogImageData = null
  if (ogImageUrl) {
    try {
      const imgRes = await fetch(ogImageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)', 'Referer': url },
        signal: AbortSignal.timeout(6000),
      })
      if (imgRes.ok) {
        const ct = imgRes.headers.get('content-type') || 'image/jpeg'
        if (ct.startsWith('image/')) {
          const buf = await imgRes.arrayBuffer()
          if (buf.byteLength < 800000) {
            ogImageData = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
          }
        }
      }
    } catch {}
  }

  const contextParts = []
  if (structuredInfo) contextParts.push(structuredInfo.trim())
  if (metaDesc) contextParts.push(`Page meta description: ${metaDesc}`)
  contextParts.push(`Page text:\n${pageText}`)

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\n${contextParts.join('\n\n')}` }] }],
  })

  for (const modelUrl of MODELS) {
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      })
      if (!res.ok) continue
      const result = await res.json()
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!raw) continue
      const match = raw.match(/\{[\s\S]*\}/)
      const data = JSON.parse(match ? match[0] : raw)
      return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })
    } catch {
      continue
    }
  }

  // Gemini failed but we have the URL — still let user fill in manually
  return NextResponse.json({ ...EMPTY, warning: 'Could not extract event details automatically. Fill in below.' })
}
