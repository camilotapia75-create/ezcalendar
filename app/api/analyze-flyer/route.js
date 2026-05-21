import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`

const MODELS = [
  { url: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent', label: 'v1/1.5-flash' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', label: 'v1beta/2.0-flash' },
  { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent', label: 'v1beta/1.5-flash-latest' },
]

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_AI_API_KEY env var is not set in Vercel' }, { status: 500 })
  }

  const errors = []

  try {
    const { imageData, mediaType } = await request.json()
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const mimeType = mediaType?.startsWith('image/') ? mediaType : 'image/jpeg'

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: PROMPT },
        ],
      }],
    })

    for (const { url, label } of MODELS) {
      try {
        const res = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })

        const result = await res.json()

        if (!res.ok) {
          const msg = `${label}: HTTP ${res.status} — ${result?.error?.message ?? 'unknown'}`
          errors.push(msg)
          console.error('[analyze-flyer]', msg)
          continue
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
        if (!text) {
          const msg = `${label}: empty response (finishReason: ${result.candidates?.[0]?.finishReason ?? 'none'})`
          errors.push(msg)
          console.error('[analyze-flyer]', msg)
          continue
        }

        try {
          const match = text.match(/\{[\s\S]*\}/)
          const data = JSON.parse(match ? match[0] : text)
          console.log('[analyze-flyer] success via', label)
          return NextResponse.json(data)
        } catch {
          const msg = `${label}: JSON parse failed — response was: ${text.slice(0, 100)}`
          errors.push(msg)
          console.error('[analyze-flyer]', msg)
        }
      } catch (err) {
        const msg = `${label}: fetch threw — ${err.message}`
        errors.push(msg)
        console.error('[analyze-flyer]', msg)
      }
    }
  } catch (err) {
    return NextResponse.json({ error: `Request parse error: ${err.message}` }, { status: 500 })
  }

  return NextResponse.json({ error: errors.join(' | ') }, { status: 500 })
}
