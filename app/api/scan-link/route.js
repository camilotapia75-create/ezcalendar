import { NextResponse } from 'next/server'

// Node.js runtime — fallback chains can take 30-60s; edge would hard-timeout
export const maxDuration = 60

const PROMPT = `Extract event details from this webpage content. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD",
  "time_str": "time range e.g. 7:00 PM – 10:00 PM",
  "location": "venue name and/or city"
}`

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
].map(m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
}

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

async function tryInstagramOembed(url) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return { _err: 'NO_CREDS' }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(url)}&fields=thumbnail_url,title,author_name&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error) return { _err: `IG_OEMBED_${data.error.code}: ${data.error.message}` }
    return { thumbnail_url: data.thumbnail_url || null, caption: data.title || '' }
  } catch (e) {
    return { _err: `IG_OEMBED_THROW: ${e.message}` }
  }
}

// Instagram's public embed page — serves image + caption without login or API approval
async function tryInstagramEmbed(type, shortcode) {
  try {
    const res = await fetch(`https://www.instagram.com/${type}/${shortcode}/embed/captioned/`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { _err: `IG_EMBED_HTTP_${res.status}` }
    const html = await res.text()

    let image =
      html.match(/class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i)?.[1] ||
      html.match(/src=["']([^"']+)["'][^>]*class=["']EmbeddedMediaImage["']/i)?.[1] ||
      null
    if (!image) {
      const duMatch = html.match(/"display_url"\s*\\?:\s*\\?"((?:https?|\\\/\\\/)[^"]+?)\\?"/)
      if (duMatch) image = duMatch[1]
    }
    if (image) {
      image = image
        .replace(/\\u0026/gi, '&')
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
    }

    let caption = ''
    const capMatch = html.match(/<div[^>]*class=["'][^"']*Caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    if (capMatch) {
      caption = capMatch[1]
        .replace(/<br[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/[ \t]+/g, ' ').trim()
    }

    if (!image && !caption) {
      const wall = /login|consent|challenge/i.test(html.slice(0, 3000)) ? ',wall' : ''
      return { _err: `IG_EMBED_EMPTY(${html.length}ch${wall})` }
    }
    return { image, caption }
  } catch (e) {
    return { _err: `IG_EMBED_THROW: ${e.message}` }
  }
}

async function tryFacebookGraphAPI(eventId) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) return { _err: 'NO_CREDS' }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${eventId}?fields=name,description,start_time,end_time,place,cover&access_token=${appId}|${appSecret}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error) return { _err: `FB_API_${data.error.code}: ${data.error.message}` }
    if (!data.name) return { _err: `FB_API_NO_NAME status=${res.status}` }

    let dateStr = null, timeStr = null
    const parseTime = (iso) => {
      const m = iso?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
      if (!m) return null
      const h = parseInt(m[2]), min = m[3]
      const period = h >= 12 ? 'PM' : 'AM'
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
      return { date: m[1], time: `${h12}:${min} ${period}` }
    }
    const start = parseTime(data.start_time)
    if (start) {
      dateStr = start.date
      timeStr = start.time
      const end = parseTime(data.end_time)
      if (end) timeStr += ` – ${end.time}`
    }

    const location = data.place
      ? [data.place.name, data.place.location?.city].filter(Boolean).join(', ')
      : null

    let ogImage = data.cover?.source || null
    if (ogImage) {
      try {
        const imgRes = await fetch(ogImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)' },
          signal: AbortSignal.timeout(6000),
        })
        if (imgRes.ok) {
          const ct = imgRes.headers.get('content-type') || 'image/jpeg'
          if (ct.startsWith('image/')) {
            const buf = await imgRes.arrayBuffer()
            if (buf.byteLength < 800000) ogImage = `data:${ct};base64,${arrayBufferToBase64(buf)}`
          }
        }
      } catch {}
    }

    return { title: data.name, date: dateStr, time_str: timeStr, location, og_image: ogImage }
  } catch (e) {
    return { _err: `FB_API_THROW: ${e.message}` }
  }
}

