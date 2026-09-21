import { NextResponse } from 'next/server'
import { getGeminiUrls } from '@/lib/geminiModels'

function getPrompt() {
  const today = new Date().toISOString().split('T')[0]
  return `Today is ${today}. Extract event details from this flyer image. Return ONLY one valid JSON object with these exact keys (null for anything not found):
{
  "title": "event name or title. For a festival/faire/venue/series with a schedule of multiple dates, this is the OVERALL name (e.g. 'NorCal Renaissance Faire'), not one date's sub-theme.",
  "date": "YYYY-MM-DD start date — when a day-of-week label (MON/TUE/WED/THU/FRI/SAT/SUN) appears with a day number and year but no explicit month name (e.g. 'MON 22, 2026' or 'MON ⚽ 22, 2026'), determine the correct month by finding which month in that year has that weekday on that day number. See the YEAR rule below when no year is printed.",
  "end_date": "YYYY-MM-DD end date — ONLY for a CONTINUOUS multi-day run at one place (e.g. 'Jul 4-6'). null otherwise.",
  "time_str": "time range exactly as shown on the flyer (e.g. '7:30 PM' or '4-8PM')",
  "location": "venue name and/or city",
  "occurrences": "null for single/continuous events. Otherwise an array of EVERY date the event happens: [{\\"date\\":\\"YYYY-MM-DD\\",\\"time_str\\":\\"...\\",\\"location\\":\\"...\\",\\"label\\":\\"that date's sub-theme/guest/name or null\\"}, ...]. One entry per calendar day — expand each listed weekend or 'Fri–Sun' range into its individual days.",
  "recurrence": "null unless the event REPEATS weekly (e.g. 'every Thursday', 'Thursdays'). If it does, {\\"frequency\\":\\"weekly\\",\\"weekdays\\":[\\"thursday\\"]} — lowercase full weekday names, include every weekday it repeats on."
}

IMPORTANT — first decide the schedule type, then fill accordingly:
1. SINGLE date → set "date"; "end_date" null; "occurrences" null; "recurrence" null.
2. CONTINUOUS RANGE (one event, consecutive days, same place, e.g. "Jul 4–6") → "date"=first, "end_date"=last; "occurrences" null.
3. MULTIPLE DATES → list EVERY date in "occurrences"; set top-level date/time/location to the soonest one; "end_date" null. This covers BOTH the same event on several dates AND a festival/faire/venue/tour whose schedule spans many dates — even when each date has its OWN theme, guest, headliner, or sub-name. Those themed dates all belong to ONE event: put the overall event name in "title" and each date's sub-name in that occurrence's "label". A run of themed weekends (e.g. "Sept 19–20, Sept 26–27, Oct 3–4, …") = one occurrence per DAY (Sept 19, Sept 20, Sept 26, Sept 27, …).
4. RECURRING (repeats weekly, e.g. "every Thursday") → set "recurrence"; "date" = soonest upcoming matching date; "end_date" and "occurrences" null.

YEAR (when the flyer prints NO year): pick ONE year for the WHOLE flyer and apply it to every date. Choose the earliest year in which the LAST/latest date on the flyer is still today or later — i.e. so the schedule as a whole is upcoming, not already finished. Do NOT roll only the first date into a later year: a schedule running e.g. "Sept 19 – Oct 25", read on Sept 21, is THIS year (Sept 19 just passed but the run is ongoing), NOT next year. Only use next year when EVERY date on the flyer has already passed this year. Never assign different years to dates from the same flyer.

COMPLETENESS: include EVERY date shown on the flyer. Never stop after the first. If the flyer lists N dates or date-ranges, "occurrences" must account for ALL of them (expanding ranges to individual days). Do not summarize or truncate the schedule.

Only when the image combines clearly UNRELATED events with no shared umbrella (different organizers, no common festival/venue name) should you extract just the first event.`
}

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
    // Deterministic extraction: temperature 0 removes the run-to-run variance
    // that made multi-date flyers scan correctly only "sometimes". Forcing JSON
    // output keeps the response a single object, and the big token ceiling gives
    // long schedules (12+ dates) room so they aren't truncated.
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
  })

  const errors = []
  let anyNonQuota = false

  const MODELS = await getGeminiUrls(apiKey)
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
