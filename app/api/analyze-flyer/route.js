import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { imageData, mediaType } = await request.json()
    const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData
    const imgMediaType = (mediaType && mediaType.startsWith('image/')) ? mediaType : 'image/jpeg'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imgMediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract event details from this flyer. Return ONLY a valid JSON object with these exact keys (use null for anything not found):
{
  "title": "event name or title",
  "date": "date in YYYY-MM-DD format — if year is abbreviated like '26' treat it as 2026",
  "time_str": "time range exactly as shown on the flyer",
  "location": "venue name and/or city"
}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(data)
  } catch (err) {
    console.error('analyze-flyer error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
