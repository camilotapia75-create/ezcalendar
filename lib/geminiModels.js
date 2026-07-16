// Central Gemini model selection for both scan routes.
//
// We saw intermittent 404s on hardcoded model names even though the models exist
// (transient Google/region blips). The fix is resilience:
//   1. A longer fallback chain, so one model blipping doesn't sink the scan.
//   2. Self-updating "-latest" aliases that survive Google renaming models.
//   3. Runtime discovery: query the models the key can actually call and keep
//      only those from our preferred list — so a future rename can't 404 us.

// Preferred order (best → fallback). All verified to support generateContent.
const PREFERRED = [
  'gemini-2.5-flash',        // proven, strong vision — primary
  'gemini-flash-latest',     // self-updating current flash
  'gemini-2.5-flash-lite',   // faster/cheaper fallback
  'gemini-2.0-flash',        // older but reliable
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
]

const TTL_MS = 60 * 60 * 1000 // refresh the availability list hourly
let _cache = { at: 0, available: null }

async function fetchAvailable(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const set = new Set()
    for (const m of (data.models || [])) {
      const methods = m.supportedGenerationMethods || m.supportedMethods || []
      if (methods.includes('generateContent')) {
        set.add((m.name || '').replace(/^models\//, ''))
      }
    }
    return set.size ? set : null
  } catch {
    return null
  }
}

// Returns an ordered array of generateContent endpoint URLs to try in turn.
// Falls back to the full preferred list if discovery is unavailable.
export async function getGeminiUrls(apiKey) {
  const now = Date.now()
  if (!_cache.available || now - _cache.at > TTL_MS) {
    _cache = { at: now, available: await fetchAvailable(apiKey) }
  }
  const available = _cache.available
  const chosen = available ? PREFERRED.filter(m => available.has(m)) : PREFERRED
  const list = chosen.length ? chosen : PREFERRED
  return list.map(m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`)
}
