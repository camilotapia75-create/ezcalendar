import type { CapacitorConfig } from '@capacitor/cli'

// Native iOS/Android shell for ezcalendar. The app content is the live deployed
// web app (server.url), so web changes ship without rebuilding the native app.
//
// IMPORTANT: replace server.url with your real production domain before building.
const config: CapacitorConfig = {
  appId: 'com.ezcalendar.app',
  appName: 'ezcalendar',
  webDir: 'public', // unused when server.url is set, but required by the CLI
  server: {
    url: 'https://YOUR-PRODUCTION-DOMAIN', // e.g. https://ezcalendar.vercel.app
    cleartext: false,
  },
  ios: {
    // Lets the Share Extension hand shared content to the app via a shared
    // App Group container (see NATIVE_IOS.md).
    scheme: 'ezcalendar',
  },
}

export default config
