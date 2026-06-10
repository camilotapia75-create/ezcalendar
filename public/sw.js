self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

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
