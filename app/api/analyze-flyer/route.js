import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`

// Try models in order until one succeeds
const MODELS = [
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
]

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_AI_API_KEY is not set')
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  try {
    const { imageData, mediaType } = await request.json()
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const mimeType = mediaType?.startsWith('image/') ? mediaType : 'image/jpeg'

    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: PROMPT },
        ],
      }],
    })

    for (const url of MODELS) {
      try {
        const res = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })

        const result = await res.json()

        if (!res.ok) {
          console.error(`[analyze-flyer] ${url} → ${res.status}:`, result?.error?.message)
          continue
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
        if (!text) {
          console.error(`[analyze-flyer] ${url} → empty response`)
          continue
        }

        const match = text.match(/\{[\s\S]*\}/)
        const data = JSON.parse(match ? match[0] : text)
        console.log('[analyze-flyer] success via', url)
        return NextResponse.json(data)
      } catch (err) {
        console.error(`[analyze-flyer] ${url} threw:`, err.message)
      }
    }

    return NextResponse.json({ error: 'All models failed' }, { status: 500 })
  } catch (err) {
    console.error('[analyze-flyer] outer error:', err)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
