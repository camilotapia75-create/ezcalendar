import { NextResponse } from 'next/server'

const PROMPT = `Extract event details from this flyer. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if year is abbreviated like '26' treat as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`

const MODELS = [
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-002:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-001:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
]

export async function POST(request) {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    console.error('[analyze-flyer] GOOGLE_AI_API_KEY not set')
    return NextResponse.json({ error: 'AI not configured', detail: 'missing api key' }, { status: 500 })
  }

  let imageData, mediaType
  try {
    const body = await request.json()
    imageData = body.imageData
    mediaType = body.mediaType
    console.log('[analyze-flyer] body parsed, imageData length:', imageData?.length ?? 'undefined')
  } catch (err) {
    console.error('[analyze-flyer] body parse failed:', err.message)
    return NextResponse.json({ error: 'failed', detail: 'body parse error: ' + err.message }, { status: 500 })
  }

  if (!imageData) {
    return NextResponse.json({ error: 'failed', detail: 'no imageData in request' }, { status: 500 })
  }

  const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
  const mimeType = mediaType?.startsWith('image/') ? mediaType : 'image/jpeg'
  console.log('[analyze-flyer] base64 length:', base64.length, 'mimeType:', mimeType)

  const geminiBody = JSON.stringify({
    contents: [{
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: PROMPT },
      ],
    }],
  })

  let allQuota = true
  const errors = []

  for (const url of MODELS) {
    try {
      console.log('[analyze-flyer] trying:', url)
      const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      })

      const result = await res.json()

      if (res.status === 429) {
        console.error(`[analyze-flyer] ${url} → 429 quota`)
        errors.push(`${url.split('/models/')[1]}: 429`)
        continue
      }

      allQuota = false

      if (!res.ok) {
        const msg = result?.error?.message ?? res.status
        console.error(`[analyze-flyer] ${url} → ${res.status}:`, msg)
        errors.push(`${url.split('/models/')[1]}: ${res.status} ${msg}`)
        continue
      }

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!text) {
        console.error(`[analyze-flyer] ${url} → empty text`)
        errors.push(`${url.split('/models/')[1]}: empty response`)
        continue
      }

      const match = text.match(/\{[\s\S]*\}/)
      const data = JSON.parse(match ? match[0] : text)
      console.log('[analyze-flyer] success via', url)
      return NextResponse.json(data)
    } catch (err) {
      allQuota = false
      console.error(`[analyze-flyer] ${url} threw:`, err.message)
      errors.push(`${url.split('/models/')[1]}: threw ${err.message}`)
    }
  }

  if (allQuota) {
    return NextResponse.json({ error: 'quota', detail: errors.join(' | ') }, { status: 429 })
  }
  return NextResponse.json({ error: 'failed', detail: errors.join(' | ') }, { status: 500 })
}