// Facebook iCal export — public events expose structured data without login
async function tryFacebookICal(eventId) {
  try {
    const res = await fetch(`https://www.facebook.com/events/ical/export/?eid=${eventId}`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { _err: `ICAL_HTTP_${res.status}` }
    const text = await res.text()
    if (!text.includes('BEGIN:VEVENT')) return { _err: `ICAL_NOT_ICS(${text.length}ch)` }
    const unesc = s => s?.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
    const get = k => text.match(new RegExp(`^${k}([^:\\r\\n]*):(.+)$`, 'm'))
    const parseDt = (m) => {
      if (!m) return null
      const v = m[2].trim()
      const d = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/)
      if (!d) return null
      // Only trust clock time when it's local (TZID) — UTC would be hours off
      const isUtc = /Z\s*$/.test(v)
      const hasTz = /TZID=/i.test(m[1])
      let time = null
      if (d[4] && (hasTz || !isUtc)) {
        const h = parseInt(d[4])
        const h12 = h % 12 === 0 ? 12 : h % 12
        time = `${h12}:${d[5]} ${h >= 12 ? 'PM' : 'AM'}`
      }
      return { date: `${d[1]}-${d[2]}-${d[3]}`, time }
    }
    const s = parseDt(get('DTSTART'))
    const e = parseDt(get('DTEND'))
    let time_str = s?.time || null
    if (time_str && e?.time && e.date === s.date) time_str += ` – ${e.time}`
    return {
      title: unesc(get('SUMMARY')?.[2]) || null,
      date: s?.date || null,
      end_date: e && s && e.date !== s.date ? e.date : null,
      time_str,
      location: unesc(get('LOCATION')?.[2]) || null,
      description: unesc(get('DESCRIPTION')?.[2])?.slice(0, 2000) || null,
    }
  } catch (e) {
    return { _err: `ICAL_THROW: ${e.message}` }
  }
}

// Facebook serves og:image/og:title/og:description to link-preview crawlers
async function tryFacebookOg(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { _err: `FB_OG_HTTP_${res.status}` }
    const html = await res.text()
    const meta = (prop) =>
      html.match(new RegExp(`property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
      html.match(new RegExp(`content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] || null
    const decode = s => s?.replace(/&amp;/g, '&').replace(/&#x27;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') || null
    const image = decode(meta('image'))
    const title = decode(meta('title'))
    const description = decode(meta('description'))
    if (!image && !title) return { _err: `FB_OG_EMPTY(${html.length}ch)` }
    return { image, title, description }
  } catch (e) {
    return { _err: `FB_OG_THROW: ${e.message}` }
  }
}

async function fetchViaJina(url, format = 'text') {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)',
      'Accept': 'text/plain',
      // 'markdown' keeps ![image](...) links; 'text' strips them
      'X-Return-Format': format,
      'X-Timeout': '20',
    }
    if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: AbortSignal.timeout(22000),
    })
    const status = res.status
    if (!res.ok) return { _err: `JINA_HTTP_${status}` }
    const text = await res.text()
    return { text, chars: text.length }
  } catch (e) {
    return { _err: `JINA_THROW: ${e.message}` }
  }
}

