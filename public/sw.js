const STATIC_CACHE = 'ezcal-static-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('ezcal-static-') && k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Cache-first for Next.js static bundles — safe because their paths contain content hashes
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (!url.pathname.startsWith('/_next/static/')) return
  e.respondWith(
    caches.open(STATIC_CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone())
          return res
        })
      })
    )
  )
})

self.addEventListener('push', e => {
  let title = 'ezcalendar'
  let body  = 'You have upcoming events!'
  try {
    const data = e.data?.json()
    if (data?.title) title = data.title
    if (data?.body)  body  = data.body
  } catch {}
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon',
      badge: '/icon',
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus()
      }
      return clients.openWindow('/calendar')
    })
  )
})

// Required by the Push API spec for applicationServerKey conversion
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// The browser fires pushsubscriptionchange when the push service rotates or
// expires an endpoint — WITHOUT the app being open. We re-subscribe here and
// immediately save the new subscription to the server so the next cron call
// has a valid endpoint to deliver to.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      // VAPID public key is safe to expose — it's public by design
      const keyRes = await fetch('/api/vapid-key')
      if (!keyRes.ok) return
      const { key } = await keyRes.json()
      if (!key) return

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      // Same-origin fetch includes session cookies — server can auth the user
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
    } catch (err) {
      console.error('[sw] pushsubscriptionchange re-subscribe failed:', err)
    }
  })())
})
