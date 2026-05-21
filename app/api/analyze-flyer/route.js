import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`

const MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
]

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

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

    for (const url of MODELS) {
      try {
        const res = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })

        const result = await res.json()

        if (res.status === 429) {
          console.error('[analyze-flyer] quota exceeded')
          return NextResponse.json({ error: 'quota' }, { status: 429 })
        }

        if (!res.ok) {
          console.error(`[analyze-flyer] ${url} → ${res.status}:`, result?.error?.message)
          continue
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
        if (!text) {
          console.error(`[analyze-flyer] ${url} → empty response`)
          continue
        }

        try {
          const match = text.match(/\{[\s\S]*\}/)
          const data = JSON.parse(match ? match[0] : text)
          return NextResponse.json(data)
        } catch {
          console.error(`[analyze-flyer] JSON parse failed, text:`, text.slice(0, 200))
          continue
        }
      } catch (err) {
        console.error(`[analyze-flyer] fetch threw:`, err.message)
      }
    }
  } catch (err) {
    console.error('[analyze-flyer] outer error:', err)
  }

  return NextResponse.json({ error: 'failed' }, { status: 500 })
}
