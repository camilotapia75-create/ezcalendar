import { NextResponse } from 'next/server'

const MODEL = 'gemini-2.0-flash'

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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              {
                text: `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`,
              },
            ],
          }],
        }),
      }
    )

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = body?.error?.message || `HTTP ${res.status}`
      console.error('Gemini error:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const result = await res.json()
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(match ? match[0] : text)
    return NextResponse.json(data)
  } catch (err) {
    console.error('analyze-flyer error:', err)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
