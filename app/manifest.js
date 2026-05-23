export default function manifest() {
  return {
    name: 'ezcalendar',
    short_name: 'ezcalendar',
    description: 'Snap a flyer. It lands on the right date.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0c0e',
    theme_color: '#0c0c0e',
    orientation: 'portrait-primary',
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
