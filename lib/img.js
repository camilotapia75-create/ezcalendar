// Downscale remote flyer images through a free on-the-fly resizing proxy so iOS
// doesn't decode full camera-resolution photos. Decoded image memory is a
// function of the SOURCE pixels, not the display size — so a 4000×3000 flyer
// shown in a 44px calendar cell still costs ~48 MB to decode. With ~100 events
// on screen that OOM-crashes the WebKit render process ("a problem repeatedly
// occurred"). Requesting a small width from the proxy makes each decode tiny.
//
// Data URIs, blobs, and already-relative paths pass through untouched.
export function thumb(url, width = 400) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url
  try {
    // wsrv.nl: free image CDN/resizer. `we` = never enlarge, dpr caps retina.
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=72&output=jpg&we`
  } catch {
    return url
  }
}

// onError handler: fall back to the original URL once if the proxy fails, so a
// proxy hiccup never blanks an image that would otherwise load.
export function thumbFallback(rawUrl) {
  return (e) => {
    const el = e.currentTarget
    if (el && rawUrl && el.src !== rawUrl && !el.dataset.rawTried) {
      el.dataset.rawTried = '1'
      el.src = rawUrl
    }
  }
}