function extractJinaImage(text) {
  const m =
    text.match(/!\[.*?\]\((https?:\/\/[^)\s"']+)\)/) ||
    text.match(/(https?:\/\/[^\s"'<>)]+(?:cdninstagram|fbcdn)[^\s"'<>)]+)/i) ||
    text.match(/(https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>)]*)?)/i)
  return m?.[1] || null
}

// Returns { data, diag } — diag lists per-model failures (e.g. "flash:429") so
// quota exhaustion is visible in error messages instead of silently returning null
async function callGemini(text, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\nContent:\n${text.slice(0, 8000)}` }] }],
  })
  const diags = []
  for (const modelUrl of MODELS) {
    const name = modelUrl.split('/models/')[1].split(':')[0].replace('gemini-', '')
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) { diags.push(`${name}:${res.status}`); continue }
      const result = await res.json()
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!raw) { diags.push(`${name}:empty`); continue }
      const match = raw.match(/\{[\s\S]*\}/)
      return { data: JSON.parse(match ? match[0] : raw), diag: diags.join(',') }
    } catch (e) { diags.push(`${name}:${(e.message || 'err').slice(0, 30)}`); continue }
  }
  return { data: null, diag: diags.join(',') }
}

// Read event details straight off the flyer image (data URL) when page text fails
async function callGeminiVision(dataUrl, apiKey) {
  const m = dataUrl?.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!m) return null
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today is ${today}. Extract event details from this flyer image. Return ONLY valid JSON with these exact keys (null for anything not found):
{
  "title": "event name or title",
  "date": "YYYY-MM-DD — if the flyer shows a partial date like 'Jul 24' with no year, infer the nearest future year",
  "time_str": "time range exactly as shown (e.g. '7:30 PM' or '4-8PM')",
  "location": "venue name and/or city"
}`
  const body = JSON.stringify({
    contents: [{ parts: [
      { inlineData: { mimeType: m[1], data: m[2] } },
      { text: prompt },
    ]}],
  })
  for (const modelUrl of MODELS) {
    try {
      const res = await fetch(`${modelUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) continue
      const result = await res.json()
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      if (!raw) continue
      const match = raw.match(/\{[\s\S]*\}/)
      return JSON.parse(match ? match[0] : raw)
    } catch { continue }
  }
  return null
}

async function proxyImage(imageUrl, referer) {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)', 'Referer': referer },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return imageUrl
    const ct = res.headers.get('content-type') || 'image/jpeg'
    if (!ct.startsWith('image/')) return imageUrl
    const buf = await res.arrayBuffer()
    if (buf.byteLength >= 800000) return imageUrl
    return `data:${ct};base64,${arrayBufferToBase64(buf)}`
  } catch {
    return imageUrl
  }
}

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
  try { baseUrl = new URL(url).origin } catch {}

  // —— Instagram posts / reels ——
  const igMatch = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i)
  if (igMatch) {
    const errors = []
    let igText = ''
    let igImage = null

    const embedUrl = `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/captioned/`

    // 1) Public embed page, fetched directly — works without login or Meta app review
    const embed = await tryInstagramEmbed(igMatch[1], igMatch[2])
    if (!embed._err) {
      igImage = embed.image || null
      igText = embed.caption || ''
    } else {
      errors.push(embed._err)
    }

    // 2) Embed page rendered through Jina's browser (markdown keeps image links)
    if (!igImage || igText.length < 80) {
      const jinaEmbed = await fetchViaJina(embedUrl, 'markdown')
      if (!jinaEmbed._err && jinaEmbed.text && jinaEmbed.chars > 100) {
        if (!igImage) igImage = extractJinaImage(jinaEmbed.text)
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jinaEmbed.text}` : jinaEmbed.text
      } else {
        errors.push(jinaEmbed._err ? `JINA_EMBED_${jinaEmbed._err}` : `JINA_EMBED_SHORT(${jinaEmbed.chars ?? 0}ch)`)
      }
    }

    // 3) oEmbed API (only works if the Meta app has oEmbed Read approval)
    if (!igImage || !igText) {
      const oembed = await tryInstagramOembed(url)
      if (!oembed._err) {
        if (!igImage) igImage = oembed.thumbnail_url || null
        if (!igText)  igText  = oembed.caption || ''
      } else {
        errors.push(oembed._err)
      }
    }

    // 4) Jina on the post URL itself, as last text source
    if (!igImage || igText.length < 80) {
      const jina = await fetchViaJina(url, 'markdown')
      if (!jina._err && jina.text && jina.chars > 100) {
        if (igText.length < 80) igText = igText ? `${igText}\n\n${jina.text}` : jina.text
        if (!igImage) igImage = extractJinaImage(jina.text)
      } else {
        errors.push(jina._err || `JINA_SHORT(${jina.chars ?? 0}ch)`)
      }
    }

    if (igText.length > 50) {
      const { data, diag } = await callGemini(igText, apiKey)
      if (data?.title || data?.date) {
        const imageData = await proxyImage(igImage, url)
        return NextResponse.json({ ...data, og_image: imageData || igImage })
      }
      errors.push(`GEMINI_NO_TITLE${diag ? `(${diag})` : ''}`)
    }

    if (igImage) {
      const imageData = await proxyImage(igImage, url)
      // Caption was useless — read the flyer image itself with Gemini vision
      const visionData = await callGeminiVision(imageData, apiKey)
      if (visionData?.title || visionData?.date) {
        return NextResponse.json({ ...visionData, og_image: imageData || igImage })
      }
      // Still got the flyer image — return it so the user can fill in details
      return NextResponse.json({
        title: null, date: null, time_str: null, location: null,
        og_image: imageData || igImage,
        warning: "Got the flyer image, but couldn't read the event details — fill them in below.",
      })
    }

    return NextResponse.json({
      error: `Could not read Instagram post. Instagram often requires login — try saving the flyer image and uploading it instead. [${errors.join(' | ')}]`,
    }, { status: 400 })
  }

  // —— Facebook events ——
  const fbMatch = url.match(/facebook\.com\/events\/(\d+)(?:\/(\d+))?/i)
  if (fbMatch) {
    const seriesId = fbMatch[1]
    const occurrenceId = fbMatch[2] || null
    const cleanFbUrl = url.split('?')[0]
    const errors = []

    const merged = { title: null, date: null, end_date: null, time_str: null, location: null, og_image: null }
    const fill = (src) => {
      if (!src) return
      for (const k of Object.keys(merged)) if (!merged[k] && src[k]) merged[k] = src[k]
    }
    let fbDescription = ''

    // 1) iCal export — structured date/title/location, public events need no login
    for (const id of [occurrenceId, seriesId].filter(Boolean)) {
      const ical = await tryFacebookICal(id)
      if (!ical._err) {
        fill(ical)
        if (ical.description) fbDescription = ical.description
        break
      }
      errors.push(`${ical._err}@${id}`)
    }

    // 2) Crawler-UA fetch — gets og:image (the event cover) + og:title/description
    const og = await tryFacebookOg(cleanFbUrl)
    if (!og._err) {
      fill({ title: og.title, og_image: og.image })
      if (og.description) fbDescription = `${fbDescription}\n${og.description}`.trim()
    } else {
      errors.push(og._err)
    }

    // 3) Gemini on description text for any still-missing fields
    if ((!merged.date || !merged.time_str || !merged.location) && fbDescription.length > 30) {
      const { data, diag } = await callGemini(`${merged.title || ''}\n${fbDescription}`, apiKey)
      if (data) fill(data)
      else if (diag) errors.push(`GEMINI(${diag})`)
    }

    // 4) Graph API (works only with special app permissions)
    if (!merged.title || !merged.date) {
      const fbResult = await tryFacebookGraphAPI(occurrenceId || seriesId)
      if (!fbResult?._err) fill(fbResult)
      else if (fbResult._err !== 'NO_CREDS') errors.push(fbResult._err)
    }

    // 5) Jina fallback only if still nothing usable
    if (!merged.title && !merged.date) {
      for (const fbUrl of [cleanFbUrl, `https://m.facebook.com/events/${occurrenceId || seriesId}/`]) {
        const jina = await fetchViaJina(fbUrl, 'markdown')
        if (!jina._err && jina.text && jina.chars > 100) {
          if (!merged.og_image) merged.og_image = extractJinaImage(jina.text)
          const { data, diag } = await callGemini(jina.text, apiKey)
          if (data?.title) { fill(data); break }
          errors.push(`JINA_NO_TITLE(${jina.chars}ch${diag ? `;${diag}` : ''})`)
        } else {
          errors.push(jina._err || `JINA_SHORT(${jina.chars ?? 0}chars)`)
        }
      }
    }

    if (merged.title || merged.date) {
      merged.og_image = await proxyImage(merged.og_image, url)
      // Cover image often holds details the page text doesn't — fill gaps with vision
      if (!merged.date || !merged.time_str || !merged.location) {
        fill(await callGeminiVision(merged.og_image, apiKey))
      }
      return NextResponse.json({
        ...merged,
        ...(merged.date ? {} : { warning: "Couldn't read the date — set it below." }),
      })
    }

    return NextResponse.json({ error: `Could not access Facebook event. [${errors.join(' | ')}]` }, { status: 400 })
  }

  // —— Step 1: Direct HTML fetch ——
  let html = ''
  let blocked = false
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) })
    if (res.ok) {
      html = await res.text()
    } else {
      blocked = true
    }
  } catch (err) {
    return NextResponse.json({ error: `Could not reach URL: ${err.message}` }, { status: 400 })
  }

  let ogImageUrl = null
  let textForGemini = ''

  if (html) {
    const ogMatch =
      html.match(/property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    ogImageUrl = ogMatch?.[1] || null
    if (ogImageUrl) {
      if (ogImageUrl.startsWith('//')) ogImageUrl = 'https:' + ogImageUrl
      else if (ogImageUrl.startsWith('/')) ogImageUrl = baseUrl + ogImageUrl
      else if (!ogImageUrl.startsWith('http')) ogImageUrl = baseUrl + '/' + ogImageUrl
    }

    let structuredInfo = ''
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let ldMatch
    while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const items = [JSON.parse(ldMatch[1])].flat()
        for (const item of items) {
          const types = [item['@type']].flat()
          if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('event'))) {
            structuredInfo += '\nEvent JSON-LD: ' + JSON.stringify(item).slice(0, 3000)
            // Extract image from JSON-LD event schema
            if (!ogImageUrl) {
              const img = item.image
              const imgUrl = Array.isArray(img) ? img[0] : (typeof img === 'object' ? img?.url : img)
              if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) ogImageUrl = imgUrl
            }
          }
        }
      } catch {}
    }

    const metaMatch =
      html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const metaDesc = metaMatch?.[1] || ''

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 5000)

    textForGemini = [structuredInfo, metaDesc && `Meta: ${metaDesc}`, `Page text:\n${pageText}`].filter(Boolean).join('\n\n')
  }

  // —— Step 2: Jina AI Reader fallback ——
  if (blocked || !html) {
    const jinaResult = await fetchViaJina(url)
    if (!jinaResult._err && jinaResult.text && jinaResult.chars > 100) {
      textForGemini = jinaResult.text
      if (!ogImageUrl) {
        // Try markdown image, then bare URL ending in image ext
        const imgMatch =
          jinaResult.text.match(/!\[.*?\]\((https?:\/\/[^)\s"']+)\)/) ||
          jinaResult.text.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/i)
        if (imgMatch) ogImageUrl = imgMatch[1]
      }
    } else {
      return NextResponse.json({ error: 'Could not access that page. Try a different URL or paste an image of the event instead.' }, { status: 400 })
    }
  }

  // —— Step 2b: Also try Jina if we got HTML but have no image yet ——
  if (html && !ogImageUrl) {
    const jinaResult = await fetchViaJina(url)
    if (!jinaResult._err && jinaResult.text) {
      const imgMatch =
        jinaResult.text.match(/!\[.*?\]\((https?:\/\/[^)\s"']+)\)/) ||
        jinaResult.text.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/i)
      if (imgMatch) ogImageUrl = imgMatch[1]
    }
  }

  const ogImageData = await proxyImage(ogImageUrl, url)
  const { data, diag } = await callGemini(textForGemini, apiKey)
  if (data) return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })

  return NextResponse.json({ error: `Could not extract event details from that URL.${diag ? ` [GEMINI: ${diag}]` : ''}` }, { status: 500 })
}
