export default function manifest() {
  return {
    name: 'ezcalendar',
    short_name: 'ezcalendar',
    description: 'Snap a flyer. It lands on the right date.',
    // Open straight into the app — /calendar is static (instant from CDN) and
    // resolves auth client-side, skipping the landing page's serverless
    // getUser + redirect round-trip on every cold launch.
    start_url: '/calendar',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    orientation: 'portrait-primary',
    // Lets users share links straight from Instagram/Facebook/etc. into the
    // app via the system share sheet (Android; iOS doesn't support this yet)
    share_target: {
      action: '/share',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
