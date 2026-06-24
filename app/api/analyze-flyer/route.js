import { NextResponse } from 'next/server'

function getPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `Today is ${today}. Extract event details from this flyer image. If the flyer lists multiple events or dates, extract ONLY the FIRST one listed. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD start date — when a day-of-week label (MON/TUE/WED/THU/FRI/SAT/SUN) appears with a day number and year but no explicit month name (e.g. 'MON 22, 2026' or 'MON ⚽ 22, 2026'), determine the correct month by finding which month in that year has that weekday on that day number. If the flyer shows a partial date like 'Jul 24' with no year, infer the nearest future year. For multi-day events this is the first day.",
  "end_date": "YYYY-MM-DD end date — only if the event explicitly spans multiple days (e.g. 'Jul 4-6', 'July 4 to July 6'). null if single-day.",
  "time_str": "time range exactly as shown on the flyer (e.g. '7:30 PM' or '4-8PM')",
  "location": "venue name and/or city"
}`
}

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
].map(m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)

// Extract the first syntactically complete JSON object using brace-depth tracking.
// The greedy /\{[\s\S]*\}/ regex fails when Gemini returns multiple objects
// (one per event) because it captures everything from first { to last }.
function extractFirstJson(text) {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

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
      { text: getPrompt() },
    ]}],
  })

  const errors = []
  let anyNonQuota = false

  for (const url of MODELS) {
    const modelName = url.split('/models/')[1].split(':')[0]
    try {
      const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
        signal: AbortSignal.timeout(30000),
      })

      const result = await res.json()
      const errMsg = result?.error?.message ?? ''

      if (res.status === 429) {
        errors.push(`${modelName}:429`)
        continue
      }

      anyNonQuota = true

      if (!res.ok) {
        errors.push(`${modelName}:${res.status}`)
        continue
      }

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!text) {
        errors.push(`${modelName}:empty`)
        continue
      }

      const extracted = extractFirstJson(text) || text
      const data = JSON.parse(extracted)
      return NextResponse.json(data)
    } catch (err) {
      anyNonQuota = true
      errors.push(`${modelName}:${(err.message || 'err').slice(0, 40)}`)
    }
  }

  const detail = errors.join(' | ')
  if (!anyNonQuota) return NextResponse.json({ error: 'quota', detail }, { status: 429 })
  return NextResponse.json({ error: 'failed', detail }, { status: 500 })
}
