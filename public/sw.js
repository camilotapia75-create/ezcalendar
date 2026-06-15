const STATIC_CACHE = 'ezcal-static-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  // Clean up old static caches when the SW updates
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
