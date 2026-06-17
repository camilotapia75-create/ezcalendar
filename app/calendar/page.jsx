import CalendarClient from '@/components/CalendarClient'

// Fully static — served instantly from the CDN with no serverless cold start.
// Auth is resolved client-side in CalendarClient (RLS protects every query).
export default function CalendarPage() {
  return <CalendarClient />
}
