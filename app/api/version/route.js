import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Returns the deployed commit SHA so clients can detect a new deployment
// and refresh themselves (home-screen PWAs cache the old bundle aggressively)
export async function GET() {
  return NextResponse.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
