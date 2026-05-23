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

  // Fetch the URL server-side (bypasses browser CORS)
  let html = ''
  let ogImage = null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${err.message}` }, { status: 400 })
  }

  // Extract og:image for the flyer preview
  const ogMatch =
    html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  ogImage = ogMatch?.[1] || null

  // Strip scripts/styles/tags → readable plain text
  const pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\nWebpage content:\n${pageText}` }] }],
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
      return NextResponse.json({ ...data, og_image: ogImage })
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: 'Could not extract event details from that URL' }, { status: 500 })
}
