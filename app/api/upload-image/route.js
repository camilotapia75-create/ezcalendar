import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'flyer-images'

export async function POST(request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Storage not configured — add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars' }, { status: 500 })
  }

  const { imageData, userId } = await request.json()
  if (!imageData || !userId) {
    return NextResponse.json({ error: 'Missing imageData or userId' }, { status: 400 })
  }

  // Service role bypasses RLS — safe for server-only use
  const supabase = createClient(supabaseUrl, serviceKey)

  // Create bucket if it doesn't exist yet
  await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760 })
  // ^ error is ignored — throws if already exists, that's fine

  // Decode base64 data URL
  const base64 = imageData.split(',')[1]
  const bytes = Buffer.from(base64, 'base64')
  const path = `${userId}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
