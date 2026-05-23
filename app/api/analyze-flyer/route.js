import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`

// gemini-1.5 models live at v1 (stable), gemini-2.0 at v1beta
const MODELS = [
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-002:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-001:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-001:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
]

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured', detail: 'missing api key' }, { status: 500 })
  }

  let imageData, mediaType
  try {
    const body = await request.json()
    imageData = body.imageData
    mediaType = body.mediaType
  } catch (err) {
    return NextResponse.json({ error: 'failed', detail: 'body parse: ' + err.message }, { status: 500 })
  }

  if (!imageData) {
    return NextResponse.json({ error: 'failed', detail: 'no imageData' }, { status: 500 })
  }

  const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
  const mimeType = mediaType?.startsWith('image/') ? mediaType : 'image/jpeg'

  const geminiBody = JSON.stringify({
    contents: [{ parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: PROMPT },
    ]}],
  })

  const errors = []
  let anyNonQuota = false

  for (const url of MODELS) {
    const modelName = url.split('/models/')[1]
    try {
      const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      })

      const result = await res.json()
      const errMsg = result?.error?.message ?? ''

      if (res.status === 429) {
        console.error(`[analyze-flyer] ${modelName} → 429: ${errMsg}`)
        errors.push(`${modelName}: 429`)
        continue
      }

      anyNonQuota = true

      if (!res.ok) {
        console.error(`[analyze-flyer] ${modelName} → ${res.status}: ${errMsg}`)
        errors.push(`${modelName}: ${res.status} ${errMsg}`)
        continue
      }

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!text) {
        errors.push(`${modelName}: empty response`)
        continue
      }

      const match = text.match(/\{[\s\S]*\}/)
      const data = JSON.parse(match ? match[0] : text)
      console.log(`[analyze-flyer] success: ${modelName}`)
      return NextResponse.json(data)
    } catch (err) {
      anyNonQuota = true
      errors.push(`${modelName}: ${err.message}`)
    }
  }

  const detail = errors.join(' | ')
  console.error('[analyze-flyer] all models failed:', detail)

  if (!anyNonQuota) {
    return NextResponse.json({ error: 'quota', detail }, { status: 429 })
  }
  return NextResponse.json({ error: 'failed', detail }, { status: 500 })
}
