import { NextResponse } from 'next/server'

export const runtime = 'edge'

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
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
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

async function fetchViaJina(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EZCalendar/1.0)',
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-Timeout': '20',
      },
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

async function callGemini(text, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\nContent:\n${text.slice(0, 8000)}` }] }],
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

    // 1) oEmbed API gives thumbnail + caption without requiring user login
    const oembed = await tryInstagramOembed(url)
    if (!oembed._err) {
      igImage = oembed.thumbnail_url || null
      igText = oembed.caption || ''
    } else {
      errors.push(oembed._err)
    }

    // 2) Jina fallback for richer text
    const jina = await fetchViaJina(url)
    if (!jina._err && jina.text && jina.chars > 100) {
      igText = igText ? `${igText}\n\n${jina.text}` : jina.text
      if (!igImage) {
        const imgMatch = jina.text.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/)
        if (imgMatch) igImage = imgMatch[1]
      }
    } else {
      errors.push(jina._err || `JINA_SHORT(${jina.chars ?? 0}chars)`)
    }

    if (igText.length > 50) {
      const data = await callGemini(igText, apiKey)
      if (data?.title || data?.date) {
        const imageData = await proxyImage(igImage, url)
        return NextResponse.json({ ...data, og_image: imageData || igImage })
      }
      errors.push('GEMINI_NO_TITLE')
    }

    return NextResponse.json({
      error: `Could not read Instagram post. Instagram often requires login — try saving the flyer image and uploading it instead. [${errors.join(' | ')}]`,
    }, { status: 400 })
  }

  // —— Facebook events ——
  const fbMatch = url.match(/facebook\.com\/events\/(\d+)/i)
  if (fbMatch) {
    const eventId = fbMatch[1]
    const errors = []

    // 1) Try Graph API
    const fbResult = await tryFacebookGraphAPI(eventId)
    if (fbResult?._err === 'NO_CREDS') {
      return NextResponse.json({ error: 'Facebook credentials not configured.' }, { status: 400 })
    }
    if (!fbResult?._err) {
      // Graph API succeeded
      return NextResponse.json(fbResult)
    }
    errors.push(fbResult._err)

    // 2) Try Jina on desktop Facebook URL
    const jina1 = await fetchViaJina(`https://www.facebook.com/events/${eventId}/`)
    if (!jina1._err && jina1.text && jina1.chars > 100) {
      const imgMatch = jina1.text.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/)
      const data = await callGemini(jina1.text, apiKey)
      if (data?.title) return NextResponse.json({ ...data, og_image: imgMatch?.[1] || null })
      errors.push(`JINA1_NO_TITLE(${jina1.chars}chars)`)
    } else {
      errors.push(jina1._err || `JINA1_SHORT(${jina1.chars ?? 0}chars)`)
    }

    // 3) Try Jina on mobile Facebook URL
    const jina2 = await fetchViaJina(`https://m.facebook.com/events/${eventId}/`)
    if (!jina2._err && jina2.text && jina2.chars > 100) {
      const imgMatch = jina2.text.match(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/)
      const data = await callGemini(jina2.text, apiKey)
      if (data?.title) return NextResponse.json({ ...data, og_image: imgMatch?.[1] || null })
      errors.push(`JINA2_NO_TITLE(${jina2.chars}chars)`)
    } else {
      errors.push(jina2._err || `JINA2_SHORT(${jina2.chars ?? 0}chars)`)
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
  const data = await callGemini(textForGemini, apiKey)
  if (data) return NextResponse.json({ ...data, og_image: ogImageData || ogImageUrl })

  return NextResponse.json({ error: 'Could not extract event details from that URL.' }, { status: 500 })
}
