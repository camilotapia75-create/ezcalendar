// First-run demo content. These are CLIENT-ONLY — never written to Supabase — so
// a brand-new account looks alive and learns the flow (tap → details → Add to
// Calendar), then they vanish the moment the user has a real event. Keeping them
// out of the DB also keeps them out of the community-moat suggestions.

// Build a self-contained poster (data-URI SVG) so it always renders offline and
// never 404s. Fixed layout, two short title lines.
function flyer({ bg1, bg2, accent, kicker, l1, l2, meta, sub, ink = '#f4f7ec' }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>` +
    `<circle cx="650" cy="120" r="150" fill="${accent}" opacity="0.18"/>` +
    `<circle cx="130" cy="520" r="120" fill="${accent}" opacity="0.10"/>` +
    `<text x="60" y="130" font-family="Georgia,serif" font-size="27" fill="${accent}" letter-spacing="7">${esc(kicker)}</text>` +
    `<text x="58" y="242" font-family="Georgia,serif" font-weight="bold" font-size="70" fill="${ink}">${esc(l1)}</text>` +
    `<text x="58" y="316" font-family="Georgia,serif" font-weight="bold" font-size="70" fill="${ink}">${esc(l2)}</text>` +
    `<rect x="60" y="350" width="190" height="4" fill="${accent}"/>` +
    `<text x="60" y="412" font-family="Helvetica,Arial,sans-serif" font-size="27" fill="#d5dac9">${esc(meta)}</text>` +
    `<text x="60" y="454" font-family="Helvetica,Arial,sans-serif" font-size="23" fill="#9aa38b">${esc(sub)}</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const FLYER_MUSIC = flyer({ bg1: '#12140c', bg2: '#1e2410', accent: '#bcea47', kicker: 'LIVE • ROOFTOP', l1: 'Sunset', l2: 'Session', meta: '7:30 PM · The Lookout', sub: 'Downtown' })
const FLYER_MARKET = flyer({ bg1: '#1c1408', bg2: '#2a1d0a', accent: '#f0b43a', kicker: 'THIS WEEKEND', l1: 'Weekend', l2: 'Flea Market', meta: '10:00 AM · Grand Plaza', sub: '50+ local vendors' })
const FLYER_CLASS = flyer({ bg1: '#0f1020', bg2: '#191a33', accent: '#a78bfa', kicker: 'HANDS-ON', l1: 'Intro to', l2: 'Pottery', meta: '6:00 PM · Clay Studio', sub: 'All levels welcome' })
const FLYER_PARTY = flyer({ bg1: '#1a0a18', bg2: '#2a0f24', accent: '#f472b6', kicker: 'THIS SAT', l1: 'Warehouse', l2: 'Block Party', meta: '9:00 PM · The Annex', sub: 'Live DJs all night' })

function iso(offsetDays) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Three events that land in the Today and This-Week buckets so the feed's live
// carousels are populated. sample:true drives the SAMPLE badge and DB guards.
export function makeSampleEvents() {
  return [
    { id: '__sample_today__',  sample: true, title: 'Rooftop Live: Sunset Session', date: iso(0), time_str: '7:30 PM',  location: 'The Lookout, Downtown', image_url: FLYER_MUSIC },
    { id: '__sample_market__', sample: true, title: 'Weekend Flea Market',           date: iso(2), time_str: '10:00 AM', location: 'Grand Plaza',           image_url: FLYER_MARKET },
    { id: '__sample_class__',  sample: true, title: 'Intro to Pottery',              date: iso(4), time_str: '6:00 PM',  location: 'Clay Studio',           image_url: FLYER_CLASS },
  ]
}

// One suggested-row mockup so the "Suggested for you" feature is visible on a
// fresh account too.
export function makeSampleSuggestion() {
  return { sample: true, title: 'Warehouse Block Party', date: iso(6), time_str: '9:00 PM', venue: 'The Annex', city: 'Downtown', image: FLYER_PARTY, genre: 'Nightlife', reason: 'Example suggestion' }
}
