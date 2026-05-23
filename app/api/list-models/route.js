import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'no api key' })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
  )
  const data = await res.json()

  const models = (data.models ?? []).map(m => ({
    name: m.name,
    displayName: m.displayName,
    supportedMethods: m.supportedGenerationMethods,
  }))

  return NextResponse.json({ count: models.length, models })
}
